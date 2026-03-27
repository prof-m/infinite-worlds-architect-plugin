# Infinite Worlds - Story Data Structure

The Infinite Worlds story export format (typically found in `.txt` files) captures the progression of an adventure. It contains the world-building setup, the player character's state, and the turn-by-turn history of actions and outcomes.

## Header and Metadata

- **Story Title**: Identified by `== Story Name ==`.
- **Story Background**: A narrative summary of the starting situation.
- **Initial Character Sheet**:
    - **Name**: The player character's name.
    - **Background**: The character's history and starting traits.
    - **Skills**: A list of attributes with their values and proficiency labels (e.g., `Empathy: 2 (Unskilled)`). Note: skill level 1 may omit the proficiency label entirely — parsers should not assume a label is always present.

## Turn-by-Turn History

Each turn (e.g., `-- Turn 1 --`) consists of several mandatory and optional fields, which map to the Storyteller AI's generated variables.

**Formatting conventions**: Section headers use a text label followed by a line of dashes (`------`). Underline length roughly matches the header text but should be treated as a heuristic, not a strict constraint. Blank-line spacing is generally 2 blank lines before major headers and 1 between sections within turns, but parsers should not rely on exact counts.

1.  **Action** (Required for Player Turns)
    - The literal action text input by the player (e.g., `"I search the desk for any hidden compartments."`).
    - Also referred to as `playerAction` in world instructions.

2.  **Outcome** (`outcomeDescription`) (Required)
    - The Storyteller AI's response to the player's action.
    - Describes the resulting events, dialogue, and environment changes.
    - Written in the specified **Author Style**.
    - May contain an embedded **HUD block** — a structured status display rendered within the narrative text. Example format:
      ```
      ===============================
      🗂 The Counsellor 2 — Internal HUD
      ===============================
      Target: Vivian Zhao
      Foreground Persona: Vivian-dominant
      DID Development: [░░░░░░░░░░] 0%
      Suspicion: [██░░░░░░░░] 20%
      ```
      Note: The title line uses an em dash (`—`), not a double hyphen. Progress bars use `█` (filled) and `░` (empty) Unicode block characters.

3.  **Objective** (`objective`) (Persistent)
    - The current goal for the player, which may evolve over the course of the story.
    - **Turn 1 format**: Objective text appears between two `- - - - -` separator lines (opening and closing).
    - **Mid-story update format**: Later objective updates (e.g., Turns 15-16 or Turn 28) use only a single opening `- - - - -` separator with no closing separator — the objective text is terminated by the next section header.
    - **Parser note**: Detect whether a closing separator is present; do not assume one always exists. The same objective text may appear unchanged in consecutive turns.

4.  **Secret Information** (`secretInfo`) (AI/Author Facing)
    - Lore or mechanical details hidden from the player but stored for AI reference and story progression.
    - Used for tracking NPC motivations, hidden events, or complex magical effects.
    - Entries within secret information may be keyed with names in square brackets (e.g., `[Lilith]`, `[Dr. Stern]`). These are not limited to characters — non-character entries like `[Campus Ecosystem]` also appear.
    - Delimited by `### SECRETINFO` / `### SECRETINFO_END`. **Variant**: Some turns use `### SECRETINFO_END]` (trailing bracket). Parsers should match `^### SECRETINFO_END` as a prefix (e.g., regex `^### SECRETINFO_END\]?$`).
    - **Free-form text**: World-author instruction text (e.g., "Increment ViviDevelopment by a small amount...") may appear between `### SECRETINFO_END` and the next section header. Parsers should use section header detection as the definitive boundary between sections, not rely solely on the end delimiter.

5.  **Tracked Items (State Variables)** (`stateVariablesUpdates`)
    - Displays the current values or updates for world variables that are marked as visible.
    - Examples include character traits, suggestions, triggers, specific data values, and `Current Date:`.
    - **Value structures**:
        - **Simple value**: `Key: value` on a single line (e.g., `Current Date: Day 3`).
        - **Empty value**: `Key:` with no value following the colon.
        - **Multi-entry value**: The key line is followed by character-keyed sub-entries (e.g., `Lilith: trait, trait, trait`), one per line. Blank-line spacing between sub-entries within the same key is inconsistent (1 or 2 blank lines) — parsers should not rely on exact blank-line counts.

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
