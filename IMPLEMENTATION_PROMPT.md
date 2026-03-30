# Story Data Extraction Tool — Implementation Prompt

**Invoke at session start:**
- `/testing:tdd-orchestrator` — Enforce red-green-refactor discipline

**Reference documents (read completely):**
1. `docs/superpowers/specs/2026-03-27-story-data-extraction-design.md` (design spec)
2. `docs/superpowers/specs/2026-03-28-story-extraction-implementation-plan.md` (step-by-step guide)
3. `test-files/` (5 real story exports for testing)

---

## Quick Start

Follow the implementation plan **exactly** — it has been thoroughly reviewed and all ambiguities resolved. The plan contains:
- Detailed algorithms for each phase (Phase A-F, Steps 1-17)
- Module responsibilities and dependencies
- Complete step-by-step implementation sequence
- Testing strategy (80%+ coverage required)
- All critical edge cases and test scenarios

---

## Parallelization with Sub-Agents

Use sub-agents to speed up independent work:

### After Phase B (Parsers) Complete
Split Phase C (Handlers) into parallel tasks:
- **Sub-agent 1:** Implement `validation.js` + `handlers/output-writer.js` (independent modules)
- **Sub-agent 2:** Implement `handlers/extraction.js` + `handlers/query.js` (depend on validation)
- **Coordinate:** Merge results, ensure interfaces match

### Testing (After All Code Complete)
Run in parallel:
- **Sub-agent 1:** Unit tests for parsers (phase1-5)
- **Sub-agent 2:** Unit tests for handlers (validation, output-writer, extraction, query)
- **Sub-agent 3:** Integration tests with all 5 test exports + performance benchmarks
- **Coordinate:** Fix any failures before Phase D integration

### Code Review
After each major module or phase completes:
- Use `code-reviewer` agent to catch bugs, edge cases, security issues
- Fix issues before proceeding

---

## Key Reminders

1. **TDD mandatory:** Write failing tests BEFORE implementation for every module
2. **Phase 4 complexity:** Snapshot deduplication is the trickiest part — read the detailed algorithm in the implementation plan carefully (Section 2, Step 5)
3. **All 5 test exports required:** Integration tests must use all files to validate regex patterns and edge cases
4. **80%+ coverage minimum:** Measure with `npm test -- --coverage`
5. **Atomic file writes:** Use temp files + rename pattern for output-writer.js
6. **Immutability:** Never mutate input objects; return new copies
7. **Error handling:** Fatal errors throw; non-fatal errors return warnings in structured responses

---

## Success Checklist

- [ ] All 10 modules implemented (libs/parsers/*, lib/handlers/*, lib/validation.js)
- [ ] 80%+ test coverage
- [ ] All 5 test exports parse without errors
- [ ] All output JSON files match design spec schemas
- [ ] All 5 query categories work (manifest, metadata, turn_index, tracked_state, turn_detail)
- [ ] "last" alias resolves correctly to max turn number
- [ ] MCP server starts without errors (`node index.js`)
- [ ] Tools appear in `tools/list` response
- [ ] Performance: 250-turn export parses in < 2 seconds
- [ ] All error cases handled with actionable messages
- [ ] Code reviewed (no critical/high-priority issues)
- [ ] Committed with descriptive message (see plan for template)

---

## When Stuck

The implementation plan contains detailed algorithms, test cases, and examples for every step. If ambiguities arise:
1. Check the implementation plan first (Section 2: Implementation Steps)
2. Check the design spec (Section 3: Parser Design with algorithms)
3. Check the error handling section in the plan (Section 4: Key Implementation Details)
