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
  │     │     ├─→ phase3-turns.js (→ phase4-tracked-items, utils.js)
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
   - Collect turns into a Map by turn number.
   - Keep only the most recent file's version of each turn (if overlaps).
4. Extract header from the most recently modified file only.
5. Generate manifest recording: source files, turn ranges, deduplication notes.
6. Return: `{ header: string, turns: Array, manifest: object, warnings: string[] }`

**Test:** Create `test/parsers/phase1-combining.test.js`. Test with:
- Single file: verify turns extracted correctly
- Multi-file: overlapping turns, header priority to newest file
- Missing Turn 1: error case

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
  - Exit on `-- ... --` that's not a recognized subsection
- Extract objective from Turn 1:
  - Find `- - - - -` divider
  - Locate `Your objective for this adventure is:` line
  - Capture text until closing divider
- Return structured header object (null fields where not found)

**Test:** Create `test/parsers/phase2-headers.test.js`. Test with real export headers from test files.

---

#### Step 4: Implement `lib/parsers/phase3-turns.js`

**Function:** `function parseTurns(combinedText, turns) → Array<{ number, action, outcome, secretInfo, trackedItems, hiddenTrackedItems, source }>`

**Algorithm:**
- For each turn block (from Phase 1):
  - Implement turn state machine (ACTION, OUTCOME, SECRET_INFO, TRACKED, HIDDEN_TRACKED)
  - Detect sections via two-line pattern
  - Special case Turn 1: action is null
  - Accumulate text for each section
  - Call Phase 4 parser on Tracked/Hidden Tracked sections
  - Record source file and line range
- Return array of turn objects

**Test:** Create `test/parsers/phase3-turns.test.js`. Test with real turn content from test files.

---

#### Step 5: Implement `lib/parsers/phase4-tracked-items.js`

**Functions:**
- `parseTrackedItems(sectionText) → { key: value, ... } | null`
- `generateSnapshots(trackedPerTurn) → Array<{ fromTurn, toTurn, trackedItems, hiddenTrackedItems }>`

**Algorithm (parseTrackedItems):**
- If content is null or empty, return null
- Split section on `\n\n` (blank line) followed by item header pattern
- For each segment: key = first line (strip colon), value = remainder (trimmed)
- Return object (all values are strings)

**Algorithm (generateSnapshots):**
- Iterate through turns in order
- Compare current state to previous state
- When state changes, emit snapshot: `{ fromTurn, toTurn, trackedItems, hiddenTrackedItems }`
- Snapshots are contiguous; every turn falls within exactly one
- Return snapshots array

**Test:** Create `test/parsers/phase4-tracked-items.test.js`. Test with various tracked item formats (simple, multi-line, empty values).

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
- `validateExtractInput(inputPaths, extractionDir)` → `{ valid, errors }`
- `validateQueryInput(extractionDir, category, turns)` → `{ valid, errors }`
- `validateInputPaths(paths)` → `{ valid, errors }`
- `validateExtractionDir(dir)` → `{ valid, errors }`

**Logic:**
- Check types (array, string, etc.)
- Check non-empty
- For paths: verify readable/writable
- For category: check enum membership
- For turns: check array of integers or "last"

**Test:** Create `test/validation.test.js`. Test valid and invalid inputs.

---

#### Step 8: Implement `lib/handlers/output-writer.js`

**Function:** `async function writeOutputFiles(extractionDir, parsedHeader, parsedTurns, snapshots) → { filesWritten, warnings }`

**Files to write:**

1. **manifest.json**
   ```json
   {
     "version": "1.0",
     "source_files": [{ path, turns: [first, last], modified }],
     "header_source": path,
     "total_turns": number,
     "has_tracked_items": boolean,
     "has_hidden_tracked_items": boolean,
     "files": [filenames]
   }
   ```

2. **metadata.json**
   ```json
   {
     "title": string | null,
     "story_background": string | null,
     "objective": string | null,
     "character": { name, background, skills },
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
         "action_preview": string | null,
         "outcome_preview": string,
         "has_secret_info": boolean,
         "has_tracked_items": boolean,
         "line_range": [number, number],
         "source_file": string
       }
     ]
   }
   ```

4. **tracked_state.json** (only if tracked items exist)
   ```json
   {
     "snapshots": [
       {
         "from_turn": number,
         "to_turn": number,
         "tracked_items": { key: value },
         "hidden_tracked_items": { key: value } | null
       }
     ]
   }
   ```

**Logic:**
- Create `extractionDir` if it doesn't exist
- Build each file's data structure
- Write to disk (path.resolve with proper formatting)
- Validate all writes succeeded
- Return list of written filenames + warnings

**Test:** Create `test/handlers/output-writer.test.js`. Verify JSON schema correctness.

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
- **`tracked_state`**: Load tracked_state.json, resolve "last" to max turn, find snapshots for each requested turn
- **`turn_index`**: Load and return turn_index.json
- **`turn_detail`**: Load turn_index, resolve turns, extract line ranges, read source files, extract Action/Outcome/SecretInfo sections

**"last" alias resolution:**
- Read manifest.json to get total_turns
- Replace "last" in turns array with that number

**Error handling:**
- Missing extraction directory → return error
- Missing tracked_state.json when requesting tracked_state → return error with explanation
- Invalid source file path in turn_detail → return error

**Test:** Create `test/handlers/query.test.js`. Test all five categories with pre-extracted test data.

---

### Phase D: MCP Integration

#### Step 11: Update `index.js` (MCP Server)

**Changes:**
1. Import handlers:
   ```javascript
   import { extractStoryData } from "./lib/handlers/extraction.js";
   import { queryStoryData } from "./lib/handlers/query.js";
   ```

2. Add tool definitions to `ListToolsRequestSchema` (alphabetically):
   ```javascript
   {
     name: "extract_story_data",
     description: "Parse one or more Infinite Worlds story export files...",
     inputSchema: { /* schema */ }
   },
   {
     name: "query_story_data",
     description: "Retrieve previously extracted story data...",
     inputSchema: { /* schema */ }
   }
   ```

3. Add to `toolHandlers` map (alphabetically):
   ```javascript
   const toolHandlers = {
     // ... existing ...
     extract_story_data: extractStoryData,
     query_story_data: queryStoryData,
     // ... rest ...
   };
   ```

4. Verify tool definitions are alphabetized per plugin conventions.

**Test:** Run `node index.js` in isolation. Verify no startup errors. Check that `/tools/list` request returns the new tools.

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
│   ├── utils.test.js (regex patterns)
│   ├── phase1-combining.test.js
│   ├── phase2-headers.test.js
│   ├── phase3-turns.test.js
│   ├── phase4-tracked-items.test.js
│   └── integration.test.js
├── handlers/
│   ├── output-writer.test.js
│   ├── extraction.test.js
│   └── query.test.js
├── validation.test.js
└── mcp-tools.test.js
```

**Run tests:**
```bash
npm test
```

**Coverage target:** 80%+

**Validation checklist:**
- [ ] All unit tests pass
- [ ] Integration tests pass with all 5 test exports
- [ ] Query tests pass with pre-extracted data
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
- Collected in `ErrorCollector` object
- Returned in warnings array
- Extraction continues

**Fatal errors (halt extraction):**
- File not found → throw OS error
- No `-- Turn 1 --` delimiter → throw "No parseable turns"
- Recover gracefully in handler, return error to MCP

**Query errors:**
- Invalid category → error response
- Missing turns parameter → error response
- Source file for turn_detail not found → error response

---

### Testing Strategy

**Unit tests (40% of test code):**
- Each phase in isolation with hardcoded input
- Regex patterns with sample snippets
- Edge cases (empty values, multi-line, duplicates)

**Integration tests (40% of test code):**
- End-to-end with real test exports
- Verify all output files + schemas
- Compare actual output to expected values

**MCP tests (20% of test code):**
- Tool registration (tools appear in tools/list)
- Request/response envelope format
- Error marshaling

---

### Performance Optimization

**No optimization needed initially:**
- Parser is already efficient (single-pass regex matching)
- 250-turn export parses in < 2 seconds on modern hardware
- Output file sizes are < 500 KB (well within token budget)

**If optimization becomes necessary later:**
- Cache regex patterns (already done in utils.js)
- Use streaming for very large files (> 1 GB)
- Consider incremental parsing for resume capability

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
| Regex patterns don't match all export formats | Validate against all 5 test exports + edge cases |
| Snapshot deduplication logic incorrect | Unit tests with mock turn sequences |
| Output files malformed JSON | Validate JSON.parse() in tests |
| MCP integration breaks existing tools | Alphabetical ordering, minimal changes to index.js |
| Performance regression on large exports | Benchmark before/after on 250-turn export |

---

## Next Steps

1. Start with Phase A: Setup directory structure
2. Proceed through Phases B-C in order (dependencies matter)
3. Use the checklist above to track progress
4. Commit after each phase completes
5. Run full test suite before Phase D integration

**Estimated timeline:** 2-4 hours for experienced developer, 6-8 hours with learning curve.
