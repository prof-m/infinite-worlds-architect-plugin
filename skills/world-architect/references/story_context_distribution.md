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

**Rule**: `background` is for the world situation at the **very beginning** of the story — it is not updated after the first turn. Be judicious: only include the initial premise and setting, not ongoing story developments. Do NOT embed individual character descriptions here — player character descriptions belong in `possibleCharacters`, NPC descriptions in `NPCs`.

### Tier 2: Conditionally Loaded Data

Check the manifest flags (Tier 0) before querying these:

| Data | Condition to load | Use for |
|---|---|---|
| `turn_index.json` | Always (lightweight) | Lists all turns with turn numbers, line ranges, and source files. Contains 100-char action/outcome **previews** (truncated — NOT summaries). Use for enumerating which turns exist and their source locations, not for understanding turn content |
| `tracked_state.json` | Only if `manifest.trackedItemsFound === true` | Tracked item final values → `trackedItems` initial values in the sequel world |
| `character_index.json` | Only if `manifest.characterIndexingAttempted === true` **and** `character_index.json` was in `filesWritten` | Find which turns introduce or focus on specific characters |

**Optimization**: If `trackedItemsFound` is false, skip `query_story_data(extraction_dir, 'tracked_state')` entirely. If `characterIndexingAttempted` is false (or character_index was not generated), you will need to use `turn_detail` queries to find character introductions — the 100-char turn_index previews are not sufficient to reliably identify them.

### Tier 3: Selectively Loaded Turn Detail

Do not query all turns. Use `tracked_state` snapshot deltas and `character_index` data to decide which turns to query. `turn_index` only tells you which turns exist and their line ranges — its 100-char previews are too short to identify content.

**High-value turns to query:**
- Turn 1 (character and world establishment)
- First turn where each major character is introduced (use character_index if available)
- Turns where tracked item values change dramatically (visible in tracked_state snapshots)
- The last 1–2 turns (final state of the story world)

**Target**: 3–7 `turn_detail` queries maximum.

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

**Note**: Character descriptions (appearance, personality, motivations) belong in `possibleCharacters` for PCs and `NPCs` for non-player characters — NOT in keyword blocks. Use keyword blocks for contextual information that should only inject when relevant.

**Use keyword blocks for:**
- Location descriptions — keyword: place name and common variants
- Faction/group details — keyword: faction name, group title
- Secret lore only relevant in specific situations — keyword: situation-specific terms
- Supplementary relationship context between characters — keyword: both character names

**Populating from extraction data:**
- Location blocks: Source from `turn_detail` outcomeDescription text where setting is described
- Faction/lore blocks: Source from `turn_detail` SecretInfo sections for hidden world details
- If `character_index.json` exists, use it to find the exact turns where relevant locations/events appear

**Pattern:**
```
Keyword Block: "[Location Name]"
Keywords: ["LocationName", "the tavern", "alternate reference"]
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
   → enumerate which turns exist and their line ranges/source files
   → 100-char previews only — NOT usable as summaries or for identifying turning points

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
| `loreBookEntries` (locations) | `turn_detail` setting descriptions | 4 |
| `loreBookEntries` (factions/lore) | `turn_detail` SecretInfo sections | 4 |
| `trackedItems` | `tracked_state` final snapshot | 2 (conditional) |
| `NPCs` | `turn_detail` NPC introduction turns (see Tier 3b for field mapping) | 3b |
| `instructionBlocks` | Story mechanics (if carried forward) | 6 |
| `triggerEvents` | Recurring story mechanics, plot beats | 6 |
| `designNotes` | Author notes only — never AI-visible | — |

---

## Anti-Patterns to Avoid

**Do not** embed NPC or character descriptions in `background`. Background is for the initial world premise only. Player character descriptions belong in `possibleCharacters`; NPC descriptions belong in `NPCs`. Location and faction lore belongs in keyword blocks where it injects on-demand.

**Do not** query `turn_detail` for every turn. Use `tracked_state` snapshot deltas and `character_index` data to identify which turns are worth querying. `turn_index` only lists which turns exist — its 100-char previews are not sufficient to identify relevant content.

**Do not** carry forward all tracked items from the source story. Only bring forward items that are still mechanically meaningful in the sequel premise. Items tied to resolved plot threads should be dropped or redesigned.

**Do not** put all story context in `instructions`. Instructions are for AI decision-making logic, not narrative history. Use `background` only for the initial story premise, and keyword blocks for character/location lore.

**Do not** treat `background` as an ongoing state field. It holds the world situation at the **very beginning** of the story and is not updated during play. Be judicious — only the initial premise and setting belong here, not story developments or evolved state.

**Do not** check manifest flags without first querying the manifest. The manifest query must happen before any conditional loading decisions.
