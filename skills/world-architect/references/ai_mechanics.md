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

### Keyword Instruction Blocks

These act like "Lore Books" that are only injected when specific keywords appear in the recent context (player input or AI output). Once triggered, they are included for the next three turns. This saves context and ensures relevant rules are applied only when needed.

### Tracked Item Updates

The AI is instructed to update variables based on the `outcomeDescription`. Use clear "Update Instructions" for each variable to ensure consistency. Tracked items can be Text, Number, or XML, and their visibility can be configured for the player, AI, neither, or both.

### Trigger Events

Trigger Events (`triggerEvents` in JSON) are the procedural logic engine of Infinite Worlds. Each trigger defines a set of **conditions** that must all be met (AND logic) and a set of **effects** that fire when those conditions are satisfied.

**Variable replacement**: The syntax `<<item_name>>` works in all effect data fields, inserting the current value of the referenced tracked item or character attribute at runtime.

#### Meta-Fields

- **`canTriggerMoreThanOnce`** (boolean, default false): When false, the trigger fires at most once per playthrough. When true, it can fire every turn its conditions are met.
- **`prerequisites`** (string[]): A list of trigger IDs that must have already fired before this trigger becomes eligible. Example: a "Chapter 2" trigger can require the "Chapter 1 Complete" trigger as a prerequisite.
- **`blockers`** (string[]): A list of trigger IDs that prevent this trigger from firing if any of them have already fired. Example: a "peaceful resolution" trigger can be blocked by an "attacked the guard" trigger.

#### Condition Types (9)

All conditions on a single trigger are evaluated with AND logic — every condition must be satisfied simultaneously for the trigger to fire.

1. **Trigger On Event** (`triggerOnEvent`, string): An AI-evaluated free-form situation description. The AI determines whether the described situation has occurred. Max 10 custom event conditions per world. Example: `"The player has entered the haunted forest"`.

2. **Trigger On Turn** (`triggerOnTurn`, integer): Fires when the current turn number is greater than or equal to the specified value. Example: `5` fires on turn 5 and every subsequent turn (unless limited by `canTriggerMoreThanOnce: false`).

3. **Trigger At Game Start** (`triggerOnStartOfGame`, boolean): Fires before turn 0, during game initialization. Useful for setting up initial state or delivering opening exposition.

4. **Trigger On Character** (`triggerOnCharacter`, string[]): Restricts the trigger to specific player characters by their `characterId`. The trigger only fires if the active player character matches one of the listed IDs.

5. **Trigger On Tracked Item** (`triggerOnTrackedItem`, object): Evaluates a tracked item against a threshold. Operators for numbers: `at_least`, `is_exactly`, `at_most`. Operator for text/XML: `contains`. Supports compound logic with `and`/`or` grouping. Example: `{ "name": "health", "operator": "at_most", "value": 20 }`.

6. **Random Chance** (`triggerOnRandomChance`, integer 1-100): A percentage probability that the trigger fires on each eligible turn. Example: `25` means a 25% chance each turn.

7. **Prerequisites** (`prerequisites`, string[]): Trigger IDs that must have fired previously. See meta-fields above.

8. **Blockers** (`blockers`, string[]): Trigger IDs that must NOT have fired previously. See meta-fields above.

9. **Allow Multiple** (`canTriggerMoreThanOnce`, boolean): Controls whether the trigger can fire more than once. See meta-fields above.

#### Effect Types (17)

When a trigger fires, all of its effects execute. Effects can modify nearly every aspect of the world state.

1. **Show Message** (`scriptedText`, string): Appends the specified text directly to `outcomeDescription`. Use for scripted narrative beats. Example: `"A thunderous explosion shakes the ground beneath your feet."`.

2. **AI Guidance** (`giveGuidance`, string): Provides a one-turn instruction to the AI. The guidance is only active for the immediate next turn, then discarded. Example: `"The merchant should act suspicious and evasive this turn."`.

3. **Secret Info** (`addSecretInfo`, string): Adds hidden information to `secretInfo`, invisible to the player but available to the AI for future decision-making. Example: `"The NPC is secretly an undercover agent."`.

4. **Change Background** (`changeAdventureBackground`, string): Replaces the displayed story background. Example: `"The kingdom has fallen into civil war."`.

5. **Change Main Instructions** (`changeInstructions`, string): Fully replaces the primary instruction block. Use with caution — this overrides all existing main instructions.

6. **Modify Instruction Block** (`changeInstructionBlock`, object `{id, content}`): Replaces the content of a specific Extra Instruction Block by its `id`. Allows surgical updates to modular instruction sections without touching the main instructions.

7. **Change Author Style** (`changeAuthorStyle`, string): Replaces the writing style. Example: switching from `"Lighthearted Fantasy"` to `"Dark Horror"` mid-story.

8. **Change Description Instructions** (`changeDescriptionInstructions`, string): Modifies the description writing guidelines (`descriptionRequest`). Useful for shifting narrative perspective or descriptive focus.

9. **Change Objective** (`changeObjective`, string): Replaces the player's displayed objective. Example: `"Escape the collapsing dungeon before time runs out."`.

10. **Change Victory Condition** (`changeVictoryCondition`, object `{condition, text, alreadyFired}`): Modifies victory rules. `condition` defines the new win state, `text` is the victory message, and `alreadyFired` (boolean) indicates if the condition was already met.

11. **Change Defeat Condition** (`changeDefeatCondition`, object `{condition, text, alreadyFired}`): Modifies defeat rules. Same structure as victory condition.

12. **Change First Action** (`changeFirstAction`, string): Modifies the initial turn action (`firstInput`). Only meaningful for triggers that fire at game start.

13. **Modify Player Character** (`changeName`/`changeDescription`/`changeSkill`, various): Modifies the active player character. `changeName` (string) updates the name. `changeDescription` (string) updates the description. `changeSkill` (object `{name, amount, minmax, increase}`) modifies a skill: `name` identifies the skill, `amount` is the target/delta value, `minmax` constrains the range, and `increase` (boolean) determines whether to add or set.

14. **Set Tracked Item Values** (`setTrackedItemsValue`, array): Batch update tracked items. Each entry specifies the item and an operation:
    - **Numbers**: `set` (absolute value), `add` (increase by), `subtract` (decrease by).
    - **Text/XML**: `set` (replace entirely), `add` (append), `subtract`/`remove` (remove matching text), `replace` (find-and-replace).
    - Example: `[{ "name": "gold", "operator": "add", "value": 50 }]`.

15. **Fire Random Trigger** (`randomTriggers`, string[]): Randomly selects and fires one trigger from the specified list of trigger IDs. The selected trigger's conditions are **ignored** — it fires unconditionally — except for the "trigger once" constraint (`canTriggerMoreThanOnce: false` is still respected).

16. **Modify Keyword Block** (`changeLorebook`, object `{id, keywords[], content}`): Modifies an existing keyword instruction block (lore book entry) by its `id`. Can update both the keywords and the content.

17. **End Game** (`endsGame`, boolean): Terminates the game session. The companion field `canContinueEndedGame` (boolean) on the world root allows the player to continue playing after the game has ended.

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
