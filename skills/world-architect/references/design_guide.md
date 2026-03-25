# Infinite Worlds - World Design Guide

An Infinite Worlds "World" is the underlying logic and creative setup that drives a story. It consists of several key sections that define the rules, setting, and systems.

## Standard Sections

1.  **Introducing the Story**
    - **Title** (`title`): The name of the world.
    - **Description** (`description`): A short blurb for users to read before playing.
    - **Story Background** (`background`): The initial situation or premise of the story.
    - **First Action** (`firstInput`): The hidden prompt that sets the scene for the Storytelling AI.
    - **Objective** (`objective`): The primary goal for the player.

2.  **Main Instructions**
    - **Main Instructions** (`instructions`): The core of the world's decision-making logic.
    - **Extra Instruction Blocks** (`instructionBlocks`): Separated blocks of instructions appended to the Main Instructions that can be modified via triggers or restricted to specific AI models (`enableAISpecificInstructionBlocks`).
    - **Author Style** (`authorStyle`): Defines how the AI should react, the tone of the narrative, and general world rules.
    - **Mature Content** (`nsfw`) & **Content Warnings** (`contentWarnings`): Optional flags to categorize the world's themes.
    - **Design Notes** (`designNotes`): An optional field for personal notes or original prompts, not sent to the AI.

3.  **Image Style**
    - Specifies the art style (`imageStyle`) and model (`imageModel`) for image generation. Utilizes models like Flux.1, Manticore, and Wyvern.
    - **LoRAs/Tags**: Can use specific keywords (e.g., `IWAnime`, `IWUpsaleFace`) to trigger specific behaviors.
    - **Wrappers**: Provides pre/post text for characters (`imageStyleCharacterPre`, `imageStyleCharacterPost`) and settings (`imageStyleNonCharacterPre`, `imageStyleNonCharacterPost`).

4.  **Player Character Options**
    - Defines the player's starting state and customization permissions (`possibleCharacters`).
    - **Skills** (`skills`): A list of attributes rated 0-5 (0 = Incapable, 1 = Incompetent, 2 = Unskilled, 3 = Competent, 4 = Highly Skilled, 5 = Exceptional).
    - Each character has a `name`, `description`, `portrait`, and specific `skills` mapping.

5.  **Victory and Defeat**
    - Defines the conditions under which a story ends in a win or loss (`victoryCondition`, `defeatCondition`).
    - These are periodically evaluated by the AI as special situational triggers, though they can be disabled entirely in favor of custom end conditions.

## Advanced Sections

6.  **Other Characters (NPCs)**
    - A library of predefined characters used to populate the character database at game start (`otherCharacters` or updated via Summary AI).
    - Each character has a description, traits, location, secret info, and comma-separated name variants. The Summary AI updates their records as the game progresses.

7.  **Keyword Instruction Blocks (Lore Books)**
    - Conditional instruction blocks that are appended to the main prompt for the next three turns when specific keywords are detected in the player's action or AI's output.
    - Used to manage large amounts of lore or specific mechanical rules without bloating the main instructions.

8.  **Tracked Items (Variables)** (`trackedItems`)
    - Variables used to store state, handled via an array of objects.
    - **Types** (`dataType`): `text`, `number`, or `xml`.
    - **Visibility** (`visibility`): `everyone`, `ai_only`, `player_only`, or `nobody`.
    - **Update Instructions** (`updateInstructions`): Specific instructions for the AI on how to modify this variable. Initial values can also be set (`initialValue`) or depend on the chosen character (`initialValueBasedOnPC`).

9.  **Trigger Events** (`triggerEvents`)
    - Conditional logic evaluated each turn that executes effects (e.g., modifying tracked items, sending messages, ending the game, modifying skills or objectives) when specific conditions (like specific turn numbers, tracked item values, or situations) are met.
    - Contains `triggerConditions` (the requirements) and `triggerEffects` (the resulting actions).

10. **Misc Advanced Features**
    - **Description Instructions** (`descriptionRequest`): Extremely powerful instructions that can enforce point-of-view, tense, naming rules, and force variables to be written into `secretInfo`.
    - **Summary Instructions** (`summaryRequest`): Directs the Summary AI (which runs every 6 turns starting on Turn 8). Note: The Summary AI cannot see Tracked Items, but it can track plot threads and update character records based on recent context.
    - **Variable List/Equation Tester**: Tools for debugging world logic and math functions.
    - **JSON Viewer & Import**: Allows full raw-data editing of the world logic.
