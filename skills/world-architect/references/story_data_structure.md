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

1.  **Action** (Required for Player Turns, except for Turn 1)
    - The literal action text input by the player (e.g., `"I search the desk for any hidden compartments."`).
    - Also referred to as `playerAction` in world instructions.

2.  **Outcome** (`outcomeDescription`) (Required)
    - The Storyteller AI's response to the player's action.
    - Describes the resulting events, dialogue, and environment changes.
    - Written in the specified **Author Style**.

3.  **Objective** (`objective`) (Persistent)
    - The current goal for the player, which may evolve over the course of the story.
    - **Turn 1 format**: Objective text appears between two `- - - - -` separator lines (opening and closing).
    - **Mid-story update format**: Later objective updates (e.g., Turns 15-16 or Turn 28) use only a single opening `- - - - -` separator with no closing separator — the objective text is terminated by the next section header.
    - **Parser note**: Detect whether a closing separator is present; do not assume one always exists. The same objective text may appear unchanged in consecutive turns.

4.  **Secret Information** (`secretInfo`) (AI/Author Facing)
    - Lore or mechanical details hidden from the player but stored for AI reference and story progression.
    - Used for tracking NPC motivations, hidden events, or complex magical effects.

5.  **Tracked Items (State Variables)** (`stateVariablesUpdates`)
    - Displays the current values or updates for world variables that are marked as visible.
    - Examples include character traits, suggestions, triggers, specific data values, and `Current Date:`.

6.  **Hidden Tracked Items** (Conditional)
    - Tracked items whose `visibility` in the world JSON is set to `ai_only` or `nobody`, meaning the player does not see them in the game interface. Uses the same key:value format as regular Tracked Items.
    - This section only appears when the world has tracked items with non-player-visible visibility settings. Always the last section within a turn, after Tracked Items.
    - Not all stories have this section — worlds with no hidden-visibility tracked items (or no tracked items at all) omit it entirely.

## Parsing Guide: Reading Turn Data

When parsing a story export file, expect the following structure within each turn. Sections appear in a fixed order, but several are conditional and may be absent entirely.

### Detecting Turn Boundaries

Each turn begins with a line matching the pattern `-- Turn N --` where N is the turn number. This line is the only reliable boundary marker between turns. The header/metadata region before Turn 1 uses a different pattern (`-- Story Background --`, `-- Character --`) and should be parsed separately.

### Detecting Section Headers

Section headers consist of two lines:
1. A text label (e.g., `Action`, `Outcome`, `Secret Information`)
2. An underline of dashes (`------`) on the next line

The underline length roughly matches the header text but is not exact. Parsers should match on the text label and confirm the next line is composed entirely of dashes.

**Exception — Objective separators**: The Objective section does not follow the standard header + underline pattern. Instead it uses spaced-dash separator lines: `- - - - -`. See the Objective notes below.

### Expected Section Order Within a Turn

```text
-- Turn [N] --

Action                          ← CONDITIONAL: absent in Turn 1
------
[Player's action text]

Outcome                         ← REQUIRED: always present
-------
[Narrative text, may span many paragraphs]


- - - - -                       ← Objective opening separator
[Objective text]
- - - - -                       ← CONDITIONAL closing separator (see notes)

Secret Information              ← REQUIRED: always present
------------------
[Hidden lore and NPC state]

Tracked Items                   ← CONDITIONAL: absent if the story has no
-------------                     visible tracked variables
[Key: Value pairs, one per line or with value on next line]

Hidden Tracked Items            ← CONDITIONAL: absent if the story has no
--------------------              hidden tracked variables
[Key: Value pairs, one per line or with value on next line]
```

### Turn 1 Special Cases

- **No Action section**: Turn 1 contains only the Storyteller's opening narrative, with no player action preceding it. Parsers should not expect an Action header in Turn 1.
- **Objective double separator**: In Turn 1, the objective text appears between two `- - - - -` lines (an opening and a closing separator). This is the initial objective assignment for the story.

### Objective Separator Variants

The objective uses `- - - - -` (spaced dashes) rather than the solid-dash underlines used by other section headers. Two variants exist:

1. **Double separator** (Turn 1 and some updates): The objective text is enclosed between an opening `- - - - -` and a closing `- - - - -`. Both separators appear on their own lines.
2. **Single separator** (mid-story updates): Later objective updates may use only an opening `- - - - -` with no closing separator. The objective text runs until the next section header (`Secret Information`).

Parsers should check for a closing `- - - - -` but not require one. When absent, treat the next standard section header as the end of the objective text.

### Handling Missing Sections

Not all sections appear in every turn or every story:

- **Tracked Items / Hidden Tracked Items**: These sections are entirely absent if the world has no tracked variables of that visibility type. Some stories (e.g., those with no game-mechanical state) omit both sections throughout the entire export. Other stories include them from Turn 1 onward, sometimes with empty values initially.
- **Secret Information**: While consistently present in practice, robust parsers should handle its absence gracefully.

### Tracked Item Value Format

Tracked Items and Hidden Tracked Items sections use the same format: a series of key-value pairs where each key ends with a colon. The value is free text that may be empty, a single line, or span multiple lines. The same format rules apply to both Tracked Items and Hidden Tracked Items.

#### Basic Structure

Each tracked item begins with a key line ending in a colon. The value starts on the next line. One or more blank lines separate one tracked item from the next.

```text
KeyName:
value text

AnotherKey:
another value
```

#### Value Placement

Values consistently appear on the line(s) following the key, not on the same line as the key. The key line contains only the key name and trailing colon.

```text
Current Date:
Saturday, April 11th, 2026

ViviDevelopment:
11

VivianPersonality:
Vivian-dominant
```

#### Empty Values

A tracked item may have no value at all. In this case, the line after the key is blank. Empty values are common in early turns of a story before the game state has accumulated data.

```text
Suggestions:


Triggers:


Traits:

```

Note the double blank line between items when values are empty: one blank line where the value would be, plus the blank line separator before the next key.

#### Multi-line Values

Values frequently span multiple lines. This is common for tracked items that hold per-character entries, lists, or accumulated game state. A single tracked item's value may contain many lines and may include its own internal blank lines separating sub-entries.

Example with per-character sub-entries separated by blank lines within a single tracked item:

```text
Traits:
Lilith: Intelligent, affinity for the occult, values cleanliness and order, secretly kind, vulnerable beneath facade, dark humor, self-aware, strategic, possessive

Melanie: Perfectionist, competitive, skilled at reading emotions, strategic in relationships, genuine dorky laugh, rebellious tendencies

Sophia O'Connell: Intelligent and tech-literate, trained ballet dancer, direct communicator, uses dark humor, isolated and touch-starved

Suggestions:
Lilith: Cannot harm David directly or indirectly | Cannot tell anyone about the spell | Must honestly answer David's questions about the spell

Melanie: Feels floaty and safe in trance | The hornier she gets, the dumber she feels | No memory of trance events unless specifically told to remember

Triggers:
Lilith: 'dummy kitty' | transforms into a much dumber, sluttier bimbo version | 'bright eyes' | returns to normal with full memory

Melanie: 'dummy bunny' | transforms into a much dumber, sluttier bimbo version | 'bright eyes' | returns to normal with full memory

Faye Desrosiers: None
```

Example with list-style values that may be empty or populated:

```text
List of hypnotized Justice Guardians:


List of other hypnotized characters:


List of known Justice Guardians:
Voltage
```

#### Parsing Challenge: Detecting Tracked Item Boundaries

The hard parsing problem is distinguishing where one tracked item's multi-line value ends and the next tracked item's key begins, because:

1. **Blank lines appear both within and between tracked items.** A blank line inside a multi-line value (e.g., between two character sub-entries) looks identical to the blank line separating two tracked items.

2. **Keys are not syntactically distinguishable from values.** A line like `Lilith: Intelligent, strategic, possessive` looks structurally identical to a tracked item key line -- it is a word followed by a colon followed by text. The only difference is semantic: `Lilith:` is a sub-entry within a tracked item value, while `Traits:` is a tracked item key.

3. **The set of tracked item keys is world-specific.** Different worlds define different tracked item names. There is no universal list of valid keys. A parser that does not know the world's tracked item definitions cannot reliably distinguish keys from sub-entry lines.

**Recommended parsing strategies:**

- **Best approach (world-aware):** If the parser has access to the world JSON, use the `stateVariables` definitions to know the exact set of tracked item key names. Match lines against this known set to detect key boundaries.
- **Heuristic approach (world-unaware):** Treat a line as a potential tracked item key if it matches the pattern `SomeText:` followed by a blank or no further content on the same line, AND it appears after one or more blank lines. However, this heuristic will misfire on per-character sub-entries (e.g., `Lilith:` within a Traits value) that also match this pattern. Cross-referencing with keys seen in other turns of the same story can help disambiguate.
- **Conservative approach:** For the first occurrence of Tracked Items in a story, identify all key names that appear (they will often all be present even if values are empty). Use this discovered key set to parse subsequent turns.

#### Hidden Tracked Items Follow the Same Format

The Hidden Tracked Items section uses exactly the same key-value format as regular Tracked Items. The only difference is the section header (`Hidden Tracked Items` vs `Tracked Items`) and the visibility level of the items in the game UI. Hidden Tracked Items is always the last section in a turn when present.
