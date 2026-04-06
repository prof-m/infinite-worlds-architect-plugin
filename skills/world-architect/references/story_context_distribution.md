# Story Context Distribution Strategy

When building a sequel world from story extraction data, not all extracted information belongs in always-on fields. This guide defines how to distribute story state across the different world field types to maximize context efficiency and minimize AI confusion.

## The Core Problem

Always-on fields (`background`, `instructions`, `objective`) are injected into the AI's context every single turn. Packing them with character descriptions, NPC lore, and location details bloats the context window and increases cost without adding value for turns where that information is irrelevant.

The extraction tools (2B) produce structured, queryable data. The distribution strategy below tells you which data goes where in the world output.

---

## Tier Strategy

### Tier 0: Read the Manifest and Save the Extraction Result

**Before querying anything**, save the result returned by `extract_story_data`. It contains two key pieces of information:

- `result.hasTrackedItems` — whether tracked items were found (gates tracked_state queries)
- `result.filesWritten` — which output files were generated (check for `character_index.json` to know if character indexing succeeded)

Then query the manifest for additional metadata:
```
query_story_data(extraction_dir, 'manifest')
```

The manifest provides `has_tracked_items`, `has_hidden_tracked_items`, `total_turns`, and source file provenance. Use `result.hasTrackedItems` or `manifest.has_tracked_items` to gate tracked_state queries; use `result.filesWritten` to check for `character_index.json`.

**Note**: There is no manifest flag for character indexing. The only way to know if character indexing was performed is to check whether `character_index.json` appears in the `filesWritten` array from the `extract_story_data` return value.

### Tier 1: Always-On Fields

Populated from `metadata.json`. Load this first — it provides framing that every turn needs.

| Source field | → World field |
|---|---|
| `metadata.story_background` | → `background` |
| `metadata.objective` | → `objective` |
| `metadata.character.background` + `metadata.character.skills` | → `instructions` (character framing section) |
| `metadata.character` (name, background, skills) | → `possibleCharacters[0]` |
| `metadata.title` | → `title` (as starting point) |
| `metadata.story_background` + sequel premise | → `description` (user-facing blurb; draft then confirm with user) |

**Note on `metadata.character.skills`**: Skills are arrays of `{ name, rating, level }` objects, not plain strings.

**Rule**: `background` is for the world situation at the **very beginning** of the story — it is not updated after the first turn. Be judicious: only include the initial premise and setting, not ongoing story developments. Do NOT embed individual character descriptions here — player character descriptions belong in `possibleCharacters`, NPC descriptions in `NPCs`.

### Tier 2: Conditionally Loaded Data

Check the extraction result and manifest flags (Tier 0) before querying these:

| Data | Condition to load | Use for |
|---|---|---|
| `turn_index.json` | Always (lightweight) | Lists all turns with turn numbers, line ranges, and source files. Contains 100-char action/outcome **previews** (truncated — NOT summaries). Use for enumerating which turns exist and their source locations, not for understanding turn content |
| `tracked_state.json` | Only if `has_tracked_items` is true | Tracked item final values → `trackedItems` initial values in the sequel world |
| `character_index.json` | Only if `character_index.json` was in `filesWritten` | Find which turns introduce or focus on specific characters |

**Optimization**: If `has_tracked_items` is false, skip `query_story_data(extraction_dir, 'tracked_state')` entirely. If `character_index.json` was not generated, you will need to use `turn_detail` queries to find character introductions — the 100-char turn_index previews are not sufficient to reliably identify them.

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

**Note on turn_detail format**: The response contains `{ turns: [{ number, content }] }` where `content` is the **raw text** of the entire turn. It is not pre-parsed into structured fields — the agent must parse the raw text to find specific sections (Action, Outcome, Objective, Secret Information delimited by `### SECRETINFO` / `### SECRETINFO_END`, Tracked Items, Hidden Tracked Items).

### Tier 3b: NPC Objects (`NPCs`)

NPCs require populating multiple fields. Use `turn_detail` queries for the turns where each NPC first appears. Map the raw turn text to NPC fields as follows:

| NPC field | Source |
|---|---|
| `name` | Character name from story text |
| `detail` | Character personality, role, and motivations from turn narrative (Outcome section) |
| `one_liner` | Brief summary — synthesize from character's role in the story |
| `appearance` | Physical description from Outcome section of turn_detail (story's own words) |
| `location` | Last known location from turn text or tracked_state context |
| `secret_info` | Hidden motivations from Secret Information section of relevant turns |
| `names` | All names and aliases used in the story |
| `img_appearance` | Appearance description formatted for image generation |
| `img_clothing` | Clothing description formatted for image generation |

**Important**: `img_appearance` and `img_clothing` require author input — do not invent image prompt text. Prompt the user to supply or confirm these values.

**Note**: `id` is auto-generated by `compile_draft` — the agent does not need to supply it.

### Tier 4: Keyword Instruction Blocks (`loreBookEntries`)

The most token-efficient field type. Content only injects when the AI encounters a matching keyword in the context window.

**Note**: Character descriptions (appearance, personality, motivations) belong in `possibleCharacters` for PCs and `NPCs` for non-player characters — NOT in keyword blocks. Use keyword blocks for contextual information that should only inject when relevant.

**Use keyword blocks for:**
- Location descriptions — keyword: place name and common variants
- Faction/group details — keyword: faction name, group title
- Secret lore only relevant in specific situations — keyword: situation-specific terms
- Supplementary relationship context between characters — keyword: both character names

**Populating from extraction data:**
- Location blocks: Source from Outcome sections of turn_detail text where setting is described
- Faction/lore blocks: Source from Secret Information sections of turn_detail for hidden world details
- If `character_index.json` exists, use it to find the exact turns where relevant locations/events appear

**Pattern:**
```
Keyword Block: "[Location Name]"
Keywords: ["LocationName", "the tavern", "alternate reference"]
Content: Description synthesized from cited turn_detail text
```

### Tier 5: Tracked Items (`trackedItems`)

Populate tracked items in the sequel world based on the **final state** from `tracked_state.json`.

- Use the last snapshot (the one with the highest `to_turn` value) for final values. Each snapshot covers a turn range (`from_turn`/`to_turn`); the last snapshot holds the state that persisted to story end.
- If the original world JSON is available, use its tracked item visibility settings (`everyone`, `ai_only`, `player_only`, `nobody`) as defaults. Otherwise, recommend `"everyone"` or `"player_only"` for `trackedItems`.
- **CRITICAL**: Before defaulting or populating `hidden_tracked_items`, verify that `has_hidden_tracked_items` is true from the manifest. If it is mathematically false or `hidden_tracked_items` is `null`/empty, do not invent or carry forward hidden tracked items. Recommend `"ai_only"` or `"nobody"` visibilities only if hidden tracked items legitimately existed and are being brought forward.
- Set `initialValue` to the final story value as the sequel's starting point
- Each tracked item also requires `dataType` (text/number/xml), `description`, `updateInstructions`, and other fields — see `schema.md` for the complete list. Confirm these with the author for each carried-forward item.
- Present all tracked items from the source world as the starting proposal. Flag any items that appear tied to resolved plot threads or mechanics no longer relevant to the sequel premise — the author decides what to keep, modify, or drop.

### Tier 6: Extra Instruction Blocks (`instructionBlocks`) and Triggers (`triggerEvents`)

Use sparingly for phase-specific content activated via trigger events.

- Story mechanics that only matter in specific story phases → Extra Instruction Block, activated by trigger
- Character state changes that the AI should know only after a plot event → trigger-gated Secret Info effect
- Recurring plot mechanics from the source story that should persist → trigger with `canTriggerMoreThanOnce: true`

**Note**: `designNotes` is a personal author notes field — it is **never sent to the AI**. Use it for implementation notes during world construction, not for AI-facing content.

---

## Loading Sequence Reference

```
0. SAVE extract_story_data result
   → result.hasTrackedItems gates tracked_state queries
   → result.filesWritten tells you if character_index.json was generated

1. ALWAYS FIRST: query_story_data(extraction_dir, 'manifest')
   → read has_tracked_items and source file provenance
   → manifest does NOT have a character indexing flag — use filesWritten from step 0

2. ALWAYS: query_story_data(extraction_dir, 'metadata')
   → story_background, objective, character, instructions framing

3. ALWAYS (lightweight): query_story_data(extraction_dir, 'turn_index')
   → enumerate which turns exist and their line ranges/source files
   → 100-char previews only — NOT usable as summaries or for identifying turning points

4. CONDITIONAL: if has_tracked_items is true
   → query_story_data(extraction_dir, 'tracked_state')
   → extract final snapshot for trackedItems initial values
   → use snapshot delta turns to identify high-value turns for step 6

5. CONDITIONAL: if character_index.json in filesWritten
   → read character_index to identify exact introduction turns per character
   → use those turn numbers to inform step 6 queries

6. SELECTIVE (3–7 turns max):
   → query_story_data(extraction_dir, 'turn_detail', turns: ["1", "<intro turns>", "last"])
   → raw text returned — parse Outcome and Secret Information sections
   → populate NPC fields, keyword block content (locations, factions)
```

---

## Field Assignment Quick Reference

| World field | Primary source | Tier |
|---|---|---|
| `title` | `metadata.title` (starting point) | 1 |
| `description` | `metadata.story_background` + sequel premise, confirmed with user | 1 |
| `background` | `metadata.story_background` (initial premise only) | 1 |
| `objective` | `metadata.objective` (root level, not under character) | 1 |
| `instructions` | `metadata.character.background + skills` + manual authoring | 1 |
| `possibleCharacters` | `metadata.character` | 1 |
| `loreBookEntries` (locations) | `turn_detail` Outcome section descriptions | 4 |
| `loreBookEntries` (factions/lore) | `turn_detail` Secret Information sections | 4 |
| `trackedItems` | `tracked_state` final snapshot (see schema.md for all required fields) | 2 (conditional) |
| `NPCs` | `turn_detail` NPC introduction turns (see Tier 3b for field mapping) | 3b |
| `instructionBlocks` | Story mechanics (if carried forward) | 6 |
| `triggerEvents` | Recurring story mechanics, plot beats | 6 |
| `designNotes` | Author notes only — never AI-visible | — |

---

## Anti-Patterns to Avoid

**Do not** embed NPC or character descriptions in `background`. Background is for the initial world premise only. Player character descriptions belong in `possibleCharacters`; NPC descriptions belong in `NPCs`. Location and faction lore belongs in keyword blocks where it injects on-demand.

**Do not** query `turn_detail` for every turn. Use `tracked_state` snapshot deltas and `character_index` data to identify which turns are worth querying. `turn_index` only lists which turns exist — its 100-char previews are not sufficient to identify relevant content.

**Do not** silently discard tracked items from the source story. Present all of them as the starting proposal, flag items tied to resolved plot threads, and let the author decide what to keep or drop.

**Do not** put all story context in `instructions`. Instructions are for AI decision-making logic, not narrative history. Use `background` only for the initial story premise, and keyword blocks for character/location lore.

**Do not** treat `background` as an ongoing state field. It holds the world situation at the **very beginning** of the story and is not updated during play. Be judicious — only the initial premise and setting belong here, not story developments or evolved state.

**Do not** reference `metadata.background` — the actual field name is `metadata.story_background`. Similarly, objective is at `metadata.objective` (root level), not `metadata.character.objective`.
