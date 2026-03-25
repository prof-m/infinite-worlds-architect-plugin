# Infinite Worlds - Draft Markdown (.md) Schema

This document defines the official structure and formatting for `draft_world.md` files used by the Infinite Worlds Architect extension. These files serve as a human-readable intermediate format that is compiled into the final `world.json`.

## Structure Overview

A draft world is structured using Markdown headers:
- **H1 (`#`)**: Represents a top-level field in the world (e.g., `# Title`).
- **H2 (`##`)**: Represents an individual item within a complex array (e.g., `## Lilith` under `# NPCs`).
- **H3 (`###`)**: Represents a sub-field within a complex item (e.g., `### Appearance`).

---

## Root Fields (H1)

The following headers must appear at the start of a line. Content for each field starts on the line immediately following the header.

| Header | JSON Key | Description | Special Handling |
| :--- | :--- | :--- | :--- |
| `# Title` | `title` | The name of the world. | |
| `# Description` | `description` | A short blurb for users. | |
| `# Background` | `background` | The initial situation. | |
| `# First Action` | `firstInput` | The hidden Turn 0 prompt. | |
| `# Objective` | `objective` | The primary goal for the player. | |
| `# Main Instructions`| `instructions` | Core AI logic and constraints. | |
| `# Author Style` | `authorStyle` | Narrative tone and style. | |
| `# NSFW` | `nsfw` | Mature content flag. | `true` or `false` |
| `# Content Warnings` | `contentWarnings` | Comma-separated themes. | |
| `# Description Request`| `descriptionRequest`| POV and naming instructions. | |
| `# Summary Request` | `summaryRequest` | Instructions for Summary AI. | |
| `# Image Model` | `imageModel` | e.g., `manticore`. | |
| `# Image Style` | `imageStyle` | e.g., `photo_beautiful`. | |
| `# Image Style Character Pre` | `imageStyleCharacterPre` | Prompt prefix for characters. | |
| `# Image Style Character Post` | `imageStyleCharacterPost` | Prompt suffix for characters. | |
| `# Image Style Non Character Pre` | `imageStyleNonCharacterPre` | Prompt prefix for settings. | |
| `# Image Style Non Character Post`| `imageStyleNonCharacterPost`| Prompt suffix for settings. | |
| `# Victory Condition` | `victoryCondition` | Free-text condition for winning. | |
| `# Victory Text` | `victoryText` | Display message on victory. | |
| `# Defeat Condition` | `defeatCondition` | Free-text condition for losing. | |
| `# Defeat Text` | `defeatText` | Display message on defeat. | Default: "Your adventure ends here. Game over." |
| `# Design Notes` | `designNotes` | Personal notes, NOT sent to AI. | |
| `# Player Permissions` | *(multiple boolean keys)* | Player customization permissions. | Key: Value pairs (see below) |
| `# Enable AI Specific Instruction Blocks` | `enableAISpecificInstructionBlocks` | Restrict EIBs to specific AI models. | `true` or `false` |
| `# Skills` | `skills` | List of world-wide skills. | Bulleted list (`- Skill`) |

---

## Complex Fields (H1)

Complex fields contain multiple items. Each item starts with an **H2 (`##`)** header containing the item's name.

### `# Possible Characters` (Maps to `possibleCharacters`)
Player character options.
- **H2**: Character Name (`name`)
- **H3 `Description`**: `description`
- **H3 `Portrait`**: `portrait`
- **H3 `Skills`**: `skills` (JSON object: `{"Skill": Level}`)

### `# Other Characters` (Maps to `NPCs`)
Non-player characters.
- **H2**: Character Name (`name`)
- **H3 `Brief Summary`**: `one_liner`
- **H3 `Character Detail`**: `detail`
- **H3 `Appearance`**: `appearance`
- **H3 `Location`**: `location`
- **H3 `Secret Information`**: `secret_info`
- **H3 `Full List of Names`**: `names` (JSON array of strings)
- **H3 `Image Appearance`**: `img_appearance`
- **H3 `Image Clothing`**: `img_clothing`

### `# Extra Instruction Blocks` (Maps to `instructionBlocks`)
- **H2**: Block Name (`name`)
- **H3 `Content`**: `content`

### `# Keyword Instruction Blocks` (Maps to `loreBookEntries`)
- **H2**: Block Name (`name`)
- **H3 `Keywords`**: `keywords` (JSON array of strings)
- **H3 `Content`**: `content`

### `# Tracked Items` (Maps to `trackedItems`)
- **H2**: Item Name (`name`)
- **H3 `Data Type`**: `dataType` (`text`, `number`, or `xml`)
- **H3 `Visibility`**: `visibility` (`everyone`, `ai_only`, `player_only`, or `nobody`)
- **H3 `Description`**: `description`
- **H3 `Update Instructions`**: `updateInstructions`
- **H3 `Initial Value`**: `initialValue`
- **Internal**: `initialValueBasedOnPC` (defaults to `"same"`)
- **Internal**: `autoUpdate` (defaults to `true`)

### `# Trigger Events` (Maps to `triggerEvents`)
- **H2**: Trigger Name (`name`)
- **H3 `Conditions`**: `triggerConditions` (Markdown list where data is on subsequent lines or code blocks: `- type:\n \`\`\`\n data \`\`\``)
- **H3 `Effects`**: `triggerEffects` (Markdown list where data is on subsequent lines or code blocks: `- type:\n \`\`\`\n data \`\`\``)
- **H3 `Can Trigger More Than Once`**: `canTriggerMoreThanOnce` (`true` or `false`, default `false`)
- **H3 `Prerequisites`**: `prerequisites` (comma-separated trigger IDs that must have fired previously)
- **H3 `Blockers`**: `blockers` (comma-separated trigger IDs that must NOT have fired)

---

## `# Player Permissions` Format

The `# Player Permissions` section uses a simple `Key: Value` format where each line maps to a boolean field:

```markdown
# Player Permissions
Can Change Name: true
Can Change Description: true
Can Change Skills: true
Can Select Other Portraits: false
Can Create New Portrait: true
Can Change Tracked Items Starting Values: false
```

| Draft Key | JSON Key | Default |
| :--- | :--- | :--- |
| `Can Change Name` | `canChangeCharacterName` | `true` |
| `Can Change Description` | `canChangeCharacterDescription` | `true` |
| `Can Change Skills` | `canChangeCharacterSkills` | `true` |
| `Can Select Other Portraits` | `canSelectOtherPortraits` | `false` |
| `Can Create New Portrait` | `canCreateNewPortrait` | `true` |
| `Can Change Tracked Items Starting Values` | `canChangeTrackedItemsStartingValues` | `false` |

---

## Formatting Rules

### 1. Code Block Wrapping
Any field value (especially long instruction content) can be wrapped in triple backticks:
\```text
Some long content here...
\```
The compiler will automatically strip these backticks and any language identifier (like `text`). This is recommended for instruction blocks to prevent Markdown editors from misinterpreting AI syntax.

### 2. Sub-field Formats
Inside an H2 item, sub-fields can be defined in two ways:
1.  **H3 Subheaders (Recommended)**:
    ```markdown
    ### Appearance
    Pale skin, black hair.
    ```
2.  **Key: Value Pairs**:
    ```markdown
    Appearance: Pale skin, black hair.
    ```
The compiler supports both, but H3 headers are preferred for complex, multi-line content.

### 3. Lists
For `# Skills` and `Possible Characters (Skills)`, use standard Markdown lists:
- `- Key: Value` (for skills)
- `- Value` (for root skills list)

For `# Trigger Events (Conditions/Effects)`, the compiler parses items starting with `- type: ` followed by a multiline data block or code block. Using a code block is recommended for complex or JSON data.
