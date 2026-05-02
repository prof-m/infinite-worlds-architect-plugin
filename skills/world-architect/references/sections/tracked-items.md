# Field Guide: Tracked Items

JSON key: `trackedItems` — array of tracked item objects

Each item has: `id`, `name`, `dataType`, `visibility`, `description`, `updateInstructions`, `initialValue`, `initialValueBasedOnPC`, `autoUpdate`

---

## What Tracked Items Do

Tracked items are author-defined variables the storyteller AI monitors and updates each turn. They store state: player resources, relationship scores, flags, inventory, time, complex data structures. The AI reads the current values each turn and writes updates to `stateVariablesUpdates` in its response.

**10,000-character output limit per tracked item.** The AI must process all tracked items every turn, so avoid tracking "flavor" data — if a variable doesn't affect a trigger or a skill check, consider whether it needs to be tracked at all.

---

## Sub-Fields

### `name`
The item's identifier. A descriptive name helps the AI understand the item's purpose with minimal additional context. Used in the reference syntax and displayed to players when visibility allows.

**Reference syntax:** Items are referenced in instructions and effect data using `<<item_name>>` — spaces become underscores, text is lowercase. An item named "Gold Coins" is referenced as `<<gold_coins>>`. An item named "Current Date" is `<<current_date>>`.

### `dataType`
**Three options:**
- `text` — words, sentences, comma-separated lists. Good for: inventory lists, character states, location names, qualitative descriptions
- `number` — integers or decimals. Good for: health points, gold, turn counters, skill scores, relationship meters
- `xml` — structured data for advanced use cases: complex spell effects, multi-dimensional state, nested data structures. Requires understanding of XML formatting

### `visibility`
**Who can see the item's current value:**
- `everyone` — shown to both the player and the AI
- `ai_only` — shown only to the storyteller AI (hidden from the player's view)
- `player_only` — shown only to the player in the UI
- `nobody` — hidden from both; only accessible via trigger events

**CRITICAL:** Items with visibility `player_only` or `nobody` are invisible to the AI. **The AI cannot auto-update items it cannot see.** Items invisible to the AI can only be modified by trigger effects (`setTrackedItemsValue`).

### `description`
Context explaining what the tracked item represents. Example: "How many gold coins the player currently has." Helps the AI understand the item's purpose and update it correctly without needing lengthy `updateInstructions`.

### `updateInstructions`
Specific instructions for when and how the AI should modify this variable. This is the AI's direct rulebook for the item.

**Examples:**
- `"Update whenever I gain, earn, spend, or lose gold"`
- `"ALWAYS increase this counter by 1 every turn"`
- `"Set to the current location at the end of each turn"`
- `"Add items when picked up, remove items when used or dropped"`

Keep these instructions precise and unambiguous — the AI follows them literally.

**Disabling auto-update:** Set `autoUpdate: false` to give full control to trigger events. Useful when you need deterministic, trigger-driven changes rather than AI-interpreted updates.

### `initialValue`
The value the item starts with at game begin. Can be:
- A fixed value (same for all players and characters)
- Character-dependent: set to different values per player character in the `possibleCharacters` section
- Player-selectable: from a predefined menu during character creation (configured via `initialValueBasedOnPC`)

### `initialValueBasedOnPC`
Controls whether the initial value varies by player character. Defaults to `"same"` (fixed initial value for all). When set to enable character-specific values, players can select from a dropdown or predefined list during character creation.

### `autoUpdate`
Boolean (default `true`). When `true`, the AI automatically updates the item each turn following `updateInstructions`. When `false`, the item is only modified by trigger effects.

---

## Practical Guidance

**Use `secretInfo` for extra control:** Authors can simulate tracked items using `secretInfo` variables for greater control, particularly for triggering events or managing complex data structures that need deterministic behaviour.

**Visibility strategy:**
- Player-visible items create a visible HUD — use for resources, status, inventory the player should monitor
- AI-only items let you track state the player shouldn't see but the AI needs (hidden flags, internal counters)
- `nobody` items are only useful when trigger effects set and read them — purely mechanical state

**Avoid tracking flavor:** If a variable doesn't affect a trigger condition or a meaningful AI decision, it's probably not worth the per-turn processing cost. Move it to a narrative summary or `secretInfo` instead.
