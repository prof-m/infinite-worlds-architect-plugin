# Proposal 2: Structured Story State Extraction -- Variant Analysis

This document expands Proposal 2 from [story-comprehension-improvements.md](story-comprehension-improvements.md) into three variants with increasing capability and complexity. All three share the same core goal: replace the current approach (relying entirely on AI comprehension of raw story text) with structured extraction of factual data from story exports.

## Table of Contents

- [Common Across All Variants](#common-across-all-variants)
- [Proposal 2A: Pure Programmatic Extraction (Original)](#proposal-2a-pure-programmatic-extraction-original)
  - [How it works](#how-it-works)
  - [Dependencies added](#dependencies-added)
  - [Implementation complexity](#implementation-complexity)
  - [Adversarial review notes](#adversarial-review-notes)
- [Proposal 2B: Enhanced Programmatic Extraction (Informed by Research)](#proposal-2b-enhanced-programmatic-extraction-informed-by-research)
  - [Schema: Factual skeleton + structured sections (grounded in cross-export analysis)](#schema-factual-skeleton--structured-sections-grounded-in-cross-export-analysis)
  - [Multi-file output](#multi-file-output)
  - [Agent consumption: instructions AND MCP query tools](#agent-consumption-instructions-and-mcp-query-tools)
  - [How it works (parser)](#how-it-works-parser)
  - [Token impact](#token-impact)
  - [Generalization](#generalization)
  - [Applies to](#applies-to)
  - [Plugin component](#plugin-component)
  - [Dependencies added](#dependencies-added-1)
  - [Implementation complexity](#implementation-complexity-1)
  - [Adversarial review notes](#adversarial-review-notes-1)
- [Proposal 2C: Agent-Based Narrative Extraction](#proposal-2c-agent-based-narrative-extraction)
  - [Architecture: Agent, not API](#architecture-agent-not-api)
  - [Multi-agent architecture for speed](#multi-agent-architecture-for-speed)
  - [Agent prompt design](#agent-prompt-design)
  - [Output structure](#output-structure)
  - [Updated query tools](#updated-query-tools)
  - [Extraction targets](#extraction-targets)
  - [Merge and validation](#merge-and-validation)
  - [Cost and performance](#cost-and-performance)
  - [Implementation complexity](#implementation-complexity-2)
  - [Adversarial review notes](#adversarial-review-notes-2)
- [Comparison Matrix](#comparison-matrix)
- [Recommendation](#recommendation)

## Common Across All Variants

**MCP tool definition** (added to `index.js` alongside `compile_draft`, `validate_world`, etc.):

```jsdoc
{
    name: "extract_story_state",
    description: "Parse a story export file and produce structured JSON extraction of story metadata, player character sheet, tracked item histories, character mention counts, and per-turn section text. In hybrid mode (2C), also extracts character descriptions, relationships, locations, plot milestones, and unresolved threads via LLM calls. Accepts an optional source world JSON for NPC name seeding.",
    inputSchema: {
        type: "object",
        properties: {
            storyExportPath: {
                type: "string",
                description: "Absolute path to the story export text file."
            },
            sourceWorldPath: {
                type: "string",
                description: "Optional. Absolute path to the source world JSON file. Used to seed NPC name recognition."
            },
            outputFormat: {
                type: "string",
                enum: ["native"],
                description: "Output format. 'native' returns structured extraction JSON. Default: 'native'."
            }
        },
        required: ["storyExportPath"]
    }
}
```

**Plugin integration**: The tool handler is added to the `CallToolRequestSchema` switch block in `index.js`, following the same pattern as existing tools (`readWorld`, `writeWorld` helpers, error handling with `isError: true` responses).

**Why** (shared): Addresses the root cause of all error patterns. The current pipeline has zero structured extraction -- `extract_spinoff.cjs` only captures the last turn (known issue P2c in the improvement roadmap). This proposal fulfills P2c's vision: "parsing ALL turns, tracking character arc progression, tracked item evolution, key narrative events, and outputting structured JSON for sequel synthesis."

**Token impact** (shared): MAJOR REDUCTION. Instead of loading ~16,000 lines of raw story text into context, the agent receives structured JSON via query tools. Output size varies by world: minimal for worlds with no tracked items (RingOfDis: ~200 tokens for `index.json`), substantial for tracked-item-rich worlds (HTTT: `index.json` ~500-1K tokens, `tracked_items.json` ~10K+ tokens for large text-blob items like Suggestions/Traits). The multi-file structure ensures the agent loads only what it needs per step. The raw story need never enter the agent's context window for factual fields.

**Generalization** (shared): Works for any world type because:
- The story export format is standard across all IW worlds (validated across four diverse exports)
- Character mention counting uses the source world's NPC list as seeds (which every world has or doesn't)
- Tracked item extraction works regardless of what's being tracked (traits, inventory, time, XP) or whether tracked items exist at all
- The schema degrades gracefully for minimal worlds (no tracked items, no hidden tracked items, few characters)

**Applies to** (shared): sequel-world (primary). Could extend to spinoff-world if story exports become part of that workflow.

**Plugin component** (shared): mcp-integration

---

## Proposal 2A: Pure Programmatic Extraction (Original)

> **SUPERSEDED**: This is the original Proposal 2 preserved verbatim as a historical baseline. Cross-export analysis of four diverse story exports (HTTT, Counsellor2, TheWorldsAStage, TheRingOfDis) revealed that several fields in this schema cannot be populated by deterministic parsing:
> - `locations[]` -- no export contains a `whereWhen` field or any structured location data
> - `plotMilestones[].summary` -- requires narrative understanding, not just tracked item changes
> - `unresolvedThreads[].description` -- requires semantic judgment about what's "unresolved"
> - `characters.mentioned[].aliases` -- requires narrative context to resolve nicknames
> - `characters.mentioned[].descriptionsFound` -- descriptions are embedded in prose, syntactically indistinguishable from action
>
> **See 2B for the realistic revision** (deterministic extraction of what's actually available) **and 2C for the full-capability version** (LLM-assisted extraction for narrative-understanding fields).

This is the original Proposal 2 as written, preserved verbatim as the baseline.

### How it works

The MCP tool accepts a story export file path and produces:

```json
{
  "metadata": {
    "title": "...",
    "totalTurns": 250,
    "processedTurns": 250
  },
  "characters": {
    "player": {
      "name": "...",
      "initialSkills": { "Persuasion": 2 },
      "finalSkills": { "Persuasion": 4 }
    },
    "mentioned": [
      {
        "name": "Lilith",
        "firstAppearance": 1,
        "lastAppearance": 250,
        "mentionCount": 847,
        "aliases": ["Lil"],
        "descriptionsFound": [
          { "turn": 3, "text": "jet black hair... straight and shiny like a raven's wing" },
          { "turn": 24, "text": "black-painted lips" }
        ],
        "trackedTraits": { "Loyalty": [{ "turn": 10, "value": "3" }] }
      }
    ]
  },
  "trackedItems": {
    "Loyalty": {
      "type": "number",
      "initialValue": "2",
      "finalValue": "5",
      "history": [{ "turn": 10, "value": "3" }, { "turn": 45, "value": "4" }]
    }
  },
  "plotMilestones": [
    { "turn": 1, "summary": "Story begins: David performs binding spell" },
    { "turn": 42, "summary": "Melanie learns about magic" }
  ],
  "locations": [
    { "name": "Seattle apartment", "firstMention": 1, "lastMention": 180 },
    { "name": "Craftsman house, Capitol Hill", "firstMention": 185, "lastMention": 250 }
  ],
  "unresolvedThreads": [
    { "description": "Stalker Derek's obsession temporarily redirected but underlying fixation remains", "lastMentionTurn": 200 }
  ]
}
```

The tool parses the story export format (defined in `story_data_structure.md`) using a stateful text parser with delimiter collision defenses:

- **Stateful turn boundary detection**: A state-machine parser splits on `-- Turn N --` markers with structural integrity validation, rather than a naive regex split:
  - **Sequential turn number validation**: After parsing Turn N, the parser expects Turn N+1. If Turn 47 is followed by Turn 49, the parser flags a gap (possible missing turn or formatting issue) and continues. An out-of-sequence `-- Turn N --` marker is rejected as a delimiter collision (e.g., a character quoting the story format in narrative text).
  - **State-aware section header recognition**: Section headers like `Action`, `Outcome`, `Secret Information`, `Tracked Items`, and `Hidden Tracked Items` are only recognized when (a) they appear after a turn boundary in the expected parser state, (b) they match expected header patterns with a matching underline, and (c) they are not embedded in narrative text (guarded by checking for preceding blank line or turn boundary).
  - **Expected section ordering within each turn**: Sections must appear in the expected order within a turn. A header appearing out of the expected section sequence is treated as narrative text, not a structural delimiter.
- Extracts Action, Outcome, Secret Information, Tracked Items, and Hidden Tracked Items sections per turn
- Aggregates character mentions using NPC names from the source world JSON
- Tracks Tracked Items (maps to `stateVariablesUpdates` in world instructions) values across all turns
- Identifies locations from `whereWhen` fields (available in the raw turn data, though not always exported)
- Produces `plotMilestones` from the first and last 3 turns plus any turn where tracked items change significantly

**Implementation note**: Character mention aggregation requires the source world JSON's NPC names as seeds. Unknown names appearing in the Outcome section (maps to `outcomeDescription` in world instructions) are collected as "unmatched mentions" for the AI to classify.

### Dependencies added

None. Uses only Node.js built-ins (`fs`, `path`, `crypto`) already imported in `index.js`.

### Implementation complexity

MEDIUM. Estimated 400-600 lines of parser code added to `index.js` (or extracted to a helper module). The main complexity is in the state-machine parser with delimiter collision defenses and Tracked Items (maps to `stateVariablesUpdates` in world instructions) JSON extraction. Character mention counting is straightforward string matching seeded from the source world NPC list.

### Adversarial review notes

- *Formatting inconsistencies*: Story exports might have typos in turn markers or malformed JSON in Tracked Items sections (maps to `stateVariablesUpdates` in world instructions). Mitigated by: the stateful parser's sequential turn validation and state-aware header recognition reject false delimiters, with best-effort JSON parsing and raw-text fallback for malformed data.
- *Narrative nuance is lost*: The tool extracts facts but can't capture sarcasm, subtext, or implied meaning. This is by design -- the tool provides the factual scaffold, the AI provides interpretation. The tool should NOT attempt to summarize plot or characterize relationships; those are AI tasks.
- *Character name evolution*: Some stories have characters whose names change (e.g., "Sophie Chen" -> "Sophia O'Connell"). Mitigated by: tracking all name variants and linking them when they share tracked item entries.
- *Very short stories*: For stories under ~20 turns, the tool's structured output might be overkill. Mitigated by: the agent can still read short stories directly; the tool is optional, not mandatory.
- *Interaction with Proposal 1*: The anti-fabrication guard rails still apply even with structured data, because the AI must still interpret and synthesize the data into field values.

---

## Proposal 2B: Enhanced Programmatic Extraction (Informed by Research)

The original Proposal 2A updated with specific learnings from tool and library research, while remaining purely programmatic -- no external libraries imported, no LLM calls. The research informs a better **output schema**, **multi-file output structure**, and **agent consumption strategy** without adding dependencies. (The stateful parser with delimiter collision defenses is shared with 2A -- see 2A's "How it works" section.)

### Schema: Factual skeleton + structured sections (grounded in cross-export analysis)

The output schema is designed around what a deterministic parser can ACTUALLY extract from story exports, validated against four diverse exports: HTTT (250 turns, modern urban fantasy), Counsellor2 (22 turns, psychological thriller), TheWorldsAStage (4 turns, superhero/crime), and TheRingOfDis (30 turns, dark fantasy RPG). The schema uses a "factual skeleton + `_note`" pattern: fields that can be reliably parsed are populated; fields that require narrative interpretation are left null/empty with a `_note` explaining that they are deferred to 2C.

**Cross-export analysis findings that shaped this schema:**

| Element | HTTT (250) | Counsellor2 (22) | WorldsAStage (4) | RingOfDis (30) |
|---------|-----------|-----------------|-----------------|---------------|
| Story Title | Yes | Yes | Yes | Yes |
| Story Background | Yes | Yes | Yes | Yes |
| Character (Name/Background/Skills) | Yes | Yes | Yes | Yes |
| Turn markers | Yes | Yes | Yes | Yes |
| Action section | Yes | Yes | Yes | Yes |
| Outcome section | Yes | Yes | Yes | Yes |
| Objective | Yes (Turn 1, persistent) | Yes (Turn 1, updates Turns 15-16) | Yes (Turn 1) | Yes (Turn 1, update Turn 28) |
| Secret Information | Yes (prose) | Yes (structured blocks) | Yes (prose) | Yes (prose) |
| Tracked Items | Yes | Yes | Yes | **None** |
| Hidden Tracked Items | Yes | Yes | No | **None** |
| whereWhen / location field | **None** | **None** | **None** | **None** |

**Key findings:**
- **`whereWhen` does not exist in any export.** Location/time data cannot be extracted deterministically. The `spaceTime` and `locations` arrays from the previous schema are removed entirely -- they are 2C (LLM) tasks.
- **Tracked Items are not universal.** RingOfDis has zero tracked items across all 30 turns. The schema handles empty tracked items gracefully.
- **Hidden Tracked Items are conditional.** Present in HTTT and Counsellor2, absent in WorldsAStage and RingOfDis.
- **Relationships, events, and character descriptions are narrative content**, not structured data. No export contains structured relationship or event fields. These cannot be populated by a deterministic parser and are deferred to 2C.
- **Character name mentions can be counted** if seeded from the source world's NPC list, but aliases and descriptions require narrative understanding (2C).
- **Secret Information format varies by world**: Counsellor2 uses structured `### SECRETINFO_START` blocks with per-NPC fields; others use free-form prose. The parser can extract the raw text but cannot reliably parse the internal structure across formats.
- **Objective is persistent and may evolve.** It first appears in Turn 1 (between two `- - - - -` separators) and may repeat unchanged across turns. Mid-story updates occur in some worlds (Counsellor2 Turns 15-16, RingOfDis Turn 28) using a single opening separator terminated by the next section header.

**Why this schema (in terms of agent accuracy):**

- **Honest about parser capabilities.** Every field has a documented data source and parsing approach. No aspirational fields that would produce empty arrays or fabricated data.
- **Tracked item history is the primary structured value.** This is the one data type that is genuinely structured in the export and varies across turns. Isolating it is the biggest accuracy win.
- **Per-turn section extraction gives the agent raw material.** Rather than attempting narrative analysis (relationships, events, descriptions), the parser extracts the raw text of each section (Outcome, SecretInfo, Action) per turn. The agent or 2C can analyze this text; the parser does not pretend to understand it.
- **Separate character mention data from narrative data.** Character mention counts (seeded from world NPC names) are factual; everything else about characters is narrative and deferred.

**Full schema example** (HTTT, 250 turns -- richest tracked items case):

```json
{
  "metadata": {
    "title": "How The Turn Tables - DLC Compilation",
    "totalTurns": 250,
    "processedTurns": 250,
    "sourceWorldId": "...",
    "extractionVersion": "2B-3.0"
  },
  "storyArc": {
    "openingTurn": 1,
    "finalTurn": 250,
    "storyBackground": "<verbatim text from the '-- Story Background --' section>",
    "objective": "Discover how your relationship has changed, and reshape it however you desire.  Don't get too corrupted by power.",
    "_note_objective": "Stores the Turn 1 (initial) objective. Mid-story objective updates, when present, are available via get_turn_sections() for the relevant turn.",
    "finalTrackedState": {
      "Current Date": "Saturday, April 11th, 2026",
      "Traits": { "Lilith": "Intelligent, affinity for the occult, ...", "Melanie": "Perfectionist, competitive, ..." },
      "Suggestions": { "Lilith": "Cannot harm David directly or indirectly | ...", "Melanie": "Feels floaty and safe in trance, ..." },
      "Triggers": { "Lilith": "'dummy kitty' | transforms into ...", "Melanie": "'dummy bunny' | transforms into ..." }
    },
    "finalHiddenTrackedState": {
      "Obedient Characters": "Lilith, Melanie, Sophia O'Connell, Faye Desrosiers"
    },
    "openingSummary": null,
    "finalSummary": null,
    "milestones": [],
    "unresolvedThreads": [],
    "_note": "Summary fields, milestones, and unresolved threads require narrative interpretation and cannot be populated by deterministic parsing. These are 2C (LLM-assisted) tasks."
  },
  "playerCharacter": {
    "name": "David",
    "background": "<verbatim text from Character > Background section>",
    "initialSkills": {
      "Empathy": { "value": 2, "label": "Unskilled" },
      "Willpower": { "value": 4, "label": "Highly skilled" },
      "Creativity": { "value": 3, "label": "Competent" },
      "Persuasion": { "value": 5, "label": "Exceptional" },
      "Observation": { "value": 4, "label": "Highly skilled" },
      "Stealth": { "value": 1, "label": null }
    }
  },
  "characterMentions": [
    {
      "name": "Lilith",
      "firstTurn": 1,
      "lastTurn": 250,
      "mentionCount": 847,
      "_note": "Name seeded from source world NPC list. mentionCount is a simple string match across Outcome + SecretInfo text."
    },
    {
      "name": "Melanie",
      "firstTurn": 8,
      "lastTurn": 250,
      "mentionCount": 623
    },
    {
      "name": "Sophia O'Connell",
      "firstTurn": 120,
      "lastTurn": 250,
      "mentionCount": 198
    }
  ],
  "trackedItems": {
    "Current Date": {
      "initialValue": null,
      "finalValue": "Saturday, April 11th, 2026",
      "history": [
        { "turn": 1, "value": "Friday, March 27th, 2026" },
        { "turn": 50, "value": "Saturday, March 28th, 2026" },
        { "turn": 250, "value": "Saturday, April 11th, 2026" }
      ],
      "_note": "Only turns where the value changed are recorded."
    },
    "Traits": {
      "initialValue": "",
      "finalValue": "Lilith: Intelligent, affinity for the occult, ... (truncated)",
      "history": [
        { "turn": 5, "value": "Lilith: Intelligent, affinity for the occult" },
        { "turn": 50, "value": "Lilith: Intelligent, ... Melanie: Perfectionist, ..." }
      ],
      "_note": "Text blob tracked items can be very large. Only turns with value changes are stored."
    },
    "Suggestions": {
      "initialValue": "",
      "finalValue": "Lilith: Cannot harm David directly or indirectly | ... (truncated)",
      "history": []
    }
  },
  "hiddenTrackedItems": {
    "Obedient Characters": {
      "initialValue": "Lilith",
      "finalValue": "Lilith, Melanie, Sophia O'Connell, Faye Desrosiers",
      "history": [
        { "turn": 1, "value": "Lilith" },
        { "turn": 80, "value": "Lilith, Melanie" },
        { "turn": 200, "value": "Lilith, Melanie, Sophia O'Connell" },
        { "turn": 248, "value": "Lilith, Melanie, Sophia O'Connell, Faye Desrosiers" }
      ]
    }
  },
  "secretInfo": {
    "format": "prose",
    "finalTurnText": "<verbatim Secret Information text from Turn 250>",
    "_note": "Secret Information text is extracted verbatim per turn. The 'format' field indicates whether the world uses free-form prose or structured blocks (e.g., Counsellor2 uses ### SECRETINFO_START with per-NPC fields). Internal parsing of structured secretInfo is a potential future enhancement but not part of 2B."
  },
  "relationships": [],
  "events": [],
  "locations": [],
  "_note_deferred": "relationships[], events[], and locations[] cannot be populated by deterministic parsing. Story exports contain no structured relationship, event, or location fields. These arrays are populated by 2C's LLM-assisted pipeline. They are present in the schema as empty arrays so 2C can fill them without schema changes."
}
```

**Minimal schema example** (RingOfDis, 30 turns -- no tracked items at all):

```json
{
  "metadata": {
    "title": "The Ring of Dis - Modified",
    "totalTurns": 30,
    "processedTurns": 30,
    "sourceWorldId": null,
    "extractionVersion": "2B-3.0"
  },
  "storyArc": {
    "openingTurn": 1,
    "finalTurn": 30,
    "storyBackground": "<verbatim text from '-- Story Background --' section>",
    "objective": "To use the Ring of Dis to bring the dig team under your control and start your dark empire.",
    "_note_objective": "Turn 1 (initial) objective. This world has a mid-story update at Turn 28; use get_turn_sections(28) to retrieve the updated objective text.",
    "finalTrackedState": {},
    "finalHiddenTrackedState": {},
    "openingSummary": null,
    "finalSummary": null,
    "milestones": [],
    "unresolvedThreads": [],
    "_note": "This world has no tracked items. The factual skeleton is limited to story background, objective, character sheet, and per-turn section text."
  },
  "playerCharacter": {
    "name": "Professor Alex Blackwood",
    "background": "<verbatim>",
    "initialSkills": {
      "Leadership": { "value": 2, "label": "Unskilled" },
      "Persuasion": { "value": 3, "label": "Competent" },
      "Subterfuge": { "value": 3, "label": "Competent" },
      "Manipulation": { "value": 5, "label": "Exceptional" },
      "Occult Knowledge": { "value": 4, "label": "Highly skilled" }
    }
  },
  "characterMentions": [
    {
      "name": "Eleanor Vance",
      "firstTurn": 1,
      "lastTurn": 30,
      "mentionCount": 95
    }
  ],
  "trackedItems": {},
  "hiddenTrackedItems": {},
  "secretInfo": {
    "format": "prose",
    "finalTurnText": "<verbatim Secret Information text from Turn 30>"
  },
  "relationships": [],
  "events": [],
  "locations": [],
  "_note_deferred": "relationships[], events[], and locations[] cannot be populated by deterministic parsing. These are 2C tasks."
}
```

**Key schema design notes:**

What 2B extracts (deterministic, every world):
- `storyArc` provides the factual skeleton: turn range, verbatim story background, objective (parsed from `- - - - -` separator blocks -- Turn 1 uses double separators (opening + closing), mid-story updates use a single opening separator terminated by the next section header; the schema stores the most recent objective value), and snapshots of the final tracked state and final hidden tracked state. Summary fields, milestones, and unresolved threads are null/empty -- they require narrative interpretation (2C).
- `playerCharacter` captures name, verbatim background text, and skills with both numeric value and proficiency label (e.g., `{ "value": 5, "label": "Exceptional" }`). The `label` field may be `null` when the proficiency label is absent from the export -- per the spec, skill level 1 may omit the proficiency label entirely. Skill progression tracking (initial vs. final) is not possible because skill values are only stated once in the header -- they do not appear in per-turn tracked items.
- `characterMentions[]` provides name, first/last turn of mention, and mention count. Names are seeded from the source world's NPC list. This is pure string matching -- no alias resolution, no description extraction, no relationship inference. The `_note` field documents this limitation.
- `trackedItems{}` and `hiddenTrackedItems{}` are keyed by item name, with `initialValue`, `finalValue`, and a `history[]` of value changes. This is the primary structured value that 2B delivers. Some worlds have extensive tracked items (HTTT has Traits, Suggestions, Triggers, Current Date, plus hidden Obedient Characters); others have none at all (RingOfDis). The schema handles both cases.
- `secretInfo` captures the format type (`prose` or `structured`) and the verbatim text from the final turn. Per-turn secretInfo text is available via the query tools but not stored in the main schema to keep file sizes manageable.

What 2B does NOT extract (deferred to 2C):
- `relationships[]` -- empty array. No export contains structured relationship data. Relationships are entirely embedded in narrative prose and secretInfo text.
- `events[]` -- empty array. Events are narrative content. Tracked item changes provide a weak signal (a value changing implies something happened), but the event description, entity attribution, and status require narrative understanding.
- `locations[]` -- empty array. No export contains a `whereWhen` field or any structured location data. Locations are mentioned only in narrative prose.
- Character descriptions, aliases, and lastKnownLocation -- all require parsing narrative prose, which is a 2C task.
- Story arc summaries, milestones, unresolved threads -- narrative interpretation tasks.

### Multi-file output

The extraction tool writes to a **directory**, not a single JSON file. This is critical for context efficiency -- the agent only loads what it needs for the current field step.

**Why (in terms of accuracy):**

- The real 250-turn test case produces substantial extraction data. At any single step of the field-by-field walkthrough, the agent needs only a fraction of this. Loading everything wastes context window capacity and dilutes attention.
- Tracked item histories (especially text blob items like Suggestions and Traits) dominate the output size. Isolating them in `tracked_items.json` means the agent only loads this data when working on tracked item fields.
- For the 13-NPC walkthrough, the agent loads `index.json` once (character mention list + factual skeleton) and then selectively reads individual turn sections via `get_turn_sections()` as needed -- far more focused than loading a monolithic extraction repeatedly.
- Per-turn section files in `turns/` are individually small (~500-2K tokens each) and load on demand. For a 250-turn story this is 250 small files, but the agent only reads the ones it needs.

**Output structure:**

```
{outputDir}/
  index.json           -- manifest + storyArc + playerCharacter + characterMentions (returned inline by MCP tool response)
  tracked_items.json   -- full value histories for tracked items + hidden tracked items (largest file, isolated for this reason)
  turns/               -- per-turn extracted sections (optional, for agent deep-dives)
    turn_001.json      -- { action, outcome, secretInfo, trackedItems, hiddenTrackedItems } for Turn 1
                           (keys are internal names mapped from export headers: Action, Outcome, Secret Information, Tracked Items, Hidden Tracked Items)
    turn_002.json      -- etc.
    ...
```

Note the significantly reduced file count compared to the previous schema. The `relationships.json`, `events.json`, `locations.json`, and `space_time.json` files are removed because those arrays cannot be populated by deterministic parsing. They will be added back when 2C is implemented.

The `index.json` contains the full `storyArc` (factual skeleton: turn range, verbatim background, objective, final tracked state snapshots), `playerCharacter` (name, background, skills), `characterMentions[]`, and `secretInfo` (format + final turn text). This provides enough context for the agent to plan its walkthrough without reading other files. The MCP tool returns `index.json` content inline in the tool response so the agent receives the summary immediately without a separate file read.

The `turns/` directory provides per-turn section text for when the agent needs to deep-dive into specific turns (e.g., reading secretInfo from a particular turn to understand a character's state). This replaces the previous approach of trying to pre-extract narrative data into structured arrays -- instead, the raw section text is preserved and the agent (or 2C) can analyze it on demand.

### Agent consumption: instructions AND MCP query tools

Beyond building the parser, Proposal 2B also requires giving the agent a way to efficiently and accurately USE the extraction output. Two approaches that should coexist:

#### Approach A: Reference doc with consumption instructions

Add a reference document (e.g., `references/extraction_output_guide.md`) that tells the agent:

- What each file contains and when to read it during the field-by-field walkthrough
- A mapping table: "When populating [world field], use [query tool] or read [extraction file]"
- Which fields are factual (from 2B extraction) vs. which require narrative interpretation (must read raw story text or await 2C)
- How to interpret the schema (what `trackedItems` history means, what empty deferred arrays mean, etc.)
- Token cost: ~200-300 tokens added to the skill's reference materials

This is cheap to build and helps even if the MCP query tools exist -- it gives the agent a plan before it starts reading files.

#### Approach B: MCP query tools

Add lightweight MCP tools that query the extraction output so the agent does not need to read raw JSON files:

- **`get_story_summary()`** -- returns `index.json` content: `storyArc` factual skeleton (turn range, verbatim story background, objective, final tracked state snapshots), `playerCharacter`, and `characterMentions[]`. Everything needed for background/firstAction/objective fields.
- **`get_tracked_item_state(name?)`** -- returns one or all tracked items (and hidden tracked items) with final values. Optional: include full history.
- **`get_turn_sections(turnNumber)`** -- returns the extracted section text (Action, Outcome, SecretInfo, tracked item values) for a specific turn. Allows the agent to deep-dive into individual turns without loading the entire story.
- **`get_character_mentions(name?)`** -- returns mention data for one or all characters (first/last turn, mention count). When 2C is implemented, this tool will be extended to also return relationships and events for the named character.

Note: `get_character_profile(name)` (which composed data across multiple files) and `get_space_time(turnRange?)` are removed from the 2B query tool set. `get_character_profile` was designed to join character, relationship, and event data -- but since relationships and events are empty arrays in 2B, the tool would return only mention data, which `get_character_mentions` covers. `get_space_time` is removed because there is no location/time data to query. Both tools should be added when 2C populates those arrays.

**Recommendation:** Implement BOTH. The reference doc is cheap and helps even if the MCP tools exist. The MCP query tools are the primary accuracy mechanism because they provide focused, task-appropriate data without requiring the agent to navigate the file structure.

### How it works (parser)

The same deterministic parse-and-extract approach as 2A. The stateful text parser with delimiter collision defenses (sequential turn validation, state-aware header recognition, expected section ordering) is shared with 2A -- see 2A's "How it works" section for the full parser specification.

2B's parser contribution beyond the shared foundation:

- **PDF layering point**: The parser operates on plain text. A future `readStoryFile()` function can detect file type and route PDFs through a text extraction step before feeding the shared parser. This keeps the parser format-agnostic.
- **Multi-file output writer**: After extraction, the output is split across the directory structure described above, with `index.json` generated as the manifest.
- **Tracked item value format handling**: Per the spec, tracked item values appear in two formats: (1) key on one line with value on the next line(s), and (2) key and value on the same line (occasionally). The parser must handle both. Values may also be empty (key with colon but no content) or multi-line (free text spanning multiple lines, terminated by the next key or section boundary).

### Token impact

MAJOR REDUCTION -- the multi-file approach means the agent loads only what it needs:

- Background/firstAction/objective fields: `index.json` via `get_story_summary()` -- ~500-1K tokens (storyArc skeleton + character sheet + mention list)
- Tracked item fields: `tracked_items.json` via `get_tracked_item_state()` -- variable, from ~50 tokens (no tracked items) to ~10K+ tokens (HTTT-scale Suggestions/Traits blobs). Isolated from other data.
- Character fields: `get_character_mentions(name)` for factual data (~100 tokens per character) + `get_turn_sections(N)` for specific turns where the agent needs narrative context (~500-2K tokens per turn)
- Deep-dive into specific story moments: `get_turn_sections(N)` -- ~500-2K tokens per turn

For the 13-NPC walkthrough, the agent loads mention data (~100 tokens per NPC) plus selective turn deep-dives as needed, rather than loading a full monolithic extraction repeatedly. The raw story never enters the agent's context window for factual fields. For narrative fields (character descriptions, relationships), the agent or 2C reads specific turn sections rather than the entire export.

### Generalization

Works for any world type because (validated across four diverse exports):
- The story export format is standard across all IW worlds (title, background, character, skills, turns with Action/Outcome/SecretInfo/Tracked Items sections)
- Character mention counting uses the source world's NPC list as seeds (which every world has or doesn't)
- Tracked item extraction works regardless of what's being tracked (traits, inventory, time, XP) or whether tracked items exist at all (RingOfDis has none)
- The schema degrades gracefully for minimal worlds: empty `trackedItems`, empty `hiddenTrackedItems`, and empty deferred arrays are valid states
- No world-type-specific logic is required -- the parser handles the common export format without needing to know the genre or game mechanics

### Applies to

sequel-world (primary). Could extend to spinoff-world if story exports become part of that workflow.

### Plugin component

mcp-integration (for both the extraction tool AND the query tools)

### Dependencies added

None. Same as 2A -- Node.js built-ins only. The schema design is informed by cross-export analysis of four diverse story exports. The query tools are thin wrappers over JSON file reads.

### Implementation complexity

MEDIUM. Estimated 400-650 lines (incremental over 2A's shared parser):
- ~200 lines for the state-machine parser (shared with 2A)
- ~60 lines for tracked item / hidden tracked item extraction and history building
- ~40 lines for character mention counting (string matching seeded from world NPC names)
- ~60 lines for multi-file output writer (index.json + tracked_items.json + turns/ directory)
- ~100 lines for MCP query tool definitions and handlers (4 tools)
- ~40 lines for `index.json` assembly (storyArc + playerCharacter + characterMentions)
- ~50 lines for tool handler wiring and validation
- ~100-150 lines for reference doc (`extraction_output_guide.md`)

Reduced from the previous estimate because: (a) entity/relationship/event extraction (~150 lines) is removed -- those arrays are empty in 2B, (b) space_time and locations extraction is removed, (c) fewer output files to write, (d) fewer query tools to implement. The parser complexity is unchanged. No new dependencies.

### Adversarial review notes

All of 2A's adversarial notes apply, plus:

- *Schema seems thin compared to previous version*: The previous schema included relationships, events, locations, spaceTime, character descriptions, and aliases -- all of which are now empty/removed. This is correct: the previous schema was aspirational, not implementable. A deterministic parser cannot populate those fields from any of the four tested exports. Including them as empty arrays with `_note` fields is honest; pretending a parser could fill them would produce fabricated data -- exactly the error pattern this proposal exists to prevent.
- *Multi-file overhead*: Writing and reading multiple files adds I/O complexity. Mitigated by: (a) the query tools abstract file reads away from the agent, (b) the `turns/` directory uses one file per turn which is natural for selective access, (c) `index.json` provides everything needed for planning without touching other files.
- *Query tool maintenance*: Four new MCP tools increase the plugin's surface area. Mitigated by: (a) they are thin read-only wrappers with no side effects, (b) they share the same extraction output format, (c) the tool set is designed to grow when 2C adds data -- `get_character_mentions` will evolve into `get_character_profile` when relationships and events are available.
- *Agent might ignore query tools and read files directly*: The reference doc instructs the agent to use query tools when available. Even if the agent reads files directly, the multi-file structure still provides selective loading benefits.
- *Tracked item histories dominate output size*: For worlds like HTTT with large text-blob tracked items (Suggestions, Traits), the `tracked_items.json` file can be very large (~10K+ tokens). Mitigated by: isolating tracked items in their own file so the agent only loads them when needed. The query tool supports per-item filtering.
- *No narrative data means the agent still needs the raw story for character work*: Correct. 2B provides the factual scaffold (tracked items, mention counts, character sheet, objective); the agent must still read narrative text for character descriptions, relationships, and plot understanding. The `get_turn_sections()` query tool facilitates selective turn reading rather than loading the entire export. 2C is designed to fill this gap.
- *World-specific formats (structured secretInfo)*: Some worlds embed custom structured formats in their output. The structured `### SECRETINFO_START` blocks appear in SecretInfo. The parser extracts these as raw text without attempting to parse their internal structure. Future enhancements could add format-specific sub-parsers, but this is not a 2B requirement.

---

## Proposal 2C: Agent-Based Narrative Extraction

Instead of making Anthropic API calls from within the MCP tool's Node.js code, 2C uses a **Claude Code plugin agent** -- a markdown agent definition file that runs within the user's existing Claude Code session. The agent uses 2B's MCP query tools to read the factual skeleton, reads per-turn sections for narrative understanding, and writes structured narrative findings back into the extraction directory, filling the arrays that 2B leaves empty.

### Architecture: Agent, not API

The 2C capability is delivered as a plugin agent definition file (e.g., `agents/narrative-extractor.md`), not as additional code inside the MCP tool. The agent:

- Is defined in the plugin's agent directory with YAML frontmatter specifying `model: haiku` for cost control
- Has strong, detailed instructions for narrative extraction baked into its system prompt
- Uses 2B's MCP query tools (`get_story_summary()`, `get_turn_sections()`, `get_character_mentions()`) to read the factual skeleton and per-turn section text
- Writes its findings as JSON files into a `narrative/` subdirectory of the 2B extraction output
- Can spawn subagents to parallelize extraction work across the story

**Why agent-based instead of API-based:**

- **Zero new dependencies** -- no Anthropic SDK, no HTTP wrapper, no `fetch` calls. The agent is a markdown file.
- **Zero API key management** -- the agent runs within the user's existing Claude Code session, using whatever credentials and model access the session already has.
- **The agent can use tools** -- Read, Grep, Write, and the 2B query tools. This makes it far more capable than raw API calls: it can search the source text, verify its own claims, and write structured output.
- **The agent can verify its own work** -- grep the per-turn files to confirm a claimed character description actually exists at the cited turn number.
- **Natural fit for the plugin architecture** -- agents are a first-class plugin component in Claude Code plugins, alongside skills, MCP tools, and hooks.
- **Cost control via model selection** -- `model: haiku` in the agent's YAML frontmatter. The user can override this if they prefer a different model.

### Multi-agent architecture for speed

The narrative extraction agent is designed as an **orchestrator** that spawns specialist subagents for parallel work.

#### Orchestrator agent (`agents/narrative-extractor.md`)

The orchestrator:
1. Reads 2B's `index.json` via `get_story_summary()` to understand story scope (total turns, character mention list, tracked items present)
2. Divides the work into parallel extraction tasks
3. Spawns specialist subagents for each task
4. Merges subagent outputs into the `narrative/` directory
5. Validates the merged output against 2B's factual data (cross-references character mentions, tracked item values)

#### Parallel subagent strategies

Three options for dividing work across subagents. The choice depends on what work is truly independent:

**Option A -- Segment-parallel**: Each subagent processes a different turn range (turns 1-50, 51-100, etc.), extracting ALL narrative data for that segment. The orchestrator merges results afterward.
- Pro: Simple division of labor; each subagent is self-contained
- Con: Cross-segment entities need reconciliation (a character appearing in segments 2 and 4 produces duplicate entries that must be merged, relationship timelines must be stitched together)

**Option B -- Task-parallel**: Each subagent handles a different extraction task across the FULL story:
- Subagent 1: **Character descriptions and aliases** -- reads all turns looking for physical descriptions, clothing, mannerisms, nicknames, and name changes
- Subagent 2: **Relationships** -- reads all turns looking for character interactions, relationship evolution, power dynamics
- Subagent 3: **Locations** -- reads all turns looking for place names, setting descriptions, character-location associations
- Subagent 4: **Events/milestones + unresolved threads** -- reads all turns identifying significant plot moments, story arc summaries, and threads still open at story's end
- Pro: No cross-entity reconciliation needed; each subagent is a specialist with focused instructions
- Con: Each subagent reads the full story (though via `get_turn_sections()`, not the raw export)

**Option C -- Hybrid (segment then reconcile)**: Segment-parallel for initial extraction, then task-parallel specialists for reconciliation:
- Phase 1: Segment subagents extract everything from their turn range
- Phase 2: Specialist subagents reconcile across segments (deduplicate characters, merge relationship timelines, stitch location histories)
- Pro: Fast initial extraction + accurate reconciliation
- Con: Two-phase complexity, more total subagent invocations

**Recommendation: Option B (task-parallel)** because:
- Each subagent can be given highly specific, focused instructions -- a character-description specialist knows exactly what patterns to look for in narrative prose and what to ignore
- No entity reconciliation is needed across segments -- each specialist owns its entire domain
- The subagents all read from the same 2B extraction (per-turn files in `turns/`), which is already available and well-structured
- Each specialist can verify its own findings (grep the per-turn source text for a claimed description and confirm it exists)
- The orchestrator's merge is simple: combine the outputs of 4 non-overlapping specialists into the `narrative/` directory
- Specialist prompts can be tuned independently -- if character descriptions are high quality but relationship extraction needs work, only the relationship subagent's instructions change

### Agent prompt design

#### Orchestrator prompt encodes cross-cutting principles

The orchestrator agent's system prompt bakes in principles from other proposals so they apply automatically to all subagent work:

- **Anti-fabrication guard rails (from Proposal 1)**: Cite turn numbers for every extracted fact. Never substitute genre stereotypes for missing details. Never invent proper nouns, named abilities, or coined terminology. If a detail is not in the text, do not include it.
- **Equal-weighting principle (from Proposal 3)**: Give equal attention to all story segments. Do not let late turns dominate extraction. Early and mid-story events must receive the same extraction thoroughness as late events.
- **Citation protocol (from Proposal 5)**: Every extracted fact must cite one or more turn numbers where the supporting text appears. Turn citations are not optional.
- **Extraction templates**: Specific JSON schemas for each output data type (character descriptions, relationships, events, locations, story arc).
- **Output instructions**: Write output as JSON files in the `narrative/` subdirectory of the extraction directory.

#### Specialist subagent prompts

Each specialist subagent receives:

- The relevant **extraction template** (JSON schema for its output type)
- The **character mention list** from 2B's `index.json` (so it knows who to look for, with first/last turn ranges)
- Access to **`get_turn_sections()`** to read individual turns and **Read** to access the `turns/` directory files directly
- **Anti-fabrication guard rails**: cite turn numbers for every finding; if a detail is not in the text, do not extract it
- **Verification instructions**: after extracting a claim, grep the source turn file to confirm the claimed text actually exists at that location

### Output structure

The agent writes into a `narrative/` subdirectory that cleanly separates 2C's LLM-extracted data from 2B's deterministic data:

```
{outputDir}/
  index.json              -- (from 2B, untouched)
  tracked_items.json      -- (from 2B, untouched)
  turns/                  -- (from 2B, untouched)
  narrative/              -- (NEW, from 2C agent)
    characters.json       -- character descriptions, aliases, lastKnownLocation (with turn citations)
    relationships.json    -- relationship entries with source/target/type/description/sourceTurns
    events.json           -- entity-scoped events with type/description/turn/status
    locations.json        -- location names with firstTurn/lastTurn/description
    story_arc.json        -- openingSummary, finalSummary, milestones[], unresolvedThreads[]
```

Each file in `narrative/` includes an `"extractionMethod": "agent-haiku"` marker (or whatever model was used) so downstream consumers know the provenance. Every data point includes `sourceTurns` arrays citing where the supporting text was found.

The `narrative/` subdirectory approach means:
- 2B's output is never modified by 2C -- the deterministic data remains pristine
- The presence or absence of `narrative/` is the signal for whether 2C extraction has been run
- Re-running 2C (e.g., with a better model or updated prompts) simply overwrites `narrative/` without touching 2B's files
- The schema is additive: 2B's `_note_deferred` fields explain what 2C will populate; the `narrative/` files deliver it

### Updated query tools

When the `narrative/` directory exists, the query tools automatically incorporate 2C data:

- **`get_character_mentions(name)` evolves to `get_character_profile(name)`**: Joins 2B's mention data (name, firstTurn, lastTurn, mentionCount) with 2C's `characters.json` (descriptions, aliases, lastKnownLocation) and `relationships.json` (relationships where the character is source or target) and `events.json` (events attributed to the character). Returns the unified profile.
- **`get_story_summary()` incorporates narrative data**: Includes 2C's `story_arc.json` (openingSummary, finalSummary, milestones, unresolvedThreads) alongside 2B's factual skeleton.

The tools detect whether `narrative/` exists via a simple directory check. When it does not exist, they behave identically to 2B. This means the query tool interface is the same whether or not 2C has been run -- the agent gets richer data when available, gracefully degraded data when not.

**No `mode` parameter on the MCP tool.** The MCP tool IS 2B (deterministic extraction). The agent IS 2C (narrative extraction). Running just the MCP tool gives you 2B. Running the MCP tool and then the narrative-extractor agent gives you 2B+2C. This is a cleaner separation than a `mode` parameter that changes the tool's behavior.

### Extraction targets

The same 7 field categories that 2B leaves empty/null, now as subagent specializations:

| 2B Schema Field | 2B State | 2C Agent Target | Specialist Subagent |
|-----------------|----------|-----------------|---------------------|
| Character `descriptionsFound[]` | Not present | Physical descriptions, clothing, mannerisms from Outcome prose | Character specialist |
| Character `aliases[]` | Not present | Nicknames, name changes (e.g., "Sophie Chen" vs. "Sophia O'Connell") | Character specialist |
| Character `lastKnownLocation` | Not present | Derived from location + character mention co-occurrence | Character specialist + Location specialist |
| `relationships[]` | Empty array | Nature and evolution of character interactions | Relationship specialist |
| `locations[]` | Empty array | Place names, setting descriptions from narrative prose | Location specialist |
| `events[]` / `storyArc.milestones[]` | Empty array | Plot milestones, narratively significant turns, entity-scoped events | Events specialist |
| `storyArc.openingSummary` / `finalSummary` | null | Opening and closing situation descriptions for sequel grounding | Events specialist |
| `storyArc.unresolvedThreads[]` | Empty array | Narrative threads still open at story's end | Events specialist |

### Merge and validation

The orchestrator performs validation after collecting subagent outputs:

- **Cross-reference against 2B factual data**: If a subagent claims a character has trait X, check against `trackedItems` values. If tracked items contradict the claim, flag the discrepancy.
- **Turn citation verification**: For a sample of extracted claims, the orchestrator can grep the cited turn files to verify the supporting text exists.
- **Deduplication**: Multiple subagents may reference the same characters or locations. The orchestrator resolves duplicates before writing the final `narrative/` files.
- **Provenance marking**: Every data point in the output files includes `sourceTurns` and `extractionMethod` fields.

### Cost and performance

- The orchestrator + 4 specialist subagents run on Haiku (specified in agent frontmatter)
- Each specialist reads ~250 turns via `get_turn_sections()` or direct file reads of the `turns/` directory
- Total cost is similar to the API approach (~$0.01-0.05 for Haiku) but with **zero implementation overhead** for API management, HTTP wrappers, error handling, or key resolution
- Parallel subagents mean faster completion than sequential API calls
- If the user has a different model preference, they can override the model in the agent invocation
- Extraction results are cached: the `narrative/` directory persists and does not need to be regenerated unless the story export changes

### Implementation complexity

LOW-MEDIUM. Significantly simpler than the API-call approach:

- **Agent definition**: ~200-400 lines of prompt across the orchestrator + 4 specialist agent files. This is markdown with YAML frontmatter, not application code.
- **Query tool extensions**: ~100-150 lines of code in `index.js` to detect `narrative/` directory and join 2C data into query tool responses (`get_character_profile`, enhanced `get_story_summary`).
- **No new application code** for API calls, HTTP wrappers, error handling, key management, cost estimation, quota exhaustion recovery, or partial-result assembly. All of that is handled by the Claude Code agent runtime.
- **No new dependencies**. The agent definition file is the entire 2C implementation beyond the query tool extensions.

Total: ~200-400 lines of agent prompts + ~100-150 lines of query tool code, vs. the previous estimate of 1,000-1,350 lines of application code.

### Adversarial review notes

All of 2A's and 2B's adversarial notes apply, plus:

- *Agent hallucination*: Even with strong anti-fabrication prompts, the Haiku agent might hallucinate details not present in the source text. Mitigated by: (a) turn citation requirements -- every claim must cite a turn number, (b) the orchestrator's verification step can grep cited turns to confirm claims, (c) provenance marking lets the downstream agent know what's agent-extracted vs. deterministic, (d) the `narrative/` directory is clearly separated from 2B's verified data.
- *Subagent coordination failures*: A specialist subagent might fail, produce malformed JSON, or time out. Mitigated by: (a) the orchestrator can retry failed subagents, (b) partial results are still useful -- if the relationship specialist fails but the other three succeed, three of four `narrative/` files are still written, (c) the query tools gracefully handle missing `narrative/` files (they fall back to 2B-only behavior per file).
- *Haiku capability limits*: Haiku is the cheapest model but may miss subtle narrative details that a more capable model would catch (e.g., implied relationships, sarcasm, subtext). Mitigated by: (a) the model is configurable in the agent frontmatter -- users can upgrade to Sonnet for higher-quality extraction at higher cost, (b) the specialist prompt design compensates by being very explicit about what patterns to look for, (c) for most extraction targets (physical descriptions, location names, explicit relationship statements), Haiku is more than sufficient.
- *Cost creep*: At ~$0.01-0.05 per extraction, costs are low but could add up if the agent is run repeatedly. Mitigated by: the `narrative/` directory persists as a cache; re-running is only needed if the story export changes or the agent prompts are improved.
- *Complexity budget*: 2C as an agent is dramatically simpler than 2C as API calls. The total new code is ~100-150 lines of query tool extensions. The agent prompts are substantial (~200-400 lines of markdown) but are configuration, not application logic -- they can be iterated without touching `index.js`.
- *Cross-reference validation limits*: The cross-reference between agent claims and tracked item data is only useful for worlds that have tracked items. For worlds like RingOfDis with no tracked items, there is nothing to cross-reference against -- the agent output must stand on its own. This is an acceptable tradeoff because 2C's narrative extraction is specifically most needed for these minimal-tracked-item worlds.
- *Privacy*: Story text is processed by the agent within the user's existing Claude Code session. No new privacy boundary is crossed -- the same text the user already loaded into Claude Code is being processed by a subagent within that same session.

---

## Comparison Matrix

| Dimension | 2A: Pure Programmatic (SUPERSEDED) | 2B: Enhanced Programmatic | 2C: Agent-Based Narrative Extraction |
|-----------|----------------------|--------------------------|------------------------|
| **Status** | Original baseline, preserved for reference. Several fields (locations, milestones, aliases, descriptions) cannot be populated deterministically. | **Recommended starting point.** Validated against 4 diverse exports. | Future enhancement, builds on 2B. Agent-based architecture (not API calls). |
| **New dependencies** | None | None | None (agent definition files only) |
| **External API calls** | No | No | No direct API calls -- agent runs within the user's existing Claude Code session |
| **Per-extraction cost** | $0 | $0 | ~$0.01-0.05 (Haiku agent tokens) |
| **Implementation** | 400-600 lines of parser code | 400-650 lines of parser + query tools | Agent prompts (~200-400 lines of markdown) + query tool extensions (~100-150 lines of code) |
| **Output format** | Single JSON file | Multi-file directory (index + tracked_items + turns/) | 2B's directory + `narrative/` subdirectory (characters, relationships, events, locations, story_arc) |
| **Schema** | Ad-hoc flat (aspirational fields unpopulable) | Factual skeleton + tracked items + per-turn sections; deferred arrays for 2C | 2B schema untouched; `narrative/` adds the data 2B defers |
| **Agent consumption** | Agent reads raw JSON | Query tools + reference doc | Query tools auto-join 2B + 2C data when `narrative/` exists (get_character_profile, enhanced get_story_summary) |
| **Narrative understanding** | None (claims locations/milestones but can't extract them) | None (honestly defers narrative fields) | Moderate (4 specialist subagents for 7 deferred field categories) |
| **Character data** | Name + aliases + descriptions (aspirational) | Name mention counts + per-turn section text available via query tool | Descriptions, aliases, lastKnownLocation from narrative prose (character specialist subagent) |
| **Tracked items** | Flat extraction | Full history with initial/final/changes; hidden tracked items separated | Same as 2B (programmatic, not re-extracted by agent) |
| **Relationship extraction** | None | None (empty array, deferred to 2C) | From narrative interactions + secretInfo (relationship specialist subagent) |
| **Story arc** | plotMilestones (aspirational) | Factual skeleton (turn range, background, objective, final tracked state) | Skeleton + agent-generated summaries, milestones, threads (events specialist subagent) |
| **Event/milestone tracking** | None (despite schema including it) | None (empty array, deferred to 2C) | Agent-identified events with entity scope (events specialist subagent) |
| **Location extraction** | Claims `whereWhen` (doesn't exist in exports) | None (no `whereWhen` in any export; empty array, deferred to 2C) | Agent-extracted from narrative prose (location specialist subagent) |
| **Context efficiency** | Full JSON loaded every step | Selective file/query loading | Selective file/query loading; agent reads via 2B query tools |
| **Failure modes** | Parser bugs + empty/fabricated fields | Parser bugs | Parser bugs + agent hallucination + subagent coordination failures + Haiku model limits |
| **Offline capable** | Yes | Yes | No (requires active Claude Code session) |
| **Parser robustness** | State machine with validation (shared) | Same as 2A (shared) | Same as 2A (shared) |
| **Testing** | Low | Low-Medium | Agent behavior testing (run against test exports, verify output quality and turn citations) |
| **Worlds validated against** | HTTT only | HTTT, Counsellor2, TheWorldsAStage, TheRingOfDis | Same as 2B |

## Recommendation

**Start with 2B, design for 2C.** The original Proposal 2A is superseded -- cross-export analysis of 4 diverse worlds revealed that several of its schema fields (locations, plot milestones with summaries, character aliases and descriptions, unresolved threads) cannot be populated by deterministic parsing. 2A is preserved for historical reference only.

**Why 2B:** Implement the factual skeleton extraction with tracked item histories, character mention counts, per-turn section text, multi-file output, and query tools. This delivers the most value per complexity unit -- tracked item extraction and the factual skeleton directly address the structured data available in every export -- and establishes the schema, output structure, and agent consumption patterns that 2C builds on.

Cross-export analysis (HTTT 250 turns, Counsellor2 22 turns, TheWorldsAStage 4 turns, TheRingOfDis 30 turns) confirms that 2B's scope is realistic: the parser can reliably extract story background, player character sheet, objective, tracked item histories, hidden tracked item histories, and per-turn section text from any IW story export. The empty deferred arrays (relationships, events, locations) are honest about what requires narrative understanding.

**The 2B-to-2C upgrade path is now simpler than originally proposed.** The architectural shift from API calls to a plugin agent eliminates all of the original 2C implementation concerns: no API key management, no HTTP wrapper code, no dependency decisions (SDK vs. raw fetch), no quota exhaustion handling, no `mode` parameter on the MCP tool. The upgrade from 2B to 2C consists of: (1) writing the agent definition files (~200-400 lines of markdown prompts), and (2) extending the query tools to detect and join `narrative/` data (~100-150 lines of code). The MCP tool itself does not change at all -- 2B's deterministic extraction remains untouched, and the agent operates on top of its output. This means 2B can be implemented with full confidence that the 2C upgrade requires no redesign, no refactoring of 2B code, and no new dependencies.

**When 2C becomes essential:** 2C should be pursued after 2B is validated in real sequel-world sessions. The cross-export analysis makes a strong case: relationships, character descriptions, locations, and events are ALL narrative-only data that no deterministic parser can extract. For worlds with extensive tracked items (HTTT: Traits, Suggestions, Triggers, Current Date, hidden Obedient Characters), 2B captures significant structured value. For worlds with few or no tracked items (RingOfDis: zero tracked items across all 30 turns), 2B provides only the factual skeleton and per-turn text access -- 2C becomes essential for meaningful character and plot extraction in these worlds.
