# Story-to-Lorebook Output Strategy

When building a sequel world from story extraction data, not all extracted information belongs in always-on fields. This guide defines how to distribute story state across the different world field types to maximize context efficiency and minimize AI confusion.

## The Core Problem

Always-on fields (`background`, `instructions`, `objective`) are injected into the AI's context every single turn. Packing them with character descriptions, NPC lore, and location details bloats the context window and increases cost without adding value for turns where that information is irrelevant.

The extraction tools (2B) produce structured, queryable data. The distribution strategy below tells you which data goes where in the world output.

---

## Tier Strategy

### Tier 0: Read the Manifest First

**Always** query the manifest before making any other decisions. It contains the flags that govern all conditional loading:

```
query_story_data(extraction_dir, 'manifest')
```

Key flags to read:
- `manifest.trackedItemsFound` — gate for `tracked_state` queries (Tier 2)
- `manifest.characterIndexingAttempted` — gate for `character_index` usage (Tier 2)

Note: `characterIndexingAttempted` means indexing was requested; check whether `character_index.json` is listed in the `filesWritten` array from the original `extract_story_data` call to confirm it was successfully generated.

### Tier 1: Always-On Fields

Populated from `metadata.json`. Load this first — it provides framing that every turn needs.

| Source field | → World field |
|---|---|
| `metadata.background` | → `background` |
| `metadata.character.objective` | → `objective` |
| `metadata.character.background` + `metadata.character.skills` | → `instructions` (character framing section) |
| `metadata.character` (name, background, skills) | → `possibleCharacters[0]` |
| `metadata.title` | → `title` (as starting point) |
| `metadata.background` + sequel premise | → `description` (user-facing blurb; draft then confirm with user) |

**Rule**: Keep `background` focused on the world situation and story starting state. Do NOT embed individual character descriptions here — those belong in keyword blocks.

### Tier 2: Conditionally Loaded Data

Check the manifest flags (Tier 0) before querying these:

| Data | Condition to load | Use for |
|---|---|---|
| `turn_index.json` | Always (lightweight) | Scan turn distribution, identify key turning points, decide which turns to deep-dive |
| `tracked_state.json` | Only if `manifest.trackedItemsFound === true` | Tracked item final values → `trackedItems` initial values in the sequel world |
| `character_index.json` | Only if `manifest.characterIndexingAttempted === true` **and** `character_index.json` was in `filesWritten` | Find which turns introduce or focus on specific characters |

**Optimization**: If `trackedItemsFound` is false, skip `query_story_data(extraction_dir, 'tracked_state')` entirely. If `characterIndexingAttempted` is false (or character_index was not generated), identify character-focused turns from `turn_index` actionPreview/outcomePreview text instead.

### Tier 3: Selectively Loaded Turn Detail

Use `turn_index.json` to identify which turns deserve full detail queries. Do not query all turns.

**High-value turns to query:**
- Turn 1 (character and world establishment)
- First turn where each major character is introduced (use character_index if available)
- Turns where tracked item values change dramatically (visible in tracked_state snapshots)
- The last 1–2 turns (final state of the story world)
- Any turn flagged as a major turning point from turn_index previews

**Target**: 3–7 `turn_detail` queries maximum. More than that indicates the agent should be using turn_index summaries rather than full text.

**Turn number format**: Pass turn numbers as **strings** in the `turns` array:
```
query_story_data(extraction_dir, 'turn_detail', turns: ["1", "5", "last"])
```
Multiple turns can be requested in a single call; the tool returns data for all requested turns.

### Tier 3b: NPC Objects (`NPCs`)

NPCs require populating 9 distinct fields. Use `turn_detail` queries for the turns where each NPC first appears. Map turn text to NPC fields as follows:

| NPC field | Source |
|---|---|
| `name` | Character name from story text |
| `detail` | Character personality, role, and motivations from turn narrative |
| `one_liner` | Brief summary — synthesize from character's role in the story |
| `appearance` | Physical description from turn_detail outcomeDescription (story's own words) |
| `location` | Last known location from turn_detail or tracked_state context |
| `secret_info` | Hidden motivations from SecretInfo sections of relevant turns |
| `names` | All names and aliases used in the story |
| `img_appearance` | Appearance description formatted for image generation |
| `img_clothing` | Clothing description formatted for image generation |

**Important**: `img_appearance` and `img_clothing` require author input — do not invent image prompt text. Prompt the user to supply or confirm these values.

### Tier 4: Keyword Instruction Blocks (`loreBookEntries`)

The most token-efficient field type. Content only injects when the AI encounters a matching keyword in the context window.

**Use keyword blocks for:**
- Character personality, appearance, motivations — keyword: character name + common aliases
- Location descriptions — keyword: place name and common variants
- Faction/group details — keyword: faction name, group title
- Secret lore only relevant in specific situations — keyword: situation-specific terms

**Populating from extraction data:**
- Character blocks: Source from `turn_detail` queries for introduction turns + `tracked_state` for final character-related item values
- Location blocks: Source from `turn_detail` outcomeDescription text where setting is described
- If `character_index.json` exists, use it to find the exact turns where each character is introduced

**Pattern:**
```
Keyword Block: "[Character Name]"
Keywords: ["CharacterName", "known alias", "their title"]
Content: Description synthesized from cited turn_detail text
```

### Tier 5: Tracked Items (`trackedItems`)

Populate tracked items in the sequel world based on the **final state** from `tracked_state.json`.

- Use the last snapshot (`snapshots[snapshots.length - 1]`) for final values. Each snapshot covers a turn range (`from_turn`/`to_turn`); the last snapshot holds the state that persisted to story end.
- `tracked_items` values: recommend defaulting visibility to `"everyone"` or `"player_only"` — confirm with the author what visibility is appropriate for each item in the sequel
- `hidden_tracked_items` may be `null` (check before iterating). When present, recommend defaulting visibility to `"ai_only"` or `"nobody"` — confirm with the author
- Set `initialValue` to the final story value as the sequel's starting point
- Only carry forward tracked items that remain relevant to the sequel premise

### Tier 6: Extra Instruction Blocks (`instructionBlocks`) and Triggers (`triggerEvents`)

Use sparingly for phase-specific content activated via trigger events.

- Story mechanics that only matter in specific story phases → Extra Instruction Block, activated by trigger
- Character state changes that the AI should know only after a plot event → trigger-gated Secret Info effect
- Recurring plot mechanics from the source story that should persist → trigger with `canTriggerMoreThanOnce: true`

**Note**: `designNotes` is a personal author notes field — it is **never sent to the AI**. Use it for implementation notes during world construction, not for AI-facing content.

---

## Loading Sequence Reference

```
0. ALWAYS FIRST: query_story_data(extraction_dir, 'manifest')
   → read trackedItemsFound and characterIndexingAttempted flags
   → check filesWritten to confirm which files were generated

1. ALWAYS: query_story_data(extraction_dir, 'metadata')
   → background, objective, character, instructions framing

2. ALWAYS (lightweight): query_story_data(extraction_dir, 'turn_index')
   → scan turn distribution, identify key turns to deep-dive

3. CONDITIONAL: if manifest.trackedItemsFound
   → query_story_data(extraction_dir, 'tracked_state')
   → extract final snapshot for trackedItems initial values
   → use snapshot delta turns to identify high-value turns for step 4

4. SELECTIVE (3–7 turns max):
   → query_story_data(extraction_dir, 'turn_detail', turns: ["1", "<intro turns>", "last"])
   → populate keyword block content (characters, locations)
   → populate NPC fields

5. OPTIONAL: if manifest.characterIndexingAttempted and character_index.json in filesWritten
   → read character_index to identify exact introduction turns per character
   → use those turn numbers to refine step 4 queries
```

---

## Field Assignment Quick Reference

| World field | Primary source | Tier |
|---|---|---|
| `title` | `metadata.title` (starting point) | 1 |
| `description` | `metadata.background` + sequel premise, confirmed with user | 1 |
| `background` | `metadata.background` | 1 |
| `objective` | `metadata.character.objective` (last-turn objective if evolved) | 1 |
| `instructions` | `metadata.character.background + skills` + manual authoring | 1 |
| `possibleCharacters` | `metadata.character` | 1 |
| `loreBookEntries` (characters) | `turn_detail` intro turns + `tracked_state` | 3 + 4 |
| `loreBookEntries` (locations) | `turn_detail` setting descriptions | 3 |
| `trackedItems` | `tracked_state` final snapshot | 2 (conditional) |
| `NPCs` | `turn_detail` NPC introduction turns (see Tier 3b for field mapping) | 3b |
| `instructionBlocks` | Story mechanics (if carried forward) | 6 |
| `triggerEvents` | Recurring story mechanics, plot beats | 6 |
| `designNotes` | Author notes only — never AI-visible | — |

---

## Anti-Patterns to Avoid

**Do not** embed NPC or character descriptions in `background`. Background is for world state, not a character roster. Character details belong in keyword blocks where they inject on-demand.

**Do not** query `turn_detail` for every turn. Use `turn_index` summaries to identify which turns contain relevant information before querying full detail.

**Do not** carry forward all tracked items from the source story. Only bring forward items that are still mechanically meaningful in the sequel premise. Items tied to resolved plot threads should be dropped or redesigned.

**Do not** put all story context in `instructions`. Instructions are for AI decision-making logic, not narrative history. Use `background` for the story state and keyword blocks for character/location lore.

**Do not** check manifest flags without first querying the manifest. The manifest query must happen before any conditional loading decisions.
