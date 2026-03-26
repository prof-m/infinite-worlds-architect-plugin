# Infinite Worlds - Story Data Structure

The Infinite Worlds story export format (typically found in `.txt` files) captures the progression of an adventure. It contains the world-building setup, the player character's state, and the turn-by-turn history of actions and outcomes.

## Export Text Format

### Header and Metadata

- **Story Title**: Identified by `== Story Name ==`. May include subtitles (e.g., `== My Story - DLC Compilation ==`).
- **Story Background**: Introduced by `-- Story Background --`, a narrative summary of the starting situation.
- **Initial Character Sheet**: Introduced by `-- Character --`, containing:
    - **Name**: Under a `Name\n----` sub-header.
    - **Background**: Under a `Background\n----------` sub-header.
    - **Skills**: Under a `Skills\n------` sub-header. Each skill is on its own line: `SkillName: N (Label)` (e.g., `Empathy: 2 (Unskilled)`).

### Turn-by-Turn History

Each turn begins with `-- Turn N --` and contains several sections, each with a text header followed by a line of dashes:

1.  **Action** (Player Turns only; absent on Turn 1 / AI-generated turns)
    - The literal action text input by the player.
    - Header: `Action\n------`

2.  **Outcome** (Required)
    - The Storyteller AI's narrative response.
    - Header: `Outcome\n-------`
    - On Turn 1, the objective may appear inline within the Outcome section, delimited by `- - - - -` markers:
      ```
      Outcome
      -------
      [Narrative text...]

      - - - - -

      Your objective for this adventure is: [objective text]

      - - - - -
      ```

3.  **Objective** (When present as a dedicated section)
    - Header: `Objective\n-------`
    - The current goal for the player, which may evolve over the story.

4.  **Secret Information**
    - Header: `Secret Information\n------------------`
    - Lore or mechanical details hidden from the player.

5.  **Tracked Items**
    - Header: `Tracked Items\n-------------`
    - Contains named sub-categories ending with `:` (e.g., `Suggestions:`, `Traits:`, `Current Date:`, `Triggers:`).
    - Sub-categories may contain named entries (e.g., character names with comma-separated traits, or pipe-delimited suggestion lists).

6.  **Hidden Tracked Items**
    - Header: `Hidden Tracked Items\n--------------------`
    - Same format as Tracked Items but for AI-only state variables.

### Partial Exports

Partial exports (e.g., turns 208-250) still include the full Header, Story Background, and Character Sheet, but begin the turn sequence at a turn number greater than 1. The objective text from Turn 1 is not repeated in later turns.

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

## Parsed Output (extract_spinoff.cjs)

The `extract_spinoff.cjs` script parses story export files into structured JSON. It supports three output modes.

### CLI Usage

```bash
# Legacy mode (default): spinoff seed data
node extract_spinoff.cjs <story_export.txt>

# Full structured parse with all turns, evolution tracking, and snapshot
node extract_spinoff.cjs --full <story_export.txt>

# Snapshot for a specific turn range
node extract_spinoff.cjs --snapshot 100-150 <story_export.txt>

# Write output to a file
node extract_spinoff.cjs --full -o output.json <story_export.txt>
```

### Legacy Output (Default)

Backwards-compatible format for spinoff world creation:

```json
{
  "lastOutcome": "...",
  "currentObjective": "...",
  "lastSecret": "..."
}
```

### Full Output (`--full`)

```json
{
  "metadata": {
    "storyTitle": "Story Name",
    "totalTurns": 250,
    "firstTurn": 1,
    "lastTurn": 250,
    "isPartialExport": false,
    "parsedAt": "2026-03-25T..."
  },
  "initialState": {
    "character": {
      "name": "...",
      "background": "...",
      "skills": {
        "SkillName": { "value": 3, "label": "Competent" }
      }
    },
    "storyBackground": "...",
    "initialObjective": "..."
  },
  "turns": [
    {
      "turnNumber": 1,
      "action": "",
      "outcome": "...",
      "objective": "...",
      "secretInfo": "...",
      "trackedItems": {
        "Suggestions": "...",
        "Triggers": "...",
        "Traits": ""
      },
      "hiddenTrackedItems": {
        "Obedient Characters": "Lilith"
      }
    }
  ],
  "evolution": {
    "objectiveChanges": [
      { "turn": 5, "from": "...", "to": "..." }
    ],
    "trackedItemTimeline": {
      "CategoryOrName": [
        { "turn": 1, "value": "initial value" },
        { "turn": 50, "value": "changed value" }
      ]
    },
    "hiddenItemTimeline": {
      "Obedient Characters": [
        { "turn": 1, "value": "Lilith" },
        { "turn": 80, "value": "Lilith, Melanie" }
      ]
    },
    "skillChanges": [
      { "turn": 10, "skill": "Empathy", "from": 2, "to": 3, "toLabel": "Competent" }
    ]
  },
  "snapshot": {
    "finalTurn": 250,
    "lastOutcome": "...",
    "currentObjective": "...",
    "currentSecretInfo": "...",
    "finalTrackedItems": { "...": "..." },
    "finalHiddenTrackedItems": { "...": "..." },
    "characterState": {
      "name": "...",
      "skills": { "...": { "value": 3, "label": "..." } }
    }
  }
}
```

### Snapshot Output (`--snapshot N-M`)

Same structure as full output but filtered to the requested turn range, with evolution tracking computed only over that range.
