# Field Guide: Trigger Events

JSON key: `triggerEvents` — array of trigger objects

Each trigger has: `id`, `name`, `canTriggerMoreThanOnce`, `prerequisites`, `blockers`, `triggerConditions`, `triggerEffects`

Conditions and effects each use a `{ "id": "...", "type": "...", "data": ... }` structure.

---

## How Triggers Work

Triggers are evaluated at the **end of each turn**, in sequence (list order matters). All conditions on a single trigger are evaluated with AND logic — every condition must be met simultaneously for the trigger to fire. When conditions are met, all effects execute.

**Default behaviour:** A trigger fires at most **once per playthrough** unless `canTriggerMoreThanOnce: true` is set.

---

## Meta-Fields

### `canTriggerMoreThanOnce` (boolean, default `false`)
- `false`: fires exactly once, then never again — even if conditions are met again
- `true`: fires every turn its conditions are met

### `prerequisites` (string[] of trigger IDs)
Trigger IDs that must have already fired before this trigger becomes eligible. If a prerequisite fires on the same turn, it satisfies the condition only if it appears earlier in the trigger list.

### `blockers` (string[] of trigger IDs)
Trigger IDs that permanently prevent this trigger from firing if any of them have already fired. Same ordering rule as prerequisites.

**Note:** `prerequisites` and `blockers` reference trigger `id` values (UUIDs), not trigger names.

---

## All Condition Types

Valid `type` values for `triggerConditions`:

| Type | Data | Description |
|---|---|---|
| `triggerOnEvent` | string | AI-evaluated free-form situation. Max 10 per world. Most flexible but can produce false positives/negatives. Use very explicit language. |
| `triggerOnTurn` | integer | Fires when turn number >= value. Combine with `canTriggerMoreThanOnce: true` for recurring triggers. |
| `triggerOnStartOfGame` | boolean (`true`) | Fires before turn 0, before the player acts. Some effects are locked/unlocked compared to normal triggers. |
| `triggerOnCharacter` | string[] (characterIds) | Restricts to specific player characters. Use `characterId` values, not character names. |
| `triggerOnTrackedItem` | object | Evaluates a tracked item against a threshold. Numbers: `at_least`/`is_exactly`/`at_most`. Text/XML: `contains`. Supports `and`/`or` compound logic. |
| `triggerOnRandomChance` | integer (1–100) | Percentage chance per eligible turn. |

---

## All Effect Types

Valid `type` values for `triggerEffects` (from `VALID_EFFECT_TYPES` in `lib/helpers.js`):

### Narrative Effects
| Type | Data | Description |
|---|---|---|
| `scriptedText` | string | Appends text to `outcomeDescription` after turn resolution. For scripted narrative beats. |
| `effectTellAIWhatToDo` | string | One-turn instruction to the AI. Most reliable effect for directing the narrative — active for the next turn only, then discarded. |
| `effectGiveInfo` | string | Writes to `secretInfo`. Suggestive, not directive — the AI considers it but may not act on it. Summary AI weights `secretInfo` heavily. |

### World State Effects
| Type | Data | Description |
|---|---|---|
| `changeAdventureBackground` | string | Replaces the background text shown to players and the storyteller AI. |
| `changeInstructions` | string | Fully replaces main instructions. Future reverts require another trigger. Use with caution. |
| `changeInstructionBlock` | `{id, content}` | Replaces a specific Extra Instruction Block by its `id`. Surgical alternative to `changeInstructions`. |
| `changeAuthorStyle` | string | Fully replaces author style. Useful for genre transitions mid-story. |
| `changeDescriptionInstructions` | string | Fully replaces description request. |
| `changeObjective` | string | Replaces player objective. AI prioritises this strongly — powerful for silent story redirection. Supports `<<item_name>>` syntax. |
| `changeVictoryCondition` | `{condition, text, alreadyFired}` | Modifies victory rules. No narrative effect — engine-only evaluation. |
| `changeDefeatCondition` | `{condition, text, alreadyFired}` | Modifies defeat rules. Engine-only evaluation. |
| `changeFirstAction` | string | Modifies the opening turn prompt. Most meaningful in `triggerOnStartOfGame` triggers. |

### Character Effects
| Type | Data | Description |
|---|---|---|
| `changeName` | string | Fully replaces the player character's name. |
| `changeDescription` | string | Fully replaces the player character's description. |
| `effectChangePCSkill` | `{name, amount, minmax, increase}` | Adjusts one skill level. `name`: skill name. `amount`: adjustment magnitude. `minmax`: cap value. `increase` (boolean): true=increase, false=decrease. One skill per trigger. |

### Tracked Item Effects
| Type | Data | Description |
|---|---|---|
| `setTrackedItemsValue` | array of `{trackedItemID, action, newValue, replaceWith}` | Batch update tracked items. Numbers: `set`/`add`/`subtract`. Text/XML: `set`/`add`/`subtract`(remove)/`replace`(find-and-replace). Supports `<<item_name>>` syntax. |

### Control Flow Effects
| Type | Data | Description |
|---|---|---|
| `randomTriggers` | string[] (trigger IDs) | Randomly fires one trigger from the list, ignoring its conditions (except `canTriggerMoreThanOnce`). Use for trigger chaining to work around the single-effect-per-trigger limit. |
| `changeLorebook` | `{id, keywords[], content}` | Replaces a KIB's keywords and content by its `id`. One-turn delay before the replacement takes effect. |
| `endsGame` | boolean (`true`) | Terminates the session. Set `canContinueEndedGame: true` on the world root to allow post-end continuation (for victory-style endings). |

---

## Variable Replacement

The syntax `<<item_name>>` works in all effect data string fields. References are resolved at runtime using the current value of the named tracked item (spaces→underscores, lowercase). Also supports math functions like `<<1d20>>` for random numbers.

---

## Key Constraints

1. **AND logic only** — all conditions on one trigger must be met simultaneously. For OR logic, create multiple triggers.
2. **Single-effect workaround** — if you need to modify multiple tracked items simultaneously, use `setTrackedItemsValue` (which accepts an array) or chain triggers via `randomTriggers`.
3. **Evaluation order matters** — prerequisites and blockers only recognise triggers that fired earlier in the same evaluation pass (same turn, earlier in the list).
4. **Pre-game triggers** — `triggerOnStartOfGame` fires before turn 0; some effects behave differently or are unavailable.
5. **`triggerOnEvent` limit** — maximum 10 AI-evaluated event conditions per world. Each is an additional AI evaluation cost.
