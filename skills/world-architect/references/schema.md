# Infinite Worlds - world.json Schema

The `world.json` file is the ultimate source of truth for world definitions. Below is the structured schema based on the platform's export format.

**Note**: For information on the human-readable Markdown format used during world development, see **[draft_schema.md](draft_schema.md)**.

## Root Properties

| Key | Type | Description |
| :--- | :--- | :--- |
| `title` | string | The name of the world. |
| `description` | string | User-facing blurb. |
| `background` | string | Initial story situation. |
| `instructions` | string | Main decision-making logic for the AI. |
| `authorStyle` | string | Writing style/tone (e.g., "Gritty Noir"). |
| `firstInput` | string | The hidden turn 0 prompt. |
| `objective` | string | The player's primary goal. |
| `nsfw` | boolean | Mature content flag. |
| `contentWarnings` | string | Comma-separated themes. |
| `descriptionRequest`| string | Specialized instructions for character descriptions and POV. |
| `summaryRequest` | string | Instructions for the Summary AI. |
| `imageModel` | string | e.g., "manticore", "flux.1-schnell". |
| `imageStyle` | string | e.g., "photo_beautiful". |
| `imageStyleCharacterPre` | string | Prefix for character image prompts. |
| `imageStyleCharacterPost` | string | Suffix for character image prompts (contains LoRAs like `IWUpscaleFaceSmooth`). |
| `imageStyleNonCharacterPre`| string | Prefix for setting image prompts. |
| `imageStyleNonCharacterPost`| string | Suffix for setting image prompts. |
| `skills` | string[] | Array of skill names (e.g., `["Strength", "Persuasion"]`). |
| `possibleCharacters` | object[] | Array of character objects (see below). |
| `NPCs` | object[] | Array of NPC objects (see below). |
| `trackedItems` | object[] | Array of tracked variable objects (see below). |
| `triggerEvents` | object[] | Array of conditional logic objects (see below). |
| `instructionBlocks` | object[] | Array of Extra Instruction Blocks (see below). |
| `loreBookEntries` | object[] | Array of Keyword Instruction Blocks (see below). |

## possibleCharacters

Each object in `possibleCharacters` contains:
- `name` (string)
- `description` (string)
- `characterId` (string, unique 8-char code)
- `skills` (object: `{ "SkillName": integer }`)
- `portrait` (string, image filename)

## NPCs

Each object in `NPCs` contains:
- `id` (string, unique ID)
- `name` (string)
- `detail` (string, Character Detail)
- `one_liner` (string, Brief Summary)
- `appearance` (string)
- `location` (string)
- `secret_info` (string)
- `names` (string[], Full List of Names)

## trackedItems

Each object in `trackedItems` contains:
- `id` (string, unique ID)
- `name` (string)
- `dataType` (string: "text", "number", "xml")
- `visibility` (string: "everyone", "ai_only", "player_only", "nobody")
- `description` (string)
- `updateInstructions` (string)
- `initialValue` (string)
- `initialValueBasedOnPC` (string: defaults to "same")
- `autoUpdate` (boolean: defaults to true)

## triggerEvents

Each object in `triggerEvents` contains:
- `id` (string, unique ID)
- `name` (string)
- `canTriggerMoreThanOnce` (boolean, default false — if false, fires once max; if true, can fire every eligible turn)
- `prerequisites` (string[], trigger IDs that must have fired previously before this trigger can fire)
- `blockers` (string[], trigger IDs that must NOT have fired previously — blocks this trigger if any have fired)
- `triggerConditions` (object[])
- `triggerEffects` (object[])

**Note**: ALL conditions on a single trigger must be met simultaneously (AND logic).

### triggerConditions

Each object in `triggerConditions` contains:
- `id` (string, unique UUID)
- `type` (string, one of the condition types below)
- `data` (mixed, depends on type)
- `category` (string: "condition" or "logic")

#### All Condition Types (9)

| Condition | Field | Data Type | Description |
| :--- | :--- | :--- | :--- |
| Trigger On Event | `triggerOnEvent` | string | AI-evaluated free-form situation description. Max 10 custom situations per world. |
| Trigger On Turn | `triggerOnTurn` | integer | Fires when turn number >= value. |
| Trigger At Game Start | `triggerOnStartOfGame` | boolean | Fires before turn 0. |
| Trigger On Character | `triggerOnCharacter` | string[] | Restricts trigger to specific player characters (by characterId). |
| Trigger On Tracked Item | `triggerOnTrackedItem` | object | Operators: `at_least`, `is_exactly`, `at_most` (numbers); `contains` (text/XML); supports `and`/`or` logic. |
| Random Chance | `triggerOnRandomChance` | integer (1-100) | Percentage chance of firing each eligible turn. |
| Prerequisites | `prerequisites` | string[] | Trigger IDs that must have fired previously. |
| Blockers | `blockers` | string[] | Trigger IDs that must NOT have fired previously. |
| Allow Multiple | `canTriggerMoreThanOnce` | boolean | If false (default): fires once max; if true: can fire every eligible turn. |

### triggerEffects

Each object in `triggerEffects` contains:
- `id` (string, unique UUID)
- `type` (string, one of the effect types below)
- `data` (mixed, depends on type)

#### All Effect Types (17)

| Effect | Field | Data Type | Description |
| :--- | :--- | :--- | :--- |
| Show Message | `scriptedText` | string | Appends text to outcomeDescription. |
| AI Guidance | `giveGuidance` | string | Instructs AI for next turn only. |
| Secret Info | `addSecretInfo` | string | Adds hidden info to secretInfo. |
| Change Background | `changeAdventureBackground` | string | Modifies displayed story background. |
| Change Main Instructions | `changeInstructions` | string | Fully replaces primary instruction block. |
| Modify Instruction Block | `changeInstructionBlock` | object {id, content} | Replaces content of a specific Extra Instruction Block. |
| Change Author Style | `changeAuthorStyle` | string | Replaces writing style. |
| Change Description Instructions | `changeDescriptionInstructions` | string | Modifies description writing guidelines. |
| Change Objective | `changeObjective` | string | Replaces player objective. |
| Change Victory Condition | `changeVictoryCondition` | object {condition, text, alreadyFired} | Modifies victory rules. |
| Change Defeat Condition | `changeDefeatCondition` | object {condition, text, alreadyFired} | Modifies defeat rules. |
| Change First Action | `changeFirstAction` | string | Modifies initial turn action. |
| Modify Player Character | `changeName`/`changeDescription`/`changeSkill` | various; changeSkill: {name, amount, minmax, increase} | Modifies active player character. |
| Set Tracked Item Values | `setTrackedItemsValue` | array | Batch update tracked items. Text/XML: set/add/subtract(remove)/replace; Numbers: set/add/subtract. |
| Fire Random Trigger | `randomTriggers` | string[] | Randomly fires one of specified trigger IDs (ignores their conditions except "trigger once"). |
| Modify Keyword Block | `changeLorebook` | object {id, keywords[], content} | Modifies a keyword instruction block. |
| End Game | `endsGame` | boolean | Terminates session; `canContinueEndedGame` allows continuation. |

**Note**: Variable replacement syntax `<<item_name>>` works in all effect data fields.

## instructionBlocks

Each object in `instructionBlocks` (Extra Instruction Blocks) contains:
- `id` (string, unique ID)
- `name` (string)
- `content` (string)

## loreBookEntries

Each object in `loreBookEntries` (Keyword Instruction Blocks) contains:
- `id` (string, unique ID)
- `name` (string)
- `content` (string)
- `keywords` (string[])
