# Infinite Worlds - Story Data Structure

The Infinite Worlds story export format (typically found in `.txt` files) captures the progression of an adventure. It contains the world-building setup, the player character's state, and the turn-by-turn history of actions and outcomes.

## Header and Metadata

- **Story Title**: Identified by `== Story Name ==`.
- **Story Background**: A narrative summary of the starting situation.
- **Initial Character Sheet**:
    - **Name**: The player character's name.
    - **Background**: The character's history and starting traits.
    - **Skills**: A list of attributes with their values and proficiency labels (e.g., `Empathy: 2 (Unskilled)`).

## Turn-by-Turn History

Each turn (e.g., `-- Turn 1 --`) consists of several mandatory and optional fields, which map to the Storyteller AI's generated variables:

1.  **Action** (Required for Player Turns)
    - The literal action text input by the player (e.g., `"I search the desk for any hidden compartments."`).
    - Also referred to as `playerAction` in world instructions.

2.  **Outcome** (`outcomeDescription`) (Required)
    - The Storyteller AI's response to the player's action.
    - Describes the resulting events, dialogue, and environment changes.
    - Written in the specified **Author Style**.

3.  **Objective** (`objective`) (Persistent)
    - The current goal for the player, which may evolve over the course of the story.

4.  **Secret Information** (`secretInfo`) (AI/Author Facing)
    - Lore or mechanical details hidden from the player but stored for AI reference and story progression.
    - Used for tracking NPC motivations, hidden events, or complex magical effects.

5.  **Tracked Items (State Variables)** (`stateVariablesUpdates`)
    - Displays the current values or updates for world variables that are marked as visible.
    - Examples include character traits, suggestions, triggers, or specific data values.

6.  **Hidden Tracked Items**
    - State variables (`dataType` in JSON) that the Storyteller AI maintains but does not display to the player in the interface (e.g., visibility set to `ai_only` or `nobody`).

## Data Flow for Story Synthesis

To synthesize a new story turn or generate a historical turn for analysis, use the following structure:

```text
-- Turn [N] --

Action
------
[Player's Action]

Outcome
-------
[Narrative Result]

Objective
-------
[Current Goal]

Secret Information
------------------
[Hidden details for consistency]

Tracked Items
-------------
[Variable updates]

Hidden Tracked Items
--------------------
[Internal state updates]
```
