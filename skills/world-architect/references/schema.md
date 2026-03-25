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
| `victoryCondition` | string | Free-text condition for winning. |
| `victoryText` | string | Display message on victory. |
| `defeatCondition` | string | Free-text condition for losing. |
| `defeatText` | string | Display message on defeat. Default: "Your adventure ends here. Game over." |
| `designNotes` | string | Personal notes field, NOT sent to AI. For author reference only. |
| `canChangeCharacterName` | boolean | Allow player to change character name. Default: `true`. |
| `canChangeCharacterDescription` | boolean | Allow player to change character description. Default: `true`. |
| `canChangeCharacterSkills` | boolean | Allow player to redistribute skill levels (without exceeding original total). Default: `true`. |
| `canSelectOtherPortraits` | boolean | Allow player to select other portraits. Default: `false`. |
| `canCreateNewPortrait` | boolean | Allow player to create a new portrait. Default: `true`. |
| `canChangeTrackedItemsStartingValues` | boolean | Allow player to change tracked items starting values. Default: `false`. |
| `enableAISpecificInstructionBlocks` | boolean | Allows restricting EIBs to specific AI models. Default: `false`. |
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
- `img_appearance` (string, Image generation appearance text)
- `img_clothing` (string, Image generation clothing text)

## Player Customization Permissions

These boolean fields control what the player can customize before starting the adventure:

| Key | Default | Description |
| :--- | :--- | :--- |
| `canChangeCharacterName` | `true` | Allow player to change character name. |
| `canChangeCharacterDescription` | `true` | Allow player to change character description. |
| `canChangeCharacterSkills` | `true` | Allow player to redistribute skill levels without exceeding original total. |
| `canSelectOtherPortraits` | `false` | Allow player to select other portraits. |
| `canCreateNewPortrait` | `true` | Allow player to create a new portrait. |
| `canChangeTrackedItemsStartingValues` | `false` | Allow player to change tracked items starting values. |

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
- `triggerConditions` (object[]):
    - `type` (string: "triggerOnTurn", "triggerOnTrackedItem", "triggerOnEvent", "triggerOnRandomChance")
    - `data` (mixed: integer for turn, string for event, object for tracked items)
- `triggerEffects` (object[]):
    - `type` (string: "effectTellAIWhatToDo", "effectGiveInfo", "effectShowMessage", "effectSetTrackedItem", etc.)
    - `data` (string or object)

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
