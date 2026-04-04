# Story-to-Lorebook Output Strategy

When building a sequel world from story extraction data, not all extracted information belongs in always-on fields. This guide defines how to distribute story state across the different world field types to maximize context efficiency and minimize AI confusion.

## The Core Problem

Always-on fields (`background`, `instructions`, `objective`) are injected into the AI's context every single turn. Packing them with character descriptions, NPC lore, and location details bloats the context window and increases cost without adding value for turns where that information is irrelevant.

The extraction tools (2B) produce structured, queryable data. The distribution strategy below tells you which data goes where in the world output.

---

## Tier Strategy

### Tier 1: Always-On Fields

Populated from `metadata.json`. Load this first — it provides framing that every turn needs.

| Source field | → World field |
|---|---|
| `metadata.background` | → `background` |
| `metadata.character.objective` | → `objective` |
| `metadata.character.background` + `metadata.character.skills` | → `instructions` (character framing section) |
| `metadata.character` (name, background, skills) | → `possibleCharacters[0]` |
| `metadata.title` | → `title` (as starting point) |

**Rule**: Keep `background` focused on the world situation and story starting state. Do NOT embed individual character descriptions here — those belong in keyword blocks.

### Tier 2: Conditionally Loaded Data

Check the manifest before querying these:

| Data | Condition to load | Use for |
|---|---|---|
| `turn_index.json` | Always (lightweight) | Scan turn distribution, identify key turning points, decide which turns to deep-dive |
| `tracked_state.json` | Only if `manifest.trackedItemsFound === true` | Tracked item final values → `trackedItems` initial values in the sequel world |
| `character_index.json` | Only if `manifest.characterIndexingCompleted === true` | Find which turns introduce or focus on specific characters |

**Optimization**: If `trackedItemsFound` is false, skip `query_story_data(extraction_dir, 'tracked_state')` entirely. If `characterIndexingCompleted` is false, identify character-focused turns from `turn_index` actionPreview/outcomePreview text instead.

### Tier 3: Selectively Loaded Turn Detail

Use `turn_index.json` to identify which turns deserve full detail queries. Do not query all turns.

**High-value turns to query:**
- Turn 1 (character and world establishment)
- First turn where each major character is introduced (use character_index if available)
- Turns where tracked item values change dramatically (visible in tracked_state snapshots)
- The last 1–2 turns (final state of the story world)
- Any turn flagged as a major turning point from turn_index previews

**Target**: 3–7 `turn_detail` queries maximum. More than that indicates the agent should be using turn_index summaries rather than full text.

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

- Use the last snapshot (`snapshots[snapshots.length - 1]`) for final values
- `tracked_items` → visibility `"everyone"` or `"player_only"`
- `hidden_tracked_items` → visibility `"ai_only"` or `"nobody"`
- Set `initialValue` to the final story value as the sequel's starting point
- Only carry forward tracked items that remain relevant to the sequel premise

### Tier 6: Extra Instruction Blocks (`instructionBlocks`) and Triggers

Use sparingly for phase-specific content activated via trigger events.

- Story mechanics that only matter in specific story phases → Extra Instruction Block, activated by trigger
- Character state changes that the AI should know only after a plot event → trigger-gated Secret Info effect
- Recurring plot mechanics from the source story that should persist → trigger with `canTriggerMoreThanOnce: true`

---

## Loading Sequence Reference

```
1. ALWAYS: query_story_data(extraction_dir, 'metadata')
   → background, objective, character, instructions framing

2. ALWAYS (lightweight): query_story_data(extraction_dir, 'turn_index')
   → scan turn distribution, identify key turns to deep-dive

3. CONDITIONAL: if manifest.trackedItemsFound
   → query_story_data(extraction_dir, 'tracked_state')
   → extract final snapshot for trackedItems initial values

4. SELECTIVE (3–7 turns max):
   → query_story_data(extraction_dir, 'turn_detail', [1, <intro turns>, <last 1–2>])
   → populate keyword block content (characters, locations)

5. OPTIONAL: if manifest.characterIndexingCompleted
   → use character_index turn numbers to target #4 queries efficiently
```

---

## Field Assignment Quick Reference

| World field | Primary source | Tier |
|---|---|---|
| `title` | `metadata.title` (starting point) | 1 |
| `description` | User-provided or synthesized | — |
| `background` | `metadata.background` | 1 |
| `objective` | `metadata.character.objective` (last-turn objective if evolved) | 1 |
| `instructions` | `metadata.character.background + skills` + manual authoring | 1 |
| `possibleCharacters` | `metadata.character` | 1 |
| `loreBookEntries` (characters) | `turn_detail` intro turns + `tracked_state` | 3 + 4 |
| `loreBookEntries` (locations) | `turn_detail` setting descriptions | 3 |
| `trackedItems` | `tracked_state` final snapshot | 2 (conditional) |
| `NPCs` | `turn_detail` NPC introduction turns | 3 |
| `instructionBlocks` | Story mechanics (if carried forward) | 6 |
| `triggerEvents` | Recurring story mechanics, plot beats | 6 |

---

## Anti-Patterns to Avoid

**Do not** embed NPC or character descriptions in `background`. Background is for world state, not a character roster. Character details belong in keyword blocks where they inject on-demand.

**Do not** query `turn_detail` for every turn. Use `turn_index` summaries to identify which turns contain relevant information before querying full detail.

**Do not** carry forward all tracked items from the source story. Only bring forward items that are still mechanically meaningful in the sequel premise. Items tied to resolved plot threads should be dropped or redesigned.

**Do not** put all story context in `instructions`. Instructions are for AI decision-making logic, not narrative history. Use `background` for the story state and keyword blocks for character/location lore.
