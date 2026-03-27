# Story Data Extraction Tool — Design Specification

**Date:** 2026-03-27
**Status:** Draft
**Plugin:** Infinite Worlds Architect Plugin

---

## 1. Overview and Problem Statement

### Problem

The `sequel-world` command requires the agent to understand what happened in a completed story so it can build a sequel world configuration that reflects the story's outcomes. Currently, the command instructs the agent to "read the ENTIRE export" — a plain-text log of every turn in a played story. This approach breaks down at scale:

- **Story exports can exceed 20,000 lines spanning 250+ turns.** Loading this volume of unstructured text into the agent's context window displaces working memory needed for reasoning about the sequel world.
- **Hallucination and fabrication.** The agent invents character descriptions, misattributes dialogue, and fabricates location details that never appeared in the export.
- **Loss of early-story detail.** Information from the first third of a long story is reliably degraded or dropped entirely as later turns push it out of effective attention range.
- **Character and entity confusion.** The agent conflates similarly-named characters, merges distinct locations, and misassigns inventory items — errors that propagate into the sequel world JSON and produce incoherent continuations.

These are not edge cases. They are the expected behavior when an LLM is asked to hold hundreds of pages of narrative text in context and then perform precise structured extraction from it.

### Solution

Replace the "read everything" approach with a **deterministic, programmatic parser** that pre-processes story exports into structured JSON files. The agent never reads the raw export in bulk. Instead:

1. **`extract_story_data`** parses one or more export files and writes multiple focused JSON output files to a designated directory.
2. **`query_story_data`** lets the agent retrieve exactly the slice of story data it needs — metadata, tracked item state at a specific turn, or the full text of selected turns.

The parser is pure Node.js string processing. It identifies structural patterns in the export format (turn boundaries, header metadata, tracked-item state blocks) and emits indexed, queryable JSON. The agent can then make a small number of targeted queries rather than ingesting the entire export.

### Constraints

| Constraint | Rationale |
|---|---|
| **No LLM or NLP calls.** All parsing is deterministic string/regex processing. | Extraction must be reproducible, fast, and free of its own hallucination risk. |
| **No new dependencies.** Only Node.js built-ins (`fs`, `path`, etc.). | The plugin currently has zero runtime dependencies beyond `@modelcontextprotocol/sdk`. |
| **Text-only input (.txt).** | Infinite Worlds exports are plain-text files. PDF exports must be converted to text by the user before use. |
| **Must generalize across world types.** | The parser cannot hard-code knowledge of specific worlds' characters, locations, or items. It must discover tracked entities from the export's own structure. |

### Key Design Decisions

- **Multiple output files, not one monolith.** Extraction produces several small JSON files (metadata, turn index, tracked state snapshots) so the agent can load only what it needs. A manifest file describes what was extracted and where each file lives.
- **Snapshot-on-change for tracked state.** Rather than storing tracked-item state for every turn redundantly, the parser records a snapshot only when a tracked item's value changes. Querying state at turn N returns the most recent snapshot at or before N. Research shows tracked items change very infrequently (4 unique states across 22 turns; 14 across 250 turns), making this highly efficient.
- **Generic tracked-items parser.** The parser does not assume any internal structure within tracked item values beyond newline-separated key-value pairs. It discovers item names from structural patterns and stores values as raw strings.

---

## 2. MCP Tool Interface

### 2.1 `extract_story_data`

Parses one or more Infinite Worlds story export files and writes structured JSON output to a designated directory. The tool is **idempotent** — re-running it with the same inputs overwrites any previous extraction in the target directory.

#### Multi-File Combining

Infinite Worlds enforces a 100-turn export limit. A story longer than 100 turns must be exported as multiple sequential files. The combining logic works as follows:

- **Header metadata** is taken from the most recently modified input file (by filesystem mtime), on the assumption that the latest export reflects the most current story state.
- **Turns** are collected from all input files, keyed by turn number. When the same turn number appears in more than one file, the version from the file with the later mtime is preferred.
- **Final output** contains all collected turns sorted by turn number in ascending order.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "input_paths": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1,
      "description": "Absolute paths to one or more .txt story export files."
    },
    "extraction_dir": {
      "type": "string",
      "description": "Absolute path to the directory where output JSON files will be written. Created if it does not exist."
    }
  },
  "required": ["input_paths", "extraction_dir"],
  "additionalProperties": false
}
```

#### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `input_paths` | `string[]` | Yes | One or more absolute paths to `.txt` story export files. When multiple files are provided, they are combined using the multi-file merging logic described above. |
| `extraction_dir` | `string` | Yes | Absolute path to the output directory. Will be created if it does not exist. All output JSON files are written here. If the directory already contains output from a previous extraction, those files are overwritten. |

#### Return Value

Returns a JSON object summarizing the extraction results:

| Field | Type | Description |
|---|---|---|
| `success` | `boolean` | Whether extraction completed without error. |
| `total_turns` | `number` | Total number of unique turns extracted across all input files. |
| `turn_range` | `[number, number]` | The first and last turn numbers found. |
| `input_files_processed` | `number` | Number of input files that were successfully read and parsed. |
| `has_tracked_items` | `boolean` | Whether tracked items were found. |
| `has_hidden_tracked_items` | `boolean` | Whether hidden tracked items were found. |
| `files_written` | `string[]` | Filenames of all output JSON files written to `extraction_dir`. |
| `warnings` | `string[]` | Non-fatal issues encountered during parsing. Empty array if none. |

### 2.2 `query_story_data`

Reads previously extracted story data and returns the requested slice. There is **no "all" category** — the agent must make targeted queries for the specific data it needs.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "extraction_dir": {
      "type": "string",
      "description": "Absolute path to the directory containing extracted story data (same path passed to extract_story_data)."
    },
    "category": {
      "type": "string",
      "enum": ["manifest", "metadata", "tracked_state", "turn_index", "turn_detail"],
      "description": "The category of data to retrieve."
    },
    "turns": {
      "type": "array",
      "items": {
        "oneOf": [
          { "type": "integer", "minimum": 1 },
          { "type": "string", "enum": ["last"] }
        ]
      },
      "description": "Turn number(s) to query. Required for 'tracked_state' and 'turn_detail'. Supports the special value 'last' which resolves to the highest turn number."
    }
  },
  "required": ["extraction_dir", "category"],
  "additionalProperties": false
}
```

#### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `extraction_dir` | `string` | Yes | Absolute path to the extraction output directory. |
| `category` | `string` | Yes | One of the five query categories described in Section 5. |
| `turns` | `(integer \| "last")[]` | Conditional | Required when `category` is `"tracked_state"` or `"turn_detail"`. Ignored for other categories. `"last"` resolves to the highest turn number. Can be mixed: `[1, "last"]`. |

#### Return Value

| Field | Type | Description |
|---|---|---|
| `success` | `boolean` | Whether the query completed without error. |
| `category` | `string` | The category that was queried (echoed back). |
| `data` | `object \| array` | The query result. Structure varies by category (see Section 5). |
| `error` | `string \| null` | Error message if `success` is `false`. `null` on success. |

---

## 3. Parser Design

The parsing pipeline consists of four sequential phases. Each phase's output feeds the next.

### 3.1 Phase 1: Multi-File Combining

When the tool receives multiple input files, it produces a single unified document before parsing begins.

**Algorithm:**

1. For each input file path, call `stat()` to obtain the file's modification timestamp (`mtime`).
2. Sort files by `mtime` ascending.
3. Read each file's full text content into memory, preserving original line numbers per file.
4. **Header metadata resolution:** Extract header metadata (title, story background, character name/background/skills) from the **most recently modified file only**.
5. **Turn collection:** Scan every file for turn blocks (delimited by `-- Turn N --`). Collect all turns into a map keyed by turn number. If the same turn number appears in multiple files, the version from the file with the later mtime wins.
6. Sort the combined turn map by turn number ascending.
7. **Manifest generation:** Record which files contributed which turns, and which turns were overridden.

**Output:** A combined header text block, an ordered list of turn text blocks with source file + line range metadata, and the manifest.

### 3.2 Phase 2: Header Parsing

Header parsing uses a line-by-line state machine that processes text from the beginning of the document up to the first `-- Turn 1 --` delimiter.

#### Structural Markers

| Marker | Regex Pattern | Captures |
|--------|--------------|----------|
| Title | `/^==\s*(.+?)\s*==$/` on first non-empty line | Title string |
| Story Background | `/^-- Story Background --$/` | All text until next `-- ... --` header |
| Character block | `/^-- Character --$/` | Enters character sub-parser |
| Objective | `Your objective for this adventure is:` between `- - - - -` dividers | Objective text (extracted during Turn 1 parsing, stored as header metadata) |

#### State Machine

```
INIT → TITLE → SEEKING_SECTION → STORY_BACKGROUND → SEEKING_SECTION
                                → CHARACTER → (sub-states) → SEEKING_SECTION
                                → DONE (on Turn 1 delimiter)
```

#### Character Sub-Parser

Within the `CHARACTER` state, subsections are detected by the **subsection header pattern**: a text line followed immediately by a line of 4+ dashes.

| Subsection | Captures |
|-----------|----------|
| `Name` | Character name (typically single line) |
| `Background` | Character background (may be multi-paragraph) |
| `Skills` | Lines matching `/^(.+?):\s*(\d+)\s*\(([^)]+)\)$/` → skill name, numeric rating, level label |

The character sub-parser exits when it encounters a `-- ... --` header that is not a recognized subsection.

#### Objective Extraction

The objective appears inside Turn 1's content (not in the pre-turn header area):

1. Locate `- - - - -` divider line within Turn 1.
2. Find `Your objective for this adventure is:` line.
3. Capture text until the closing `- - - - -` divider.
4. If not found, set objective to `null`.

### 3.3 Phase 3: Turn Parsing

#### Turn Splitting

**Turn delimiter regex:** `/^-- Turn (\d+) --$/m`

Requirements: line begins with `-- Turn `, followed by one or more digits, followed by ` --`, with nothing else on the line. Always preceded and followed by blank lines.

For each match, the turn block spans from the delimiter to the next delimiter or EOF. Line ranges (start/end in original file) are recorded for drill-down support.

#### Turn State Machine

| State | Entry Marker | Exit |
|-------|-------------|------|
| `ACTION` | `Action\n------` (text line + 4+ dashes) | Next section marker or turn boundary |
| `OUTCOME` | `Outcome\n-------` | Next section marker or turn boundary |
| `SECRET_INFO` | `Secret Information\n------------------` | Next section marker or turn boundary |
| `TRACKED` | `Tracked Items\n-------------` | `Hidden Tracked Items` header or turn boundary |
| `HIDDEN_TRACKED` | `Hidden Tracked Items\n--------------------` | Turn boundary or EOF |

Section markers are detected by the two-line pattern: text line immediately followed by a line of 4+ dashes. Sections can appear in any order; the parser does not enforce ordering.

**Turn 1 special handling:** Turn 1 has no `Action` section (the first narrative section is `Outcome`). The objective block is extracted from Turn 1 and stored as header metadata.

#### Turn Output

Each turn produces: `{ turn_number, action, outcome, secret_info, tracked_items, hidden_tracked_items, source: { file, start_line, end_line } }`

### 3.4 Phase 4: Generic Tracked Items Parsing

Applies identically to both `TRACKED` and `HIDDEN_TRACKED` content. The parser treats tracked items as an opaque key-value store.

#### Item Header Detection

**Pattern:** `/^[^\n:]+:\s*$/m`

A line is an item header if and only if it ends with a colon followed by optional whitespace and end-of-line, with no other content after the colon.

**Critical discriminator:** Lines like `Lilith: Intelligent, Cruel, Ambitious` have content after the colon — these are sub-entries within a value, NOT new item headers.

| Line | Item Header? | Reason |
|------|:---:|--------|
| `ViviDevelopment:` | Yes | Colon at end, nothing after |
| `Traits:` | Yes | Colon at end, nothing after |
| `Current Date:` | Yes | Colon at end, nothing after |
| `Lilith: Intelligent, Cruel` | No | Content after colon |
| `Gold: 500` | No | Content after colon |

#### Splitting Algorithm

1. Split section text on `\n\n` (blank line) followed by a line matching the item header pattern.
2. For each segment: first line is the key (strip trailing colon), remainder is the value (trimmed).
3. Empty values stored as `""`.

This preserves blank lines within multi-line values (e.g., character trait lists separated by double blank lines within a Traits item) because the lines after those internal blanks have content after their colons and thus don't match the item header pattern.

#### Edge Cases

| Case | Behavior |
|------|----------|
| Turn has no tracked items section | Return `null` |
| Section exists but empty | Return `{}` |
| Item header with no value | Store as `""` |
| Value contains internal blank lines | Preserved; only blanks before item headers trigger splits |

### 3.5 Delimiter Collision Analysis

Each delimiter has been validated against narrative prose across five tested exports totaling 349 turns. Zero false positives observed.

| Delimiter | Why Collision Is Implausible |
|-----------|------------------------------|
| `-- Turn N --` | Requires literal "Turn" + bare integer between dashes on an empty line. Prose like "-- Turn around --" has no bare integer. |
| Section headers (`Action\n------`) | Requires a bare keyword on its own line immediately followed by a line of only dashes. Does not occur in natural prose. |
| Item header (`Word:\s*$`) | Requires colon at end-of-line with nothing after. In prose, colons are followed by content. |
| Title (`== ... ==`) | Only tested on first non-empty line of document. |
| Objective divider (`- - - - -`) | Only checked within Turn 1. |

**Mitigation for future collisions:** If adversarial content produces false positives, add contextual validation (e.g., turn number within expected range, section markers appearing in structurally plausible positions).

### 3.6 Error Handling

| Condition | Severity | Behavior |
|-----------|----------|----------|
| File not found or unreadable | Error | Halt with OS error. |
| No title found | Warning | Set `title` to `null`. |
| No `-- Turn 1 --` in any file | Error | Halt — no parseable turns. |
| Turn number gap | Warning | Record missing numbers. Continue. |
| Turn 1 has Action section | Warning | Accept and store. |
| Duplicate turn after combining | Error | Bug in Phase 1. |
| Section appears twice in one turn | Warning | Append content with `\n\n`. |

All warnings include source file, line number, and description.

---

## 4. Output File Structure

Four JSON files written to `extraction_dir`.

### 4.1 manifest.json

**Always written.** Entry point for agent consumption.

```json
{
  "version": "1.0",
  "source_files": [
    {
      "path": "/path/to/export-part1.txt",
      "turns": [1, 100],
      "modified": "2026-03-20T14:30:00Z"
    },
    {
      "path": "/path/to/export-part2.txt",
      "turns": [95, 200],
      "modified": "2026-03-25T09:15:00Z"
    }
  ],
  "header_source": "/path/to/export-part2.txt",
  "total_turns": 200,
  "has_tracked_items": true,
  "has_hidden_tracked_items": true,
  "files": ["manifest.json", "metadata.json", "tracked_state.json", "turn_index.json"]
}
```

- `files` only lists files actually written (e.g., `tracked_state.json` omitted if no tracked items exist).
- `source_files[].turns` is `[first_turn, last_turn]` range from that file.

### 4.2 metadata.json

**Always written.** Story header metadata.

```json
{
  "title": "The Counsellor 2: Cat and Mouse (Remastered)",
  "story_background": "Dr. Adrian Stern adjusted his glasses...",
  "objective": "To manipulate and condition Vivian Zhao...",
  "character": {
    "name": "Dr. Adrian Stern",
    "background": "A tenured professor at an elite American university...",
    "skills": {
      "Hypnosis": { "rating": 5, "level": "Exceptional" },
      "Deception": { "rating": 3, "level": "Competent" },
      "Persuasion": { "rating": 4, "level": "Highly skilled" },
      "Observation": { "rating": 4, "level": "Highly skilled" },
      "Manipulation": { "rating": 5, "level": "Exceptional" }
    }
  },
  "total_turns": 22
}
```

- `objective` is `null` if the export doesn't contain one.
- Text fields preserve full original content including paragraph breaks.

### 4.3 tracked_state.json

**Written only when tracked items exist.** Uses snapshot-on-change deduplication.

```json
{
  "snapshots": [
    {
      "from_turn": 1,
      "to_turn": 14,
      "tracked_items": {
        "ViviDevelopment": "0",
        "VivianPersonality": "Vivian-dominant"
      },
      "hidden_tracked_items": {
        "Suspicion": "0",
        "InvestigationInterest": "0"
      }
    },
    {
      "from_turn": 15,
      "to_turn": 15,
      "tracked_items": {
        "ViviDevelopment": "6",
        "VivianPersonality": "Vivian-dominant"
      },
      "hidden_tracked_items": {
        "Suspicion": "0",
        "InvestigationInterest": "0"
      }
    },
    {
      "from_turn": 16,
      "to_turn": 22,
      "tracked_items": {
        "ViviDevelopment": "11",
        "VivianPersonality": "Vivian-dominant"
      },
      "hidden_tracked_items": {
        "Suspicion": "0",
        "InvestigationInterest": "0"
      }
    }
  ]
}
```

- Snapshots are contiguous and non-overlapping. Every turn falls within exactly one snapshot.
- New snapshot emitted when any tracked value differs from previous.
- All values are strings (parser is generic, does not interpret values).
- `hidden_tracked_items` is `null` within a snapshot when that section doesn't exist for those turns.
- Query for turn N: find snapshot where `from_turn <= N <= to_turn`.

### 4.4 turn_index.json

**Always written.** ~2-5 KB for short stories, ~30 KB for 250 turns.

```json
{
  "turns": [
    {
      "number": 1,
      "has_action": false,
      "action_preview": null,
      "outcome_preview": "Maria's climax echoes through the soundproofed office...",
      "has_secret_info": true,
      "has_tracked_items": true,
      "line_range": [65, 169],
      "source_file": "/path/to/export.txt"
    },
    {
      "number": 2,
      "has_action": true,
      "action_preview": "Begin Vivian's intake session with standard...",
      "outcome_preview": "The knock comes at precisely 2:00 PM...",
      "has_secret_info": true,
      "has_tracked_items": true,
      "line_range": [170, 285],
      "source_file": "/path/to/export.txt"
    }
  ]
}
```

- Previews truncated to 200 characters.
- `source_file` + `line_range` enable `turn_detail` drill-down into original export.
- `has_action` is always `false` for turn 1.

---

## 5. Query Categories

### 5.1 manifest

Returns full `manifest.json` content. Recommended first query — tells the agent what data is available, how many turns exist, and which files were produced.

### 5.2 metadata

Returns full `metadata.json` content. Primary source for Title, Description, Background, Skills, and Objective fields in a sequel world.

### 5.3 tracked_state

**Requires `turns` parameter.** For each requested turn, finds the snapshot where `from_turn <= turn <= to_turn` and returns that snapshot's data.

Returns an array of objects:

```json
[
  {
    "turn": 15,
    "tracked_items": { "ViviDevelopment": "6", "VivianPersonality": "Vivian-dominant" },
    "hidden_tracked_items": { "Suspicion": "0", "InvestigationInterest": "0" }
  }
]
```

If `tracked_state.json` does not exist, returns an error indicating tracked state is not available.

### 5.4 turn_index

Returns full `turn_index.json` content. The agent uses this to scan turn previews and identify turns of interest before drilling in with `turn_detail`.

### 5.5 turn_detail

**Requires `turns` parameter.** Reads specific turns from the original export file using line ranges from the turn index.

Returns an array of objects:

```json
[
  {
    "turn": 1,
    "action": null,
    "outcome": "Full outcome text...",
    "secret_info": "Full secret info text..."
  }
]
```

If the original source file has been moved or deleted since extraction, returns an error.

### 5.6 The `"last"` Alias

All categories accepting `turns` support `"last"`, which resolves to the highest turn number. Can be mixed with numbers: `[1, "last"]` resolves to `[1, 22]` for a 22-turn story.

---

## 6. Agent Consumption Workflow

### Bootstrap

The agent calls `extract_story_data` once at the start, then uses `query_story_data` throughout the field-by-field sequel-world walkthrough.

### Field-by-Field Query Patterns

| Sequel Field(s) | Query Sequence | Rationale |
|---|---|---|
| **Title, Description, Background, Objective** | `"manifest"` → `"metadata"` → `"turn_detail"` for first and last turns | Metadata gives raw fields. First/last turn detail shows arc endpoints. Agent synthesizes sequel description. |
| **First Action** | `"metadata"` (objective) → `"turn_detail"` for last turn | Sequel picks up where story ended. Agent needs final narrative state. |
| **Skills, Possible Characters** | `"metadata"` (existing skills) → `"tracked_state"` at last turn | Skills carry forward. Tracked state reveals final character dispositions. |
| **NPCs** | `"turn_index"` (scan previews) → `"turn_detail"` for key turns (early, middle, late) | Turn index previews help identify character-relevant turns. Agent reads Secret Info blocks to determine character roles and final states. |
| **Tracked Items** | `"tracked_state"` at last turn | Direct extraction — exact final values for every tracked item. |
| **Trigger Events** | `"tracked_state"` at last turn → `"turn_detail"` for turns with trigger mechanics | Tracked state shows existing triggers. Turn detail provides context. |
| **Instructions, Author Style** | `"metadata"` (background/objective) → `"turn_index"` (sample outcome previews) | Agent calibrates narrative voice from preview strings. |

### Context Budget

For a 250-turn story (worst case):

| Data | Tokens |
|------|--------|
| Manifest | ~200 |
| Metadata | ~500 |
| Turn index (250 entries) | ~3,000 |
| Tracked state (last turn) | ~500 |
| 5-6 individual turn details | ~15,000 |
| **Total** | **~20,000** |

Compare: loading the raw 250-turn export consumes ~200,000+ tokens.

### Sequel-World Command Update

The `commands/sequel-world.md` file must be updated:

- Remove the "read the ENTIRE export" instruction.
- Add a step to call `extract_story_data` with the export file path(s).
- Replace raw export reads with `query_story_data` calls at each field.
- Add guidance to use `"turn_index"` for selecting turns to drill into.
- Preserve the existing field-by-field walkthrough structure.

---

## 7. Limitations

### What Deterministic Parsing Cannot Do

1. **Cannot summarize narrative arcs.** The agent still reads prose — but now reads targeted turns instead of everything.
2. **Cannot extract character rosters from prose.** For exports without structured character data in tracked items (like RingOfDis), the agent must read Secret Info via `turn_detail` and identify characters itself.
3. **Cannot determine character relationships.** Relationships are expressed in narrative, not structure.
4. **Cannot detect theme or tone.** Semantic properties of prose, not parseable.

### Where It Helps Most

- **Eliminates "read the ENTIRE export."** Context usage drops by an order of magnitude.
- **Prevents hallucination of tracked item values.** Exact final state from the parser, not the agent's fuzzy recall.
- **Prevents early/late state confusion.** Per-turn snapshots show what was true when.
- **Prevents character name confusion.** Tracked item strings are exact as written.

### Edge Cases

| Scenario | Behavior |
|---|---|
| Export with no tracked items (RingOfDis) | `tracked_state.json` not written. Manifest: `has_tracked_items: false`. Agent falls back to `turn_detail`. |
| Single-turn export | Works correctly. One-entry turn index. |
| Malformed turn delimiters | Parser extracts what it can. Warnings in manifest. |
| Empty tracked item values | Stored as `""`. |
| Very long tracked item values | Stored verbatim, no truncation. |

---

## 8. Test Matrix

### Test Exports

| Export | Turns | What It Tests |
|---|---|---|
| **Counsellor2_Turn22.txt** | 22 | Simple key-value tracked items. Hidden tracked items. Structured Secret Info with SECRETINFO markers (treated as raw text, not specially parsed). |
| **TheWorldsAStageTurn4.txt** | 4 | Minimal export. List-style tracked items with empty values. Short Secret Info. |
| **TheRingOfDisTurn30.txt** | 30 | NO tracked items at all. Prose-only Secret Info. Graceful absence handling. |
| **IW_HowTheTurnsTable_Export_Turns1-250.txt** | 250 | Large export. Complex tracked items (Traits/Suggestions/Triggers as sub-entries). Hidden tracked items. Snapshot deduplication with infrequent changes. Performance. |
| **Multi-file combining** | N/A | Split HTTT into overlapping files. Verify: header from most recent file, overlap resolution, correct ordering. |

### Validation Checklist

For each export:

- [ ] Correct title, character name, background, skills extracted
- [ ] Correct total turn count
- [ ] All turn boundaries detected with correct line ranges
- [ ] Action/Outcome/Secret Info text matches original exactly
- [ ] Tracked items parsed correctly (or null when absent)
- [ ] Snapshots deduplicated correctly
- [ ] `turn_detail` returns correct text for arbitrary turns
- [ ] `tracked_state` returns correct state for arbitrary turns
- [ ] `turn_index` returns all turns with correct previews
- [ ] `manifest` and `metadata` return consistent data

### Performance Targets

| Export | Parse Time | Output Size |
|---|---|---|
| TheWorldsAStageTurn4.txt (4 turns) | < 100ms | < 10 KB |
| Counsellor2_Turn22.txt (22 turns) | < 200ms | < 50 KB |
| TheRingOfDisTurn30.txt (30 turns) | < 200ms | < 75 KB |
| HTTT 250 turns | < 2s | < 500 KB |
| Multi-file combine (300 turns) | < 3s | < 600 KB |
