# Story Data Extraction Tool — Implementation Plan

**Date:** 2026-03-28
**Status:** Implementation Ready
**Related:** Design Spec: `2026-03-27-story-data-extraction-design.md`

---

## Overview

This plan provides step-by-step implementation guidance for the Story Data Extraction Tool, a two-tool MCP addition that replaces the "read entire export" approach with deterministic parsing and targeted queries.

**Tools to implement:**
1. `extract_story_data` — Parse exports, write structured JSON files
2. `query_story_data` — Query extracted data by category

**Total effort:** ~2000 lines of code across 10 modules + tests.
**Dependency risk:** Zero (Node.js builtins only).
**Integration complexity:** Moderate (MCP server registration + handler routing).

---

## 1. File Structure and Module Organization

### Directory Structure

```
infinite-worlds-architect-plugin/
├── index.js (MCP server; register tools, route requests)
├── lib/
│   ├── parsers/
│   │   ├── index.js (orchestrate all phases)
│   │   ├── phase1-combining.js (multi-file combining)
│   │   ├── phase2-headers.js (header parsing)
│   │   ├── phase3-turns.js (turn parsing)
│   │   ├── phase4-tracked-items.js (tracked item parsing)
│   │   └── utils.js (shared regex patterns, helpers)
│   ├── handlers/
│   │   ├── extraction.js (extract_story_data handler)
│   │   ├── query.js (query_story_data handler)
│   │   └── output-writer.js (write JSON files to disk)
│   └── validation.js (input validation)
├── .claude-plugin/
│   └── plugin.json (MCP manifest)
└── test-files/ (existing; story export test fixtures)
```

### Module Responsibilities

| Module | Lines | Responsibility |
|--------|-------|-----------------|
| `parsers/index.js` | 80–120 | Orchestrate phases, merge results |
| `parsers/phase1-combining.js` | 150–220 | Combine files, deduplicate turns, resolve header |
| `parsers/phase2-headers.js` | 200–280 | State machine for header metadata |
| `parsers/phase3-turns.js` | 180–260 | State machine for turns and sections |
| `parsers/phase4-tracked-items.js` | 120–160 | Parse items, generate snapshots |
| `parsers/utils.js` | 100–140 | Regex patterns, helper functions |
| `handlers/extraction.js` | 60–100 | MCP handler for extract_story_data |
| `handlers/query.js` | 140–180 | MCP handler for query_story_data |
| `handlers/output-writer.js` | 80–120 | Write manifest, metadata, turn_index, tracked_state |
| `validation.js` | 70–100 | Validate tool inputs |
| **Tests** | 400–600 | Unit + integration tests |

**Total:** ~1600–2100 lines of source code + 400–600 lines of tests.

### Dependency Graph

```
index.js (MCP server)
  ├─→ handlers/extraction.js
  │     ├─→ parsers/index.js
  │     │     ├─→ phase1-combining.js (→ utils.js)
  │     │     ├─→ phase2-headers.js (→ utils.js)
  │     │     ├─→ phase3-turns.js (→ utils.js, phase4-tracked-items.js for tracked sections)
  │     │     └─→ phase4-tracked-items.js (→ utils.js)
  │     ├─→ handlers/output-writer.js
  │     └─→ validation.js
  │
  └─→ handlers/query.js
        └─→ validation.js
```

**Key principles:**
- Parsers are **pure functions** (no file I/O, no side effects) — easy to test in isolation.
- Handlers manage I/O and error marshaling.
- `utils.js` has no internal dependencies.
- **Phase 4 organization note:** Phase 4 is called from Phase 3 (when parsing Tracked/Hidden Tracked sections) but is a separate module. Do NOT merge them; Phase 4 logic is complex enough to warrant its own module for testability. Keep the separation.

---

## 2. Implementation Steps

### Phase A: Setup & Scaffolding

**Steps:**
1. Create directory structure: `mkdir -p lib/parsers lib/handlers`
2. Create stub files with placeholder exports:
   - `lib/parsers/index.js` → `export async function parse() { }`
   - All handler files → stub functions
   - `lib/validation.js` → stub validation functions
3. Do NOT modify `index.js` or `plugin.json` yet.

**Validation:** Verify no TypeScript/build errors. `node index.js` should start without errors (if run in isolation).

---

### Phase B: Implement Parsers (Pure Functions)

**Order matters:** Each phase depends on conceptual correctness of the previous one.

#### Step 1: Implement `lib/parsers/utils.js` (foundational)

**Content:**
- Regex patterns (all in one `PATTERNS` object):
  - `TURN_DELIMITER` = `/^-- Turn (\d+) --$/m`
  - `TITLE` = `/^==\s*(.+?)\s*==$/`
  - `SECTION_HEADER` = `/^(.+?)\n-{4,}$/m` (two-line pattern)
  - `ITEM_HEADER` = `/^[^\n:]+:\s*$/m` (item: no content after colon)
  - `SKILL_LINE` = `/^(.+?):\s*(\d+)\s*\(([^)]+)\)$/`
  - `OBJECTIVE_DIVIDER` = `/- - - - -/`

- Helper functions:
  - `getFileMtime(path)` — stat file, return mtime
  - `extractBetweenMarkers(text, start, end)` — find text between markers
  - `splitOnPattern(text, pattern)` — split respecting pattern boundaries
  - `trimLines(text)` — trim leading/trailing whitespace
  - `parseSkillLine(line)` → `{ name, rating: number, level: string } | null`
  - `lineCount(text)` → number of lines
  - `withLineNumbers(text)` → add line numbers for debugging

**Test:** Create `test/parsers/utils.test.js`. Test regex patterns against sample text snippets from test exports.

---

#### Step 2: Implement `lib/parsers/phase1-combining.js`

**Function:** `async function combine(filePaths) → { header, turns, manifest, warnings }`

**Algorithm:**
1. Stat all files, sort by mtime ascending.
2. Read file contents, preserving line numbers.
3. For each file:
   - Scan for turn delimiters (`-- Turn N --`).
   - Collect turns into a Map keyed by turn number (number not string).
   - When same turn appears in multiple files, keep the version from the file with the later mtime.
4. Extract header from the most recently modified file only.
5. **Turn number continuity:**
   - Convert Map to array and sort by turn number ascending.
   - Detect gaps (e.g., turns 1-50, then 95-100) and record as warnings: "Turns 51-94 appear to be missing."
   - Allow gaps; extraction succeeds even with discontinuous turn numbers.
   - Reject Turn 1 being completely absent (throw fatal error).
6. Generate manifest recording: source files, turn ranges per file, detected gaps, deduplication notes.
7. Return: `{ header: string, turns: Array<{number, content, sourceFile, lineRange}>, manifest: object, warnings: string[] }`

**Special case:** If mtime is identical on overlapping turns (millisecond-precision collision), prefer the file that appears first in the input `filePaths` array.

**Test:** Create `test/parsers/phase1-combining.test.js`. Test with:
- Single file: verify turns extracted correctly
- Multi-file: overlapping turns, header priority to newest file
- Gap detection: turns 1-10, 50-60 (gap 11-49) should warn but not error
- Out-of-order turn blocks: a file with turns in order Turn 5, Turn 3, Turn 10 should be sorted to 3, 5, 10
- Missing Turn 1: error case (fatal)

---

#### Step 3: Implement `lib/parsers/phase2-headers.js`

**Function:** `function parseHeaders(headerText, turn1Text) → { title, storyBackground, character, objective }`

**Algorithm:**
- Implement line-by-line state machine (INIT → TITLE → SEEKING_SECTION → STORY_BACKGROUND/CHARACTER/DONE)
- Extract title from first non-empty line matching `/^==\s*(.+?)\s*==$/`
- Extract story background between `-- Story Background --` and next `-- ... --`
- For CHARACTER block:
  - Detect subsections (Name, Background, Skills) via two-line pattern
  - Parse skills: `/^(.+?):\s*(\d+)\s*\(([^)]+)\)$/`
  - **If CHARACTER section is present but empty or contains only subsection headers with no data**, record as warning but don't fail
  - Exit on `-- ... --` that's not a recognized subsection
- Extract objective from Turn 1:
  - Find `- - - - -` divider (if it exists; continuation exports may not have objective)
  - Locate `Your objective for this adventure is:` line (case-insensitive search)
  - Capture text until closing divider
  - If no objective found, return null and warn
- **Continuation export handling:** If input files are mid-story exports (no header section, only turns), call parseHeaders with empty headerText and extract only objective from turn1Text. This is a valid scenario.
- Return structured header object with all fields nullable: `{ title, storyBackground, character: null, objective }`

**Test:** Create `test/parsers/phase2-headers.test.js`. Test with:
- Real export headers from test files
- Continuation export (no header, only Turn 1 with objective)
- Missing objective section in Turn 1
- CHARACTER section that's empty after subsection headers

---

#### Step 4: Implement `lib/parsers/phase3-turns.js`

**Function:** `function parseTurns(combinedText, turns) → Array<{ number, action, outcome, secretInfo, trackedItems, hiddenTrackedItems, source, lineRange }>`

**Algorithm:**
- For each turn block (from Phase 1):
  - Implement turn state machine (INIT, ACTION, OUTCOME, SECRET_INFO, TRACKED, HIDDEN_TRACKED)
  - Detect sections using two-line pattern: `\n(.+)\n-{4,}`
  - **Special case Turn 1:** action field is null (no Action section exists in Turn 1)
  - **Special case empty sections:** If a section header exists but content is empty/whitespace-only, record section as null (not empty string)
  - Accumulate text for each section until next section header or turn boundary
  - If Tracked/Hidden Tracked sections exist, call Phase 4 parser on their content
  - Record source file path and exact line range [startLine, endLine]
  - Warn if section header is detected but next section delimiter is malformed
- Return array of turn objects, preserving turn number order from Phase 1

**Test:** Create `test/parsers/phase3-turns.test.js`. Test with:
- Real turn content from test files
- Turn 1 (verify action is null, outcome/objective present)
- Empty section (section header with no content before next section)
- Missing Outcome section (only Action present)
- Tracked/Hidden Tracked sections (passed to Phase 4)

---

#### Step 5: Implement `lib/parsers/phase4-tracked-items.js`

**Functions:**
- `parseTrackedItems(sectionText) → { key: value, ... } | null`
- `generateSnapshots(trackedPerTurn) → Array<{ fromTurn, toTurn, trackedItems, hiddenTrackedItems }>`

**Algorithm (parseTrackedItems):**
- If section text is null, empty, or whitespace-only, return null
- To detect item headers: match lines like `SomethingHere:` (ends with colon, no content after)
  - Use regex: `/^([^:\n]+):\s*$/m` to find item headers
  - **Critical:** Reject false positives like "URL: http://example.com" (content after colon) — these are NOT item headers
- Split section by item headers; for each segment:
  - Key = the header line (strip trailing colon and whitespace)
  - Value = all subsequent lines until next item header or end of section (trimmed)
- Return object where all values are strings; if a key has no value (header at end of section), value is empty string ""
- Handle multi-line values (items can span multiple lines)

**Algorithm (generateSnapshots):**
- Input: array of turns, each with { trackedItems, hiddenTrackedItems } (both nullable)
- Iterate through turns in order (1, 2, 3, ...)
- **State comparison:** A state change occurs when:
  - Any key in tracked_items has a different value (null treated as missing)
  - Any key in hidden_tracked_items has a different value
  - tracked_items transitions from null to object or vice versa
  - hidden_tracked_items transitions from null to object or vice versa
- When state changes, emit snapshot: `{ fromTurn: lastTurn, toTurn: currentTurn - 1, trackedItems: lastState.tracked, hiddenTrackedItems: lastState.hidden }`
- After the loop, if there's a final state, emit a final snapshot: `{ fromTurn: lastChangePoint, toTurn: maxTurnNumber, trackedItems, hiddenTrackedItems }`
- **Snapshot structure guarantee:** Every snapshot has both fields; values are either null or a non-empty object `{ key: value, ... }`
- Every turn number falls within exactly one snapshot's [fromTurn, toTurn] range (inclusive)
- Return sorted snapshots array

**Test:** Create `test/parsers/phase4-tracked-items.test.js`. Test with:
- Item parsing: simple items, multi-line values, empty values, false positive rejection
- Snapshot generation: state changes, null transitions, consecutive unchanged turns
- Edge case: all turns have null tracked_items (should produce one snapshot covering all turns with both fields null)

---

#### Step 6: Implement `lib/parsers/index.js` (Orchestrator)

**Function:** `async function parse(inputPaths, extractionDir) → { phases, manifest, errors, warnings }`

**Algorithm:**
1. Call `combine(inputPaths)` — Phase 1
2. Call `parseHeaders(header, turn1)` — Phase 2
3. Call `parseTurns(combinedText, turns)` — Phase 3
4. For each turn, call `parseTrackedItems(trackedText)` — Phase 4
5. Call `generateSnapshots(trackedPerTurn)` — build snapshot array
6. Assemble result: `{ phases: { header, turns, snapshots }, manifest, warnings }`
7. Return to handler

**Test:** Create `test/parsers/integration.test.js`. End-to-end test with full test exports.

**Validation checkpoint:**
- [ ] All unit tests pass for phases 1-4
- [ ] Integration test passes: parse 4-turn, 22-turn, 30-turn, 250-turn exports correctly
- [ ] Performance: 250-turn export parses in < 2 seconds
- [ ] All warning messages are collected correctly

---

### Phase C: Implement Handlers & Output Writing

#### Step 7: Implement `lib/validation.js`

**Functions:**
- `validateExtractInput(inputPaths, extractionDir)` → `{ valid: boolean, errors: string[] }`
- `validateQueryInput(extractionDir, category, turns)` → `{ valid: boolean, errors: string[] }`

**Validation logic:**

**extractInput:**
- inputPaths: must be non-empty array of strings
- Each path: must exist (fs.statSync), must be readable
- extractionDir: must be a string, may not exist (will be created), parent directory must exist and be writable
- If errors found, return `{ valid: false, errors: [list of error messages] }`

**queryInput:**
- extractionDir: must exist and be readable
- category: must be one of: "manifest", "metadata", "turn_index", "tracked_state", "turn_detail"
- turns: must be array of integers or strings, non-empty; each element is number or "last" (case-sensitive)
- If errors found, return `{ valid: false, errors: [...] }`

**Error messages should be actionable:**
- "Input path does not exist: /path/to/file"
- "Parent directory not writable: /path/to"
- "Invalid category 'foo'; valid categories: manifest, metadata, ..."
- "turns parameter must be non-empty array of integers or 'last'"

**Test:** Create `test/validation.test.js`. Test valid and invalid inputs for both functions.

---

#### Step 8: Implement `lib/handlers/output-writer.js`

**Function:** `async function writeOutputFiles(extractionDir, parsedHeader, parsedTurns, snapshots, manifest) → { filesWritten: [filenames], warnings }`

**Files to write (all to extractionDir):**

1. **manifest.json**
   ```json
   {
     "version": "1.0",
     "source_files": [
       { "path": "filename", "turns": [first, last], "mtime_ms": timestamp }
     ],
     "header_source": "filename or null",
     "total_turns": number,
     "has_tracked_items": boolean,
     "has_hidden_tracked_items": boolean,
     "detected_gaps": ["Turns 51-94 missing"]
   }
   ```

2. **metadata.json**
   ```json
   {
     "title": string | null,
     "story_background": string | null,
     "objective": string | null,
     "character": { "name": string | null, "background": string | null, "skills": [...] } | null,
     "total_turns": number
   }
   ```

3. **turn_index.json** (always)
   ```json
   {
     "turns": [
       {
         "number": number,
         "has_action": boolean,
         "action_preview": string | null (first 100 chars, null if no action),
         "outcome_preview": string (first 100 chars of outcome, never null),
         "has_secret_info": boolean,
         "has_tracked_items": boolean,
         "line_range": [startLine, endLine],
         "source_file": "filename"
       }
     ]
   }
   ```

4. **tracked_state.json** (only if any turn has tracked_items or hidden_tracked_items)
   ```json
   {
     "snapshots": [
       {
         "from_turn": number,
         "to_turn": number,
         "tracked_items": { key: value } | null,
         "hidden_tracked_items": { key: value } | null
       }
     ]
   }
   ```

**Algorithm:**
- Create `extractionDir` if it doesn't exist
- **Atomic writes:** Write each file to a temporary name (e.g., `manifest.json.tmp`), then rename atomically
- If directory creation fails, throw (user must have write permission)
- Build each JSON structure, validate JSON.parse() succeeds
- For outcome_preview: extract first 100 characters of outcome section (trimmed), handle newlines
- Line range must reflect actual source file line numbers (from Phase 1)
- **Critical:** Always include manifest.json and metadata.json; only skip tracked_state.json if no tracked items exist in any turn
- Return object: `{ filesWritten: [manifest.json, metadata.json, turn_index.json, ...], warnings: [] }`

**Test:** Create `test/handlers/output-writer.test.js`. Test:
- JSON schema correctness
- File write success
- Atomic rename behavior
- Outcome preview truncation
- Manifest gaps field formatting

---

#### Step 9: Implement `lib/handlers/extraction.js`

**Function:** `async function extractStoryData(inputPaths, extractionDir) → { success, totalTurns, turnRange, inputFilesProcessed, hasTrackedItems, hasHiddenTrackedItems, filesWritten, warnings }`

**Algorithm:**
1. Validate inputs using `validation.js`
2. Call `parsers/index.js` to parse
3. Call `output-writer.js` to write files
4. Collect warnings from both
5. Return summary object

**Error handling:**
- Catch parsing errors, return with `success: false`
- Catch file write errors, return with `success: false`
- Fatal errors (no Turn 1): throw to MCP handler

**Test:** Create `test/handlers/extraction.test.js`. Test with real exports, verify all output files written correctly.

---

#### Step 10: Implement `lib/handlers/query.js`

**Function:** `async function queryStoryData(extractionDir, category, turns) → { success, category, data, error }`

**Category handlers:**

- **`manifest`**: Load and return manifest.json
- **`metadata`**: Load and return metadata.json
- **`tracked_state`**: Load tracked_state.json (error if missing), resolve "last" to max turn from manifest, find snapshots for each requested turn, return snapshot data
- **`turn_index`**: Load and return turn_index.json
- **`turn_detail`**: Load turn_index.json, resolve "last" to max turn, extract line ranges for requested turns, read source files, extract Action/Outcome/SecretInfo sections, return detailed content

**"last" alias resolution:**
- **Always read manifest.json first** to get total_turns
- Replace "last" in turns array with total_turns value
- If turns array is empty after resolution, return error "No turns specified"
- Verify all resolved turn numbers exist in turn_index (reject out-of-range turns)

**turn_detail safety:**
- For each requested turn, look up line range in turn_index: `[startLine, endLine]`
- Verify source_file path is safe (no `..` traversal, must be in extractionDir's original files)
- **Read source files line-by-line**, extracting only lines [startLine, endLine]
- If source file is missing, return error "Source file for Turn N not found"
- Accumulate Action, Outcome, SecretInfo sections for each turn
- Return `{ turns: [{ number, action, outcome, secret_info }] }`

**Error handling:**
- Missing extraction directory → return `{ success: false, error: "Extraction directory not found" }`
- Invalid category → return `{ success: false, error: "Invalid category. Valid: manifest, metadata, turn_index, tracked_state, turn_detail" }`
- Missing turns parameter or empty array → return `{ success: false, error: "turns parameter required and must be non-empty array" }`
- Missing tracked_state.json when requesting tracked_state → return `{ success: false, error: "tracked_state.json not found; this export has no tracked items" }`
- Source file for turn_detail not found → return `{ success: false, error: "Source file for Turn X not found" }`

**Test:** Create `test/handlers/query.test.js`. Test:
- All five categories with pre-extracted test data
- "last" alias resolution (e.g., turns: ["last"] → turned into [N])
- Out-of-range turns (e.g., turns: [999] when max is 250)
- turn_detail with multi-file scenarios (verify correct file is read)

---

### Phase D: MCP Integration

#### Step 11: Update `index.js` (MCP Server)

**Changes:**

1. **Add imports** (near top with other handlers):
   ```javascript
   import { extractStoryData } from "./lib/handlers/extraction.js";
   import { queryStoryData } from "./lib/handlers/query.js";
   ```

2. **Add tool definitions to `tools` array in `ListToolsRequestSchema`** (in alphabetical order by name):
   - Find the section where tools are defined in ListToolsRequestSchema
   - Insert both `extract_story_data` and `query_story_data` in alphabetical position
   - **Before existing tools that alphabetically follow** (e.g., if tools list has `eval_world` and `world_manifest`, insert between `compile_world` and `decompile_world`)

   ```javascript
   {
     name: "extract_story_data",
     description: "Parse one or more story export files and extract structured data (metadata, turns, tracked items). Writes JSON files to extraction directory for efficient querying.",
     inputSchema: {
       type: "object",
       properties: {
         input_paths: {
           type: "array",
           items: { type: "string" },
           description: "Absolute file paths to story export files (.txt)"
         },
         extraction_dir: {
           type: "string",
           description: "Directory to write extracted JSON files (created if missing)"
         }
       },
       required: ["input_paths", "extraction_dir"]
     }
   },
   {
     name: "query_story_data",
     description: "Query previously extracted story data by category (manifest, metadata, turn_index, tracked_state, turn_detail).",
     inputSchema: {
       type: "object",
       properties: {
         extraction_dir: {
           type: "string",
           description: "Directory containing extracted JSON files"
         },
         category: {
           type: "string",
           enum: ["manifest", "metadata", "turn_index", "tracked_state", "turn_detail"],
           description: "What data to retrieve"
         },
         turns: {
           type: "array",
           items: {
             oneOf: [{ type: "integer" }, { type: "string", enum: ["last"] }]
           },
           description: "For turn_detail: which turns to retrieve. For tracked_state: which turns to look up snapshots for."
         }
       },
       required: ["extraction_dir", "category"]
     }
   }
   ```

3. **Add to `toolHandlers` map** (in alphabetical order):
   ```javascript
   const toolHandlers = {
     // ... existing handlers ...
     extract_story_data: extractStoryData,
     query_story_data: queryStoryData,
     // ... rest of handlers ...
   };
   ```
   **Placement:** Insert both between tools that alphabetically surround them (e.g., after `decompile_world`, before `eval_world`)

4. **Verify alphabetization** by listing all tool names in `ListToolsRequestSchema` and `toolHandlers` and confirming they match in alphabetical order.

**Test:** Run `node index.js` in isolation. Verify no startup errors. Test with MCP client: call `tools/list` and verify both `extract_story_data` and `query_story_data` appear in response.

---

#### Step 12: Update `commands/sequel-world.md` (or relevant skill)

**Changes:**
1. Replace the instruction: "Read the ENTIRE export file" with:
   - "Call `extract_story_data` with the export file path(s). Review the returned manifest."

2. Update field-by-field walkthrough to use targeted queries:
   - For Title/Description: `query_story_data` → "manifest" and "metadata", then "turn_detail" for first/last turns
   - For NPCs: `query_story_data` → "turn_index" to scan previews, then "turn_detail" for selected turns
   - For Tracked Items: `query_story_data` → "tracked_state" at last turn
   - etc. (per design spec Section 6)

3. Add guidance: "Use turn_index previews to identify relevant turns before drilling in with turn_detail."

**Test:** Verify skill is still readable and guidance is clear.

---

### Phase E: Testing & Validation

#### Step 13: Write & Run Unit Tests

**Test structure:**
```
test/
├── parsers/
│   ├── utils.test.js (regex patterns, helper functions)
│   ├── phase1-combining.test.js (file combining, gap detection, mtime ordering)
│   ├── phase2-headers.test.js (title, background, character, objective extraction)
│   ├── phase3-turns.test.js (turn parsing, section detection, Turn 1 special case)
│   ├── phase4-tracked-items.test.js (item parsing, snapshot deduplication)
│   └── integration.test.js (end-to-end with all 5 test exports)
├── handlers/
│   ├── validation.test.js (input validation)
│   ├── output-writer.test.js (JSON schema, atomic writes)
│   ├── extraction.test.js (full extraction pipeline)
│   └── query.test.js (all 5 query categories, "last" alias)
└── mcp-tools.test.js (tool registration, MCP envelope)
```

**Critical test cases:**
- **Turn combining:** Test files with gaps (1-50, 95-100), overlaps with mtime priority, out-of-order blocks
- **Duplicate sections:** Test a section header appearing twice in a turn (parser should use first occurrence)
- **Snapshot state transitions:** null→object, object→object (different keys), null→null (same for both fields)
- **Item header false positives:** "URL: http://example.com" should NOT be parsed as an item, only "Item Name:" patterns
- **Multi-file line ranges:** Verify line numbers in turn_index match original source file (account for offsets)
- **Continuation exports:** File starting at Turn 50 with no header section

**Run tests:**
```bash
npm test
```

**Coverage target:** 80%+

**Validation checklist:**
- [ ] All unit tests pass
- [ ] Integration tests pass with all 5 test exports
- [ ] Query tests pass with pre-extracted data
- [ ] Line number spot-checks pass (pick 3 random turns, verify line ranges match source)
- [ ] No runtime errors in MCP server

---

#### Step 14: Manual Testing

**Test MCP server:**
```bash
cd infinite-worlds-architect-plugin
node index.js  # Should start without errors
```

**Use test harness** (create `test-mcp.js`):
```javascript
const { spawn } = require("child_process");

const server = spawn("node", ["index.js"]);

function send(method, params) {
  const request = { jsonrpc: "2.0", id: Math.random(), method, params };
  console.log("→", JSON.stringify(request));
  server.stdin.write(JSON.stringify(request) + "\n");
}

server.stdout.on("data", (data) => {
  console.log("←", data.toString());
});

// Test initialize
send("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0" } });

setTimeout(() => {
  // Test tools/list
  send("tools/list", {});
}, 500);

setTimeout(() => {
  // Test extract_story_data
  send("tools/call", {
    name: "extract_story_data",
    arguments: {
      input_paths: ["./test-files/Counsellor2_Turn22.txt"],
      extraction_dir: "/tmp/extraction"
    }
  });
}, 1000);

setTimeout(() => {
  // Test query_story_data
  send("tools/call", {
    name: "query_story_data",
    arguments: {
      extraction_dir: "/tmp/extraction",
      category: "manifest"
    }
  });
}, 2000);

setTimeout(() => {
  server.stdin.end();
  process.exit(0);
}, 3000);
```

**Run:**
```bash
node test-mcp.js
```

**Verify:**
- [ ] `tools/list` returns both `extract_story_data` and `query_story_data`
- [ ] `extract_story_data` call succeeds, creates output files
- [ ] Output files have correct JSON schema
- [ ] `query_story_data` with all 5 categories returns valid responses
- [ ] "last" alias resolves correctly
- [ ] Error cases handled gracefully

---

#### Step 15: Performance Validation

**Benchmark each test export:**
```bash
time node -e "const {parse} = require('./lib/parsers'); parse(['./test-files/TheWorldsAStageTurn4.txt']).then(() => console.log('Done'))" > /dev/null
```

**Targets:**
- [ ] TheWorldsAStageTurn4.txt (4 turns): < 100ms
- [ ] Counsellor2_Turn22.txt (22 turns): < 200ms
- [ ] TheRingOfDisTurn30.txt (30 turns): < 200ms
- [ ] HTTT 250 turns: < 2 seconds

**Check output file sizes:**
```bash
du -sh /tmp/extraction/
# Should be < 50 KB for 22-turn, < 500 KB for 250-turn
```

---

### Phase F: Documentation & Cleanup

#### Step 16: Update CLAUDE.md (if needed)

Add to project CLAUDE.md:

```markdown
## Story Data Extraction Tool

New MCP tools for parsing story exports programmatically.

- **extract_story_data**: Parse export file(s), write JSON files
- **query_story_data**: Query extracted data by category

See `docs/superpowers/specs/2026-03-27-story-data-extraction-design.md` for design.

Files:
- `lib/parsers/` — Four-phase parser (combining, headers, turns, tracked items)
- `lib/handlers/extraction.js` — MCP handler
- `lib/handlers/query.js` — MCP handler

Used by: `commands/sequel-world.md`
```

---

#### Step 17: Commit

```bash
git add -A
git commit -m "feat: add story data extraction tool

Two new MCP tools:
- extract_story_data: deterministic parsing of story exports
- query_story_data: targeted queries of extracted data

Replaces 'read entire export' with programmatic approach.
Reduces context usage by ~10x for large stories.
"
```

---

## 3. Implementation Checklist

### Pre-Implementation
- [ ] Read design spec (`2026-03-27-story-data-extraction-design.md`)
- [ ] Review test exports in `test-files/`
- [ ] Understand existing MCP tool patterns in `index.js`

### Phase A: Setup
- [ ] Create directory structure
- [ ] Create stub files

### Phase B: Parsers
- [ ] Implement `parsers/utils.js`
- [ ] Implement `parsers/phase1-combining.js` + unit tests
- [ ] Implement `parsers/phase2-headers.js` + unit tests
- [ ] Implement `parsers/phase3-turns.js` + unit tests
- [ ] Implement `parsers/phase4-tracked-items.js` + unit tests
- [ ] Implement `parsers/index.js` + integration tests
- [ ] All parser tests pass

### Phase C: Handlers
- [ ] Implement `validation.js` + tests
- [ ] Implement `output-writer.js` + tests
- [ ] Implement `handlers/extraction.js` + tests
- [ ] Implement `handlers/query.js` + tests
- [ ] All handler tests pass

### Phase D: Integration
- [ ] Update `index.js` (imports, tool definitions, routing)
- [ ] Verify MCP server starts without errors
- [ ] Update `commands/sequel-world.md`

### Phase E: Testing
- [ ] All unit tests pass (80%+ coverage)
- [ ] All integration tests pass
- [ ] Manual MCP testing completes successfully
- [ ] Performance targets met
- [ ] Error cases handled gracefully

### Phase F: Finalization
- [ ] Update CLAUDE.md
- [ ] Commit with descriptive message

---

## 4. Key Implementation Details

### Error Handling Strategy

**Parser phase errors (non-fatal):**
- Missing CHARACTER section subsection headers (only Name, not Background) → warn, continue
- Empty section after header (section header with blank content) → warn, set section to null
- Out-of-order turn blocks → warn, but sort and continue
- Turn number gaps detected → warn "Turns X-Y missing", but continue
- Regex not matching expected pattern → warn "Could not parse X section in Turn N", set to null

**Fatal errors (halt extraction):**
- Input file not found → throw with message "File not found: /path"
- No `-- Turn 1 --` delimiter in any combined file → throw "No Turn 1 found; extraction failed"
- Directory permission denied → throw "Cannot write to extraction directory: /path (permission denied)"
- Invalid JSON schema would be produced → throw "Internal: invalid output structure"

**Handler recovery:**
- Catch fatal errors in extraction.js, return: `{ success: false, error: "message" }`
- Do NOT re-throw; always return structured error response to MCP

**Query errors:**
- Invalid category → `{ success: false, error: "..." }`
- Missing turns parameter when required (for turn_detail) → `{ success: false, error: "turns parameter required for category turn_detail" }`
- Source file for turn_detail not found → `{ success: false, error: "Source file not accessible: Turn X" }`
- extraction_dir doesn't exist → `{ success: false, error: "Extraction directory not found: /path" }`

---

### Testing Strategy

**Test framework:** Use `node:test` (Node.js built-in) or install Jest/Vitest if preferred. All tests must be runnable via `npm test` without additional dependencies beyond dev.

**Unit tests (40% of test code):**
- Each phase in isolation with hardcoded input
- Regex patterns with sample snippets from real exports
- Edge cases: empty values, multi-line, duplicates, false positives in item header detection
- Snapshot deduplication: test state transitions (null→object, value changes, null→null)
- Test all 5 test exports to verify regex patterns match real data

**Integration tests (40% of test code):**
- End-to-end with real test exports (4-turn, 22-turn, 30-turn, 250-turn)
- Verify all output files written with correct JSON schemas
- Verify line numbers are correct (spot-check against source files)
- Compare actual snapshots to expected state transitions
- Test multi-file combining: overlapping turns, header priority, gap detection

**MCP tests (20% of test code):**
- Tool registration: tools appear in tools/list
- extract_story_data: call with test files, verify output files created
- query_story_data: call all 5 categories, verify correct data returned
- Error cases: invalid inputs, missing files, bad category

---

### Performance Optimization

**Required for implementation:**
- **Regex pre-compilation:** All regex patterns in `utils.js` must be compiled at module load time, not in parse loops
- Export `PATTERNS` object from utils.js with pre-compiled regex instances:
  ```javascript
  const PATTERNS = {
    TURN_DELIMITER: /^-- Turn (\d+) --$/m,
    TITLE: /^==\s*(.+?)\s*==$/,
    // ... all others
  };
  export { PATTERNS };
  ```
- Use `PATTERNS.TURN_DELIMITER` in all phase implementations, never re-compile

**Performance targets:**
- TheWorldsAStageTurn4.txt (4 turns): < 100ms
- Counsellor2_Turn22.txt (22 turns): < 200ms
- TheRingOfDisTurn30.txt (30 turns): < 200ms
- HTTT 250 turns: < 2 seconds

**Avoid these patterns (would cause slowdown):**
- Calling `new RegExp()` in loops
- Using `string.match()` in loops (use regex.exec() with stateful matching instead)
- Reading entire files into memory multiple times
- Re-parsing the same section twice (cache results)

**If optimization becomes necessary:**
- Use streaming for very large files (> 1 GB)
- Consider memoizing section parsing
- Profile with `node --prof` before and after changes

---

## 5. Success Criteria

**Code quality:**
- 80%+ test coverage
- No TypeScript errors (if TS is used) or linter warnings
- Consistent naming and structure matching plugin conventions

**Functionality:**
- All 5 test exports parse without errors
- All output files match design spec schemas
- All query categories work correctly
- "last" alias resolves correctly

**Performance:**
- 250-turn export parses in < 2 seconds
- Output files < 500 KB total

**Integration:**
- MCP server starts without errors
- Tools appear in `tools/list`
- Both tools callable via MCP interface
- sequel-world command updated and tested

---

## 6. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Regex patterns don't match all export formats | Test against all 5 test exports; verify false positive rejection (item header pattern) |
| Snapshot deduplication logic incorrect | Unit tests with mock turn sequences; test null transitions and state changes |
| Output files malformed JSON | Validate JSON.parse() in tests; check against turn_index and manifest |
| MCP integration breaks existing tools | Alphabetical ordering, minimal changes to index.js; run existing tools after integration |
| Performance regression on large exports | Benchmark before/after on 250-turn export; use profiler if target missed |
| Line number tracking incorrect | Spot-check line ranges in turn_index against source files |
| Multi-file combining produces wrong turn order | Unit test with out-of-order turn blocks; verify manifest gaps |
| Directory permission errors not handled | Test with read-only parent directory; return actionable error message |
| Character section parsing empty when header exists | Handle empty section gracefully; warn but don't fail |
| Turn 1 special case breaks with continuation exports | Test with exports that start at Turn 50; verify action is null, objective parsed correctly |

---

## 7. Implementation Checklist Details

### Critical Algorithm Clarifications

**Phase 1 (Combining) - Turn Number Ordering:**
The algorithm must:
1. Load all files and identify turn boundaries
2. Collect turns by turn number (NOT by file order)
3. When a turn appears in multiple files, use the version from the file with the latest mtime
4. Sort all collected turns by turn number (ascending)
5. Record gaps as warnings

Example: File A (mtime 100ms) has turns 1-50, File B (mtime 200ms) has turns 40-100
- Result: Turns 1-39 from File A, Turns 40-100 from File B
- Manifest shows: "Turns deduplicated; File B preferred for turns 40-50"

**Phase 4 (Tracked Items) - Snapshot Generation Algorithm:**
The algorithm must:
1. For each turn N from 1 to MAX:
   - Get state_N = { trackedItems, hiddenTrackedItems }
   - Compare to state_(N-1)
2. If state changed, emit snapshot: `{ from_turn: lastChangeTurn, to_turn: N-1, ...lastState }`
3. After loop, emit final snapshot from last change to MAX turn

Example:
- Turns 1-5: no tracked items (null)
- Turns 6-10: tracked_items = {Gold: "50"}, hidden null
- Turns 11-20: tracked_items = {Gold: "75"}, hidden null
- Turns 21-22: no tracked items (null)

Result snapshots:
```json
[
  { "from_turn": 1, "to_turn": 5, "tracked_items": null, "hidden_tracked_items": null },
  { "from_turn": 6, "to_turn": 10, "tracked_items": {"Gold": "50"}, "hidden_tracked_items": null },
  { "from_turn": 11, "to_turn": 20, "tracked_items": {"Gold": "75"}, "hidden_tracked_items": null },
  { "from_turn": 21, "to_turn": 22, "tracked_items": null, "hidden_tracked_items": null }
]
```

---

## Next Steps

1. Start with Phase A: Setup directory structure
2. Proceed through Phases B-C in order (dependencies matter)
3. Use the checklist above to track progress
4. Commit after each phase completes
5. Run full test suite before Phase D integration

**Estimated timeline:** 2-4 hours for experienced developer, 6-8 hours with learning curve.
