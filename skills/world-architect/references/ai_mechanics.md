# Infinite Worlds - AI Mechanics & Instruction Syntax

This reference document outlines the technical mechanisms used by the Storyteller AI in Infinite Worlds to generate and manage story data.

## Instruction Syntax

- **Variable Calls**: Use `<<variable_name>>` to insert the current value of a tracked item or character attribute into an instruction.
    - Example: `Whenever the player uses <<skill_persuasion>>, apply a bonus to the outcome.`
- **Context Injection**: The AI is provided with several predefined variables each turn:
    - `playerAction`: The player's input.
    - `description`: The player character's background and description.
    - `objective`: The current story goal.
    - `background`: The world's overarching backstory.

## AI-Generated Variables (JSON Fields)

The Storyteller AI populates these fields in a specific order. You can influence their generation through instructions in the **Main Instructions** section.

### Outcome Fields
- **evaluation**: (String) A mandatory assessment of the action's feasibility (e.g., `SUCCESS`, `FAILURE`, `DENIED`).
- **whereWhen**: (String) The current time and location (e.g., `11pm Friday, in the swamps`).
- **outcomeDescription**: (String) The main narrative response, adhering to the world's **Author Style**.
- **secretInfo**: (String) Hidden lore and motivations for story progression.
- **optionN_text**: (String) Three suggested options for the player's next move (`option1_text`, `option2_text`, `option3_text`).
- **stateVariablesUpdates**: (JSON Dict) Key-value pairs of tracked item updates.
- **triggerEvents**: (String) Letters corresponding to any trigger events that were activated.

### Illustration Fields
- **illustrSubject**: (String) The primary subject for image generation (never the player unless specifically requested).
- **illustrIsCharacter**: (Boolean) True if the subject is a person/creature.
- **illustrAppearance**: (String) Brief description (age, ancestry, description, hair/eyes/skin).
- **illustrClothes**: (String) Current clothing (excluding footwear).
- **illustrExpressionPosition**: (String) Facial expression and body pose (e.g., `friendly, sitting on a bench`).
- **illustrSetting**: (String) Brief description of the environment and time of day.

## Logic and Triggers

- **Keyword Instruction Blocks**: These act like "Lore Books" that are only injected when specific keywords appear in the recent context (player input or AI output). Once triggered, they are included for the next three turns. This saves context and ensures relevant rules are applied only when needed.
- **Trigger Events** (`triggerEvents` in JSON): Procedural logic defined by specific conditions.
    - **Conditions** (`triggerConditions`): Criteria defined by `type` (e.g., `triggerOnTurn`, `triggerOnTrackedItem`, `triggerOnEvent`). The value is stored in `data`.
    - **Effects** (`triggerEffects`): The resulting actions defined by `type` (e.g., `effectTellAIWhatToDo`, `effectGiveInfo`, `effectShowMessage`). The value is stored in `data`.
- **Tracked Item Updates**: The AI is instructed to update variables based on the `outcomeDescription`. Use clear "Update Instructions" for each variable to ensure consistency. Tracked items can be Text, Number, or XML, and their visibility can be configured for the player, AI, neither, or both.

## System Mechanics

### Time Tracking
Infinite Worlds tracks time using a hidden variable called `whereWhen` (e.g., `Mission Street, San Francisco, at 17:35 on Tuesday`). 
- **Improvement**: AI models often struggle with chronological reasoning. To improve consistency, authors can mandate that the AI explicitly prints `whereWhen` at the beginning of `outcomeDescription` or `secretInfo` every turn, or create a specific Tracked Item to overwrite the default behavior.

### Skill Evaluation
The AI evaluates player actions by determining a "DifficultyScore" for the task and comparing it against the player's proficiency in the most relevant skill (rated 0 to 5).
- **Modification**: Authors can overwrite the hidden default evaluation rules by writing new evaluation logic in the **Main Instructions**. For example, one can explicitly instruct the AI to break down complex multi-part actions into sequential checks, or introduce a "dice roll" element (e.g., `Skill + 1d6 vs Difficulty`) to reduce the AI's tendency toward binary pass/fail states.

## Author Style Guidelines

- **Consistency**: The AI should maintain a consistent voice. If the style is defined as "Gritty Noir", avoid flowery fantasy language.
- **Proactivity**: Higher-tier models (like "Lion" or "Smilodon") are more proactive in driving the story forward rather than waiting for the player.
- **Descriptive Depth**: Use `outcomeDescription` to provide sensory details while keeping `whereWhen` and `evaluation` concise.
