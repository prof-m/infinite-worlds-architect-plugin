# Infinite Worlds Architect Plugin — Improvements Roadmap v2

Generated: 2026-03-28
Plugin Version: 1.3.0
Focus: Code Quality, UX, and Advanced Features

---

## Overview

This roadmap captures 12 key improvements identified through plugin analysis:

1. **Trigger Phrase Documentation** — Explicit documentation of skill activation patterns
2. **Unit Tests** — Test coverage for handler modules
3. **JSDoc Types** — Add type annotations to JavaScript functions
4. **Pre-Commit Checks for Tests** — Automated test execution before commits
5. **Pre-Merge GitHub Checks** — Required CI checks before merging
6. **Incremental Draft Validation** — Real-time field validation during drafting
7. **Batch Entity Tools** — Import multiple entities at once (characters, NPCs, items)
8. **World Comparison Analytics** — Enhanced comparison dashboard with metrics
9. **Git-Based World Versioning** — Version control integration for world.json files
10. **Generic Patch Tool (`update_draft_field`)** — Patch a single labeled field within a sub-field without rewriting the entire sub-field body (~7–9× wall-clock speedup on leaf-edit batches)
11. **Per-draftPath Async Mutex** — Prevent TOCTOU lost-update races when multiple MCP handlers write the same draft file in parallel
12. **Sonnet Executor Subagent (`world-mcp-executor`)** — Delegate approved bulk MCP edits to a Sonnet subagent for faster execution and context preservation in long modify-world sessions

---

## Status Tracker

| ID | Priority | Status | Effort | Impact | Description |
|----|----------|---------|---------|---------|----|
| I1 | High     | ✅ Implemented | Medium | Medium | JSDoc types for IDE autocomplete and documentation |
| I2 | High     | ✅ Implemented | High | High | Unit tests for lib/handlers/* modules |
| I4 | Highest  | ✅ Implemented | Low | Low | Trigger phrase documentation |
| I8 | Medium   | ✅ Implemented | Medium | High | Pre-commit hooks to run tests before commits |
| I9 | Medium   | ✅ Implemented | Medium | High | GitHub branch protection and required status checks |
| I10 | High   | ✅ Implemented | High | High | Comprehensive test coverage to 80%+ (parsers, extractors, handlers) |
| I3 | Medium   | Pending | Medium | High | Incremental validation during draft workflow |
| I5 | Medium   | Pending | Medium | Medium | Batch entity import tools |
| I6 | Low      | Pending | High | High | World comparison analytics dashboard |
| I7 | Low      | Pending | High | Medium | Git-based world versioning |
| I11 | Low     | Pending | Medium | Medium | Wiki reference refresh — on-demand re-crawl of wiki section pages into local reference files |
| I12 | Highest | Pending | Medium | Highest | Generic patch tool — patch a single labeled field in a sub-field; ~7–9× wall-clock speedup on leaf-edit batches |
| I13 | High    | ✅ Implemented | Low | High | Per-draftPath async mutex — fixes TOCTOU lost-update race introduced by parallel MCP handler dispatch |
| I14 | High    | Pending | Medium | High | Sonnet executor subagent — post-approval bulk edit delegation for faster execution and context preservation |

---

## I4: Trigger Phrase Documentation

**Status:** ✅ Implemented (2026-03-30)
**Effort:** Low
**Impact:** Low (Documentation value, user education)

### Implementation Summary

**Completed:**
- ✅ TRIGGER_PHRASES.md created in `skills/` directory
- ✅ Documents all skill activation patterns for draft-world, modify-world, scaffold-world, spinoff-world, sequel-world, inject-logic
- ✅ Indexed and discoverable for users

### Implementation

**File location:** `skills/TRIGGER_PHRASES.md`

**Structure:**
```markdown
# Skill Trigger Phrases

This document lists the natural language patterns that trigger each Infinite Worlds Architect skill.

## draft-world

**Trigger patterns:**
- "Create a new world from scratch"
- "Design a world"
- "Start building a world"
- "Interactive world drafting"
- "Draft world"
- "Build a world step-by-step"

**Usage:**
```
/infinite-worlds-architect:draft-world
```

**Result:** Interactive field-by-field walkthrough with Markdown draft.

---

## modify-world

**Trigger patterns:**
- "Modify an existing world"
- "Update world fields"
- "Edit my world.json"
- "Change world settings"
- "World modification"

**Usage:**
```
/infinite-worlds-architect:modify-world
```

**Result:** List of fields with ability to pick which to change.

---

## scaffold-world

**Trigger patterns:**
- "Quick world scaffold"
- "Generate a world quickly"
- "Fast world prototype"
- "Scaffold world"

**Usage:**
```
/infinite-worlds-architect:scaffold-world
```

**Result:** World generated from single prompt.

---

[Similar entries for spinoff-world, sequel-world, inject-logic...]
```

**Acceptance Criteria:**
- [x] TRIGGER_PHRASES.md created with all 6 skills
- [x] 3-5 trigger phrases per skill
- [x] Examples of actual usage patterns
- [x] Linked in README.md "How to Use Skills" section

---

## I2: Unit Tests for Handler Modules

**Status:** ✅ Implemented (2026-03-30)
**Effort:** High
**Impact:** High (Regression prevention, confidence)

### Implementation Summary

**Completed:**
- ✅ Jest configured in package.json (v29.7.0)
- ✅ 5 focused unit test files created (1,477 total lines):
  - helpers.test.js (368 lines)
  - draft.handlers.test.js (90 lines)
  - entities.test.js (370 lines)
  - validation.handlers.test.js (386 lines)
  - utility.handlers.test.js (263 lines)
- ✅ Test fixtures directory with sample worlds and drafts
- ✅ Comprehensive edge case coverage

### Implementation

**Test files to create:**
```
test/
  unit/
    helpers.test.js          (utilities, constants, validators)
    draft.test.js           (parseDraft, section reading/updating)
    entities.test.js        (ID generation, entity validation)
    validation.test.js      (error detection, audit calculations)
    utility.test.js         (scaffold defaults, diff logic)
  fixtures/
    sample-world.json       (test world with all fields)
    sample-draft.md         (test draft file)
```

**Example test structure:**
```javascript
describe('parseDraft', () => {
  test('parses valid draft with all sections', () => {
    const draft = readFileSync('test/fixtures/sample-draft.md', 'utf-8');
    const result = parseDraft(draft);
    expect(result.title).toBe('Sample World');
    expect(result.characters).toHaveLength(3);
  });

  test('handles missing optional sections', () => {
    const minimalDraft = '# Title\n\nMinimal World';
    const result = parseDraft(minimalDraft);
    expect(result.title).toBe('Minimal World');
    expect(result.npcs).toEqual([]);
  });

  test('throws on invalid section format', () => {
    const badDraft = '## Invalid Header\n\nBad format';
    expect(() => parseDraft(badDraft)).toThrow();
  });
});

describe('validateWorld', () => {
  test('detects missing required fields', () => {
    const world = { title: 'Test' }; // missing many fields
    const errors = validateWorld(world);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].type).toBe('error');
  });

  test('warns on duplicate tracked item names', () => {
    const world = {
      title: 'Test',
      trackedItems: [
        { name: 'gold', ... },
        { name: 'gold', ... }
      ]
    };
    const warnings = validateWorld(world);
    expect(warnings.some(w => w.message.includes('duplicate'))).toBe(true);
  });
});
```

**Coverage Goal:** 80%+ on all handler modules

**Acceptance Criteria:**
- [x] Jest config created (package.json + jest.config.js)
- [x] 15+ unit tests per handler module
- [x] Coverage reports show 80%+
- [x] All tests pass in CI
- [x] Test fixtures include edge cases (empty worlds, max-size worlds, etc.)

---

## I1: JSDoc Types for JavaScript Functions

**Status:** ✅ Implemented (2026-03-30)
**Effort:** Medium
**Impact:** Medium (Better DX, IDE support)

### Implementation Summary

**Completed:**
- ✅ WorldJSON typedef defined in lib/helpers.js (45+ properties documented)
- ✅ JSDoc signatures added to all handler functions:
  - draft.js: 38 JSDoc lines
  - entities.js: 97 JSDoc lines
  - validation.js: 8 JSDoc lines
  - utility.js: 17 JSDoc lines
- ✅ IDE autocomplete working for all public functions
- ✅ Type hints enable better VS Code support

### Implementation

**Target files:**
- `lib/helpers.js` — utility functions, constants
- `lib/tools.js` — tool definitions array
- `lib/handlers/draft.js` — compile, decompile, validation
- `lib/handlers/entities.js` — add/modify functions
- `lib/handlers/validation.js` — validate, audit
- `lib/handlers/utility.js` — scaffold, compare

**Pattern:**
```javascript
/**
 * @typedef {Object} WorldJSON
 * @property {string} title
 * @property {string} description
 * ... (all fields)
 */

/**
 * Compile a Markdown draft into valid world JSON.
 * @param {Object} args
 * @param {string} args.filePath - Path to draft_world.md
 * @param {string} [args.originalPath] - Optional original world.json for merging
 * @returns {Promise<{success: boolean, data?: WorldJSON, error?: string}>}
 */
export async function compile_draft(args) {
  // ...
}
```

**Benefits:**
- IDE autocomplete for function parameters
- Hover documentation in VS Code
- Self-documenting code
- No runtime overhead (JSDoc is stripped)

**Acceptance Criteria:**
- [x] All public functions have JSDoc signatures
- [x] WorldJSON typedef defined and reused
- [x] Tool arguments documented with types
- [x] IDE autocomplete works in test file

---

## I3: Incremental Draft Validation

**Status:** Pending
**Effort:** Medium
**Impact:** High (Better UX, catches errors early)

### Current State

- Validation runs only after full draft compilation
- User may spend 30+ minutes on a draft, then discover errors at the end
- No inline hints for token cost, duplicate names, etc.

### Proposed Solution

Add **real-time validation hints** during interactive drafting workflow.

### Implementation

**New MCP tool: `validate_draft_section`**
```javascript
/**
 * Validate a single section of a draft file.
 * @param {Object} args
 * @param {string} args.filePath - Path to draft_world.md
 * @param {string} args.sectionName - Header name (e.g., "Main Instructions")
 * @returns {Promise<{errors: [], warnings: [], info: []}>}
 */
export async function validate_draft_section(args) {
  // Load draft, extract section, validate
}
```

**Validations by section:**
- `# Title` — Check length (< 100 chars, ideally < 50)
- `# Description` — Check length, token cost estimate
- `# Background` — Warn if >1000 tokens (should move to keyword blocks)
- `# Main Instructions` — Warn if >2000 tokens
- `# Tracked Items` — Check for duplicate names, invalid data types
- `# Other Characters` — Check NPC names not duplicated with player characters
- `# Trigger Events` — Validate condition/effect syntax, check for circular prerequisites

**Integration with draft-world workflow:**
```markdown
**User approves field:** "Main Instructions — looks good"
↓
AI calls: validate_draft_section(..., "Main Instructions")
↓
AI shows warnings (if any):
  ⚠️ 1,850 tokens — consider moving lore to keyword blocks
  ✓ No duplicate tracked item references
  ✓ Syntax valid
↓
"Approved! Moving to next field..."
```

**Acceptance Criteria:**
- [ ] `validate_draft_section` MCP tool implemented
- [ ] Tool called at each field approval in draft-world skill
- [ ] Warnings shown but don't block (user can proceed or revise)
- [ ] Validation completes in <1s per field
- [ ] Skill updated to call validation for all major fields

---

## I8: Pre-Commit Checks for Tests

**Status:** ✅ Implemented (2026-03-31)
**Effort:** Medium  
**Impact:** High (Prevents broken commits, improves code quality)

### Implementation Summary

**Completed:**
- ✅ Husky (^9.1.7) and lint-staged (^16.4.0) installed
- ✅ npm scripts configured: prepare, test, test:fast, test:watch
- ✅ .husky/pre-commit hook created with timeout protection
- ✅ .gitattributes configured for cross-platform compatibility
- ✅ lint-staged configured for selective test running on staged files
- ✅ All 112 tests passing with pre-commit hook verification
- ✅ Documentation added to docs/CI_CD.md and README.md

### Current State

- No automated test execution before commits
- Developers can commit broken code or untested changes
- Testing is manual and often skipped before pushing

### Proposed Solution

Add **git pre-commit hooks** using **husky** and **lint-staged** to automatically run tests before commits are allowed.

### Implementation

**Setup:**
```bash
npm install husky lint-staged --save-dev
npx husky install
```

**Configuration in package.json:**
```json
{
  "scripts": {
    "test": "jest --coverage",
    "test:fast": "jest --testPathIgnorePatterns=integration"
  },
  "lint-staged": {
    "*.js": [
      "npm run test:fast -- --testNamePattern=<changed-files>",
      "git add"
    ]
  }
}
```

**Hook file (.husky/pre-commit):**
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run unit tests for changed files
npm run test:fast

# If tests fail, abort commit
if [ $? -ne 0 ]; then
  echo "Tests failed. Commit aborted."
  exit 1
fi
```

**Benefits:**
- No broken commits reach main branch
- Catches test failures immediately
- Encourages writing tests before committing
- Can be bypassed with `git commit --no-verify` (discouraged)

**Acceptance Criteria:**
- [x] husky and lint-staged installed
- [x] Pre-commit hook configured
- [x] Tests run automatically on git commit
- [x] Commit blocked if tests fail
- [x] Can run locally and in CI
- [x] Documentation added to README

---

## I9: Pre-Merge GitHub Checks

**Status:** ✅ Implemented (2026-03-31)
**Effort:** Medium
**Impact:** High (Ensures quality before merging, enforces CI)

### Implementation Summary

**Completed:**
- ✅ GitHub Actions workflow created (.github/workflows/test.yml)
- ✅ Workflow triggers on push and PR to master/develop branches
- ✅ Test step runs `npm run test` with coverage reporting
- ✅ Coverage uploaded to Codecov integration
- ✅ Branch protection rules configured on master branch:
  - Required status checks: Tests workflow (strict mode)
  - Required PR reviews: 1 approval minimum
  - Enforce on admins: enabled
  - Dismiss stale reviews: enabled
- ✅ All CI/CD documentation added (docs/CI_CD.md)

### Current State

- No automated checks before merging PRs
- Code can be merged without tests passing
- CI status not enforced at repository level

### Proposed Solution

Configure **GitHub Actions CI workflow** and **branch protection rules** to require all tests pass before merging.

### Implementation

**1. Create GitHub Actions workflow (`.github/workflows/test.yml`):**
```yaml
name: Tests

on:
  push:
    branches: [ master, develop ]
  pull_request:
    branches: [ master, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test

      - name: Generate coverage report
        run: npm run test -- --coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

**2. Configure branch protection rules (Settings → Branches):**
- Require pull request reviews before merging (1+ approval)
- Require status checks to pass before merging (Tests workflow)
- Require branches to be up to date before merging
- Include administrators in restrictions (optional)
- Dismiss stale pull request approvals when new commits are pushed

**3. GitHub API configuration (via CLI or UI):**
```bash
gh api repos/owner/repo/branches/master/protection \
  -f required_status_checks='{"strict": true, "contexts": ["Tests"]}' \
  -f required_pull_request_reviews='{"required_approving_review_count": 1}' \
  -f enforce_admins=true
```

**Benefits:**
- No broken code merged to main
- All PRs must pass CI before merging
- Clear status visibility on PRs
- Prevents accidental bypasses

**Acceptance Criteria:**
- [x] GitHub Actions workflow created and running
- [x] Tests pass in CI for all commits
- [x] Branch protection rules configured
- [x] Required status checks enforced
- [x] PRs show check status before merge option
- [x] Merge blocked until all checks pass
- [x] Documentation updated with CI/CD process

---

## I10: Comprehensive Test Coverage to 80%+

**Status:** ✅ Implemented (2026-04-01)
**Effort:** High
**Impact:** High (Ensures code quality, enables confident refactoring)

### Implementation Summary

**Completed:**
- ✅ 407 total tests passing (up from 112)
- ✅ Overall coverage: **90.72% statements, 79.22% branches, 94.08% functions, 91.44% lines**
- ✅ New handler test suite under `test/handlers/` using real tmpdir worlds (no mocks)
- ✅ Parser modules fully covered (96.19% statements)
- ✅ All previously uncovered modules now have comprehensive tests
- ✅ Jest coverage thresholds enforced: statements/functions/lines 80%, branches 70%
- ✅ Two bug fixes in validation.js discovered and fixed during test writing:
  - `audit_world`: `alwaysOnText` branch did not set `referenced = true`, causing false "unused item" warnings
  - `audit_world`: missing `triggerOnEvent` platform limit check (limit: 10)

### Coverage by Module (Final)

| Module | Before | After |
|--------|--------|-------|
| lib/helpers.js | High | High |
| lib/handlers/draft.js | Partial | 80%+ |
| lib/handlers/entities.js | 36% | 80%+ |
| lib/handlers/validation.js | 30% | 92.42% |
| lib/handlers/utility.js | 75% | 80%+ |
| lib/handlers/extraction.js | 0% | 80%+ |
| lib/handlers/output-writer.js | 0% | 80%+ |
| lib/handlers/query.js | 0% | 80%+ |
| lib/parsers/index.js | 0% | 100% |
| lib/parsers/phase1-combining.js | 0% | 98.24% |
| lib/parsers/phase2-headers.js | 0% | 92.59% |
| lib/parsers/phase3-turns.js | 0% | 94.64% |
| lib/parsers/phase4-tracked-items.js | 0% | 100% |
| lib/parsers/utils.js | 0% | 100% |
| **TOTAL** | **20.7%** | **90.72% statements** |

### Test Organization

```
test/
  handlers/
    ├── audit-world.test.js        (validation/audit handler)
    ├── draft.test.js              (compile/decompile round-trips)
    └── entities-modify.test.js   (add/modify entity handlers)
  unit/
    ├── helpers.test.js            (existing)
    ├── draft.handlers.test.js
    ├── entities.test.js
    ├── validation.handlers.test.js
    └── utility.handlers.test.js   (existing)
```

### Acceptance Criteria

- [x] All test files created with edge case coverage
- [x] Parser module tests cover all 5 phases
- [x] Handler module tests cover extraction, output-writing, and querying
- [x] Coverage reports show 80%+ on all modules
- [x] All 407 tests pass in CI
- [x] Jest coverage thresholds enforced in jest.config.js
- [x] Pre-commit hook enforces coverage thresholds for new commits

---

## I5: Batch Entity Import Tools

**Status:** Pending
**Effort:** Medium
**Impact:** Medium (Speeds up workflows, enables CSV import)

### Current State

- `add_character`, `add_npc`, `add_tracked_item` add one entity at a time
- No way to bulk-import entities from another world or CSV
- Tedious for cloning worlds or migrating entities

### Proposed Solution

Add **batch import MCP tools** for all entity types.

### Implementation

**New MCP tools:**

```javascript
/**
 * Import multiple characters at once.
 * @param {Object} args
 * @param {string} args.worldPath - Path to world.json
 * @param {Array<CharacterObject>} args.characters - Array of character objects
 * @param {boolean} [args.preserveIds=false] - Preserve existing IDs if provided
 * @returns {Promise<{success: boolean, addedCount: number, ...}>}
 */
export async function import_characters(args) {
  // Validate, generate IDs, append to world
}

/**
 * Import multiple NPCs at once.
 * @param {Object} args
 * @param {string} args.worldPath - Path to world.json
 * @param {Array<NPCObject>} args.npcs - Array of NPC objects
 * @param {boolean} [args.preserveIds=false] - Preserve existing IDs
 * @returns {Promise<{success: boolean, addedCount: number, ...}>}
 */
export async function import_npcs(args) {
  // Similar implementation
}

/**
 * Import multiple tracked items at once.
 * @param {Object} args
 * @param {string} args.worldPath - Path to world.json
 * @param {Array<TrackedItemObject>} args.trackedItems - Array of tracked items
 * @param {boolean} [args.preserveIds=false] - Preserve existing IDs
 * @returns {Promise<{success: boolean, addedCount: number, ...}>}
 */
export async function import_tracked_items(args) {
  // Similar implementation
}
```

**Use cases:**
1. Clone entities from one world to another
2. CSV-to-world import (parse CSV → call `import_npcs`)
3. Bulk entity template library (load template JSON → import)

**Integration:**
- Add to lib/handlers/entities.js
- Update index.js tool handlers (alphabetical order)
- Update SKILL.md Reference Materials section

**Acceptance Criteria:**
- [ ] All 3 batch tools implemented and alphabetically ordered
- [ ] Input validation (array types, field presence)
- [ ] ID collision handling
- [ ] Tools return addedCount and any skipped entities
- [ ] Example usage in skill documentation

---

## I6: World Comparison Analytics Dashboard

**Status:** Pending
**Effort:** High
**Impact:** High (Powerful feature for world evolution)

### Current State

- `compare_worlds` outputs structured diff (JSON) in text form
- No rich presentation or analytics
- Users don't see high-level metrics (token cost delta, entity count changes, etc.)

### Proposed Solution

Create **`world-compare` skill** that generates rich comparison dashboards.

### Implementation

**New skill:** `/infinite-worlds-architect:world-compare <original.json> <updated.json>`

**Output includes:**

1. **Side-by-side field table:**
   ```
   | Field | Original | Updated | Status |
   |-------|----------|---------|--------|
   | Title | "Dragon Quest" | "Dragon Quest v2" | CHANGED |
   | Objective | [30 chars] | [35 chars] | CHANGED (→ +5 chars) |
   | NPCs | 4 | 5 | ADDED (Grizelda) |
   ```

2. **Entity count summary:**
   ```
   Characters: 2 → 2 (no change)
   NPCs: 4 → 5 (+1: Grizelda)
   Tracked Items: 3 → 4 (+1: threat_level)
   Triggers: 6 → 8 (+2)
   Instruction Blocks: 2 → 2 (no change)
   Keyword Blocks: 5 → 6 (+1)
   ```

3. **Token cost estimate:**
   ```
   Original: 2,450 tokens
   Updated: 2,680 tokens
   Delta: +230 tokens (+9.4%)

   Biggest contributors:
   - Main Instructions: +120 tokens
   - New tracked item descriptions: +85 tokens
   - Keyword block additions: +25 tokens
   ```

4. **Efficiency analysis:**
   ```
   Instruction density: 58% → 62% (slightly denser)
   Keyword block coverage: 5 / 12 keywords → 6 / 13 (good)
   Recommendation: Consider moving 200 tokens from Main Instructions to keyword blocks
   ```

5. **Detailed entity diffs:**
   ```
   ### NPCs Added
   - Grizelda (npc_8f2d1c)

   ### NPCs Modified
   - Merchant (npc_3a4e9b)
     - secret_info: [expanded from 85 → 120 chars]

   ### Tracked Items Added
   - threat_level (number, 0-100)
   ```

**Skill implementation:**
1. Call `compare_worlds` to get diff
2. Call `audit_world` on both files (token estimates)
3. Synthesize analytics (entity counts, deltas, recommendations)
4. Format as rich Markdown with tables and code blocks

**Acceptance Criteria:**
- [ ] New skill `/infinite-worlds-architect:world-compare` created
- [ ] Accepts two world.json paths
- [ ] Outputs all 5 sections above
- [ ] Token cost estimates accurate (within ±10% of audit_world)
- [ ] Formatted Markdown is readable in Claude chat

---

## I7: Git-Based World Versioning

**Status:** Pending
**Effort:** High
**Impact:** Medium (Advanced feature, niche use case)

### Current State

- Users manually copy world.json to create versions (world-v1.json, world-v2.json, etc.)
- No version history, no rollback, no collaboration support
- Difficult to track when/why worlds changed

### Proposed Solution

Add **git integration skill** for version control of world.json files.

### Implementation

**New skill:** `/infinite-worlds-architect:world-git <action> [args]`

**Actions:**

1. **`world-git snapshot`** — Commit world.json to git with auto-generated message
   ```bash
   /infinite-worlds-architect:world-git snapshot <world.json> [message]
   ```
   - Auto-message: "Update world: added 2 NPCs, modified objective"
   - Prompts user for commit message if desired
   - Creates commit with world diff summary

2. **`world-git history`** — Show git history of world.json
   ```bash
   /infinite-worlds-architect:world-git history <world.json> [limit=10]
   ```
   - Lists commits with formatted diffs
   - Shows token cost delta per commit
   - Shows entity count changes per commit

3. **`world-git branch`** — Create spinoff on new git branch
   ```bash
   /infinite-worlds-architect:world-git branch <world.json> <branch-name> <spinoff-concept>
   ```
   - Creates new git branch (e.g., `spinoff/dragon-quest-v2`)
   - Generates spinoff world using existing spinoff-world workflow
   - Commits with reference to parent branch

4. **`world-git diff`** — Show detailed diff between commits
   ```bash
   /infinite-worlds-architect:world-git diff <world.json> [commit1] [commit2]
   ```
   - Default: compare HEAD with previous commit
   - Shows field-by-field changes, entity diffs, token deltas

**Implementation approach:**
- New skill file: `skills/world-git/SKILL.md`
- Helper functions: lib/git-helpers.js (git commands via Node.js child_process)
- Requires: git repo already initialized (check for .git/)
- Validation: confirm world.json is in git-tracked directory

**Requirements:**
- Git must be installed and available
- World file must be in a git repository
- User must have git credentials configured

**Acceptance Criteria:**
- [ ] New skill created with all 4 actions
- [ ] Git helper module implements core commands
- [ ] User prompted to initialize git if not present
- [ ] Commit messages include world diffs (auto-generated)
- [ ] History output shows formatted tables with deltas
- [ ] Branch creation integrates with spinoff-world workflow
- [ ] Error handling for non-git directories

---

## I12: Generic Patch Tool (`update_draft_field`)

**Status:** Pending
**Effort:** Medium
**Impact:** Highest (performance — ~7–9× wall-clock reduction on leaf-edit batches)

### Current State

`update_draft_section` rewrites the entire sub-field body even when only one labeled line changes
(e.g. the `Keywords:` line of a KIB). For a typical 6-KIB keyword batch under Opus, this
generates ~16 KB of tool-arg JSON and takes ~107 s of streaming.

### Proposed Solution

Add `update_draft_field`: a tool whose argument is the *change* only, not the full body.

```javascript
/**
 * Patch a single labeled field within a draft sub-field.
 * @param {Object} args
 * @param {string} args.draftPath  - Absolute path to the draft .md file
 * @param {string} args.sectionName - Top-level section header (e.g. "Honeyveil Blossom")
 * @param {string} args.subField   - Sub-field name within the section (e.g. "Keywords")
 * @param {string} args.fieldName  - Labeled line to patch (e.g. "Keywords")
 * @param {string} args.newValue   - Replacement value for that line
 * @param {string} [args.evidence] - Story-grounded evidence for the change
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function update_draft_field(args) { ... }
```

**Why it's the load-bearing improvement:** for a 6-KIB keyword batch, total tool args drop from
~16 KB to ~900 B — a ~94% reduction. At Opus output rates that cuts streaming from ~107 s to
~12–15 s (7–9×). The win scales with `1 - (patch_size / body_size)` and is large whenever the
change is a single line in a multi-line body.

### Implementation

**`lib/handlers/draft.js`**
- Factor the `readFile → splitSubFields → mutate-one → reassemble → writeFile` loop out of
  `update_draft_section` into a shared helper.
- Add a patch handler that receives a sub-field body and returns a new body with the targeted
  labeled line replaced (or inserted if absent — see design decisions below).
- The labeled-line parser must handle both H3-subheader format (`### Keywords` followed by
  content) and `Key: Value` pairs; detect the existing format per-field and preserve it.
- Fence tracking: reuse the existing `splitSubFields` fence logic (line 28) so fenced code
  blocks containing literal `### Keywords` text are not treated as headers.

**`lib/tools.js`**
- Register `update_draft_field` alphabetically (between `update_draft` and
  `update_draft_section`).
- Schema: `{ draftPath: string, sectionName: string, subField: string, fieldName: string,
  newValue: string, evidence?: string }`, `required: ["draftPath", "sectionName", "subField",
  "fieldName", "newValue"]`.

**`index.js`**
- Add `update_draft_field` to `toolHandlers` and import it.

**`skills/world-architect/SKILL.md`**
- Add `update_draft_field` to the tool reference list (lines 105–127).
- Add a "Best Practices" note: use the patch tool when changing one labeled line within a
  sub-field. Include a worked example for KIB keywords.

**`skills/world-architect/references/draft_schema.md`**
- Add an explicit list of legal `fieldName` values per container type (currently enumerated
  implicitly in lines 71–96) so the tool can validate inputs and produce useful error messages.

**`skills/modify-world/SKILL.md`**
- Note that `update_draft_field` is preferred over `update_draft_section` for single-line
  leaf edits; update the parallelism guidance accordingly.

**`test-files/`**
- Tests for each container type's known H3 subheaders.
- Negative tests: unknown `fieldName`, non-container section target, field absent before
  insert.
- Round-trip preservation of unrelated sub-fields (format-drift check).
- Concurrency test (6 parallel patch calls on different fields of same draft — requires I13).

### Design Decisions (resolved)

| Decision | Chosen |
|----------|--------|
| Generic vs domain-specific tools | Generic `update_draft_field` only — no `update_kib_keywords` etc. |
| `fieldName` absent in sub-field | **Insert** the field (do not fail) |
| Format preservation | **Yes** — detect H3 vs `Key: Value` per-field and preserve it |

### Generalisation Notes

The patch tool helps maximally for:
- KIB `Keywords` (the analyzed slow batch)
- Tracked Item `Data Type` / `Visibility` / `Initial Value`
- NPC `Location` / `Appearance` (single-line changes)

It helps minimally for prose rewrites (where change ≈ body size) and not at all for list
mutations (add/remove one condition from `### Conditions`). Realistic adoption: ~30–50% of leaf
edits, not 100%. The model will still fall back to `update_draft_section` for full-body
rewrites; SKILL.md guidance must steer the choice.

### Acceptance Criteria

- [ ] `update_draft_field` implemented in `lib/handlers/draft.js`
- [ ] Registered in `lib/tools.js` (alphabetical) and `index.js`
- [ ] Format preservation: H3 and `Key: Value` formats both round-trip cleanly
- [ ] Insert-on-missing: absent `fieldName` is appended to the sub-field body
- [ ] Error messages include item index and field name for debuggability
- [ ] `draft_schema.md` documents legal `fieldName` values per container type
- [ ] SKILL.md updated with worked example
- [ ] Round-trip and concurrency tests in `test-files/`
- [ ] Alphabetical ordering maintained in tool registry

---

## I13: Per-draftPath Async Mutex

**Status:** ✅ Implemented (2026-05-09) — PR #52
**Effort:** Low (~75 LOC including tests)
**Impact:** High (correctness — fixes TOCTOU lost-update race)

### Implementation Summary

**Completed:**
- ✅ `lib/locks.js` — promise-chain mutex keyed on `path.resolve(draftPath)`
- ✅ Lock applied to all 5 draft-mutating handlers: `update_draft_section`, `create_sub_field`, `rename_sub_field`, `delete_draft_sub_field`, `enable_story_grounded_mode`
- ✅ 30 s diagnostic timeout with safe chain-unblocking on timeout (adversarial review finding — without this, timed-out waiters would permanently deadlock all subsequent callers for that path)
- ✅ Idempotent release closure (`let released = false` guard) — safe against double-calls
- ✅ Map entry pruned on last release — no unbounded growth
- ✅ `test/handlers/draft-concurrency.test.js` — 6 tests covering: 6 parallel sub-field updates without lost writes, 6 parallel `create_sub_field` calls, serialisation order, map GC, independent-path non-blocking, and timeout path end-to-end (using Jest fake timers)
- ✅ All 505 tests passing

### Design

`lib/locks.js` uses a **promise-chain mutex** (FIFO ordering, pure JS Promises):

```javascript
const prev = locks.get(key) ?? Promise.resolve();
let release;
const acquired = new Promise(r => { release = r; });
const chain = prev.then(() => acquired);
locks.set(key, chain);
await prev; // wait for previous holder
return () => { release(); if (locks.get(key) === chain) locks.delete(key); };
```

Each new waiter appends to the tail of the chain. When the last holder calls `release()`, the map entry is deleted. Independent draft paths are fully parallel; serialisation only applies within a single `draftPath`.

### Adversarial Review Findings (addressed in PR #52, commit 2)

An adversarial code review found three issues before merge:

1. **CRITICAL (fixed):** The original timeout path threw before returning the release closure. Since `release` was never assigned, the handler's outer `finally` never called it, leaving `acquired` unresolved and all subsequent waiters permanently deadlocked. Fix: catch the rejection inside `acquireDraftLock`, call `release()` to unblock the chain, then re-throw.
2. **HIGH (fixed):** After fix #1, `release()` could be called twice (once in the catch, potentially again by user code). Fix: idempotency guard added to the returned closure.
3. **HIGH (fixed):** The `create_sub_field` concurrency test used `for...await` (sequential), not `Promise.all` (concurrent) — it never exercised the mutex. Fixed.

### Limitations (documented)

- Does not protect against external writes (out-of-process edits to the same draft file).
- Ordering for two calls targeting the **same** sub-field depends on lock acquisition order, not the array order the model emitted. The deferred bulk tool (I12) would sidestep this for array-shaped batches.
- In-process only; single-process stdio transport (sufficient for current architecture).

### Acceptance Criteria

- [x] `lib/locks.js` created with `acquireDraftLock` helper
- [x] Lock applied to 5 mutating handlers (4 specified + `enable_story_grounded_mode`)
- [x] 30 s diagnostic timeout implemented with safe chain-unblocking on timeout
- [x] Map entry pruned on last release (no memory leak)
- [x] Idempotent release closure
- [x] 6-test concurrency suite in `test/handlers/draft-concurrency.test.js`
- [x] No latency regression (serialisation overhead <300 ms for 6 calls)

---

## I14: Sonnet Executor Subagent (`world-mcp-executor`)

**Status:** Pending
**Effort:** Medium
**Impact:** High (performance + context preservation in long modify-world sessions)

### Current State

After the user approves a bulk change in `modify-world`, the parent agent (Opus) issues each
MCP call itself — generating large tool-arg blobs at Opus token rates and accumulating results
in the parent's context. Over a long session, this bloats the parent context and slows execution
for each subsequent batch.

### Proposed Solution

Define a plugin-local agent `world-mcp-executor` pinned to Sonnet. After user approval, the
`modify-world` skill hands the approved values to the subagent, which dispatches the MCP calls
and returns confirmations. The parent never generates the large tool-arg JSON and the results
stay inside the subagent's context.

**Why Sonnet:** Sonnet 4.6 outputs ~80 tok/s vs. Opus's observed ~37 tok/s — approximately 2×
faster for JSON generation. For execution turns (transcription, not design), there is no quality
regression. The primary benefit is context preservation: the tool-arg blobs and results never
bloat the parent's context window.

### Implementation

**`agents/world-mcp-executor.md`** (new file — `agents/` directory does not currently exist)

```markdown
---
name: world-mcp-executor
model: sonnet
description: Executor subagent for approved modify-world bulk MCP edits
tools:
  - update_draft_section
  - update_draft_field
  - create_sub_field
  - delete_draft_sub_field
  - rename_sub_field
  - add_npc
  - add_character
  - add_tracked_item
---

You are a pure executor. The parent agent has already obtained user approval for a set of
changes. Your only job is to translate the approved values into MCP tool calls in a single
parallel batch and return a confirmation summary. Do not propose new content, do not deviate
from the approved values, and do not ask for clarification.
```

**`skills/modify-world/SKILL.md`**
- Add a "post-approval routing" step: once the user approves a bulk change, dispatch
  `world-mcp-executor` rather than issuing MCP calls directly.
- The dispatch prompt must include all approved values verbatim to prevent context drift.
- Explicitly include "user has approved the following changes" in the dispatch prompt to
  prevent accidental pre-approval execution.

**`dev-docs/subagent-prompt-requirements.md`**
- Document the executor's required prompt block per the project's subagent prompt conventions.

**`test-files/`**
- Smoke test verifying the agent file's frontmatter parses correctly.
- Contract test checking the agent's tool whitelist matches the set of draft-mutating handlers.
- Note: full dispatch path testing depends on Claude Code's agent runtime; mark as manual-only.

**Verify plugin.json:** confirm whether `.claude-plugin/plugin.json` needs an explicit `agents`
field for auto-discovery, or whether placing the file in `agents/` is sufficient.

### Failure Mode Mitigations

| Risk | Mitigation |
|------|-----------|
| Context drift (subagent invents details) | Parent must include all approved values verbatim in dispatch prompt |
| Pre-approval execution | Subagent system prompt hard-refuses to propose new content; parent prompt must assert approval explicitly |
| Parallel subagent writes race (TOCTOU) | Resolved by I13 mutex — independent and required |
| Agent discovery in clean session | Verify in a test session; document in CLAUDE.md if `agents` field is needed |

### When the Subagent Adds Value

Once I12 (patch tool) exists, the subagent's raw perf benefit on leaf-edit batches is small
(~5 s). The primary value is **context preservation**: for long modify-world sessions with many
approved batches, keeping tool-arg blobs and result payloads out of the parent context
meaningfully extends effective session length. Build for context, not just speed.

### Acceptance Criteria

- [ ] `agents/` directory created at plugin root
- [ ] `agents/world-mcp-executor.md` created with correct frontmatter (`model: sonnet`)
- [ ] Tool whitelist in frontmatter matches all draft-mutating handlers
- [ ] System prompt hard-refuses to propose new content
- [ ] `skills/modify-world/SKILL.md` updated with post-approval routing step
- [ ] Dispatch prompt template documented (includes "user has approved" assertion + verbatim values)
- [ ] `dev-docs/subagent-prompt-requirements.md` updated with executor prompt block
- [ ] Plugin manifest verified (does `plugin.json` need an `agents` field?)
- [ ] Frontmatter parse test in `test-files/`
- [ ] Manual smoke test in a clean session

---

## Implementation Roadmap

### Phase 1: Highest Priority
- I4: Trigger Phrase Documentation (quick, highest value per effort, no dependencies)

### Phase 2: High Priority
- I2: Unit Tests (regression prevention, confidence — foundation for testing)
- I1: JSDoc Types (enables better IDE support for rest of work, can run in parallel with I2)

### Phase 3: Medium Priority
- I8: Pre-Commit Checks for Tests (prevents broken commits — requires I2)
- I9: Pre-Merge GitHub Checks (enforces CI before merging — requires I2 + I8)
- I3: Incremental Draft Validation (UX improvement)
- I5: Batch Entity Import Tools (moderate effort, useful feature)

### Phase 3b: Performance & Correctness (from PR #48 deep dive — implement in order)
- ✅ **I13: Per-draftPath Mutex** — implemented in PR #52 (2026-05-09)
- **I12: Generic Patch Tool** (highest single-item perf win; depends on I13 for concurrency safety — I13 now done)
- **I14: Sonnet Executor Subagent** (context preservation; perf benefit compounds with I12; implement after I12 + I13)

### Phase 4: Low Priority
- I6: World Comparison Analytics (high impact for world evolution)
- I7: Git-Based World Versioning (complex, optional feature for advanced users)

---

## Dependencies & Prerequisites

| Item | Depends On | Notes |
|------|-----------|-------|
| I4 (Documentation) | None | Pure documentation, can start immediately |
| I2 (Unit Tests) | None | Requires Jest/test framework setup |
| I1 (JSDoc) | None | Can run in parallel with I2 |
| I8 (Pre-Commit) | I2 (Unit Tests) | Requires test suite to be in place |
| I9 (Pre-Merge Checks) | I2 + I8 | Requires tests and pre-commit hooks |
| I3 (Validation) | None | Independent feature |
| I5 (Batch Tools) | None | Can add to index.js alphabetically |
| I6 (Analytics) | `compare_worlds`, `audit_world` | Already exist; build on top |
| I7 (Git) | None | Optional, can add anytime |
| I12 (Patch Tool) | I13 (Mutex) | Concurrent patch calls on same draft need the lock first |
| I13 (Mutex) | None | Cheap prerequisite; ship before or with I12 |
| I14 (Subagent) | I12 + I13 | Full benefit requires patch tool for small args and mutex for concurrent writes |

---

## Success Metrics

- **I1 (JSDoc):** IDE autocomplete works for all public functions in test file
- **I2 (Unit Tests):** 80%+ coverage on handlers, all tests passing
- **I3 (Validation):** Validation runs <1s per field, catches 5+ common errors
- **I4 (Documentation):** Trigger phrases referenced in README, user adoption increases
- **I5 (Batch Tools):** 3 new tools in alphabetical order, documented in SKILL.md
- **I6 (Analytics):** New skill generates 5-section comparison output
- **I7 (Git):** 4 git actions working, integration tested with real worlds
- **I8 (Pre-Commit):** Tests run automatically before commits, blocking broken code
- **I9 (Pre-Merge):** GitHub Actions workflow passes on all PRs, branch protection enforced
- **I12 (Patch Tool):** 6-KIB keyword batch wall-clock ≤15 s (down from ~107 s); round-trip format preserved; concurrency test passes
- **I13 (Mutex):** ✅ 6-test concurrency suite passing; 6 parallel writes all land without lost updates; timeout path verified with fake timers; no latency regression
- **I14 (Subagent):** Manual smoke test confirms subagent dispatches approved edits correctly; parent context growth per batch drops to near zero

---

## Notes

- All implementations should maintain **alphabetical ordering** of MCP tools in index.js
- All MCP tools should include JSDoc signatures (I1 enables this)
- All new tools should have unit tests (I2)
- All user-facing features should be documented in SKILL.md and trigger phrases in TRIGGER_PHRASES.md (I4)
- Plugin version should increment as features are added (1.3.0 → 1.4.0 for major features, 1.3.1 for bug fixes)

---

## I11: Wiki Reference Refresh (Cached-Fetch with Manual Review)

**Status:** Pending
**Effort:** Medium
**Impact:** Medium (Keeps field reference docs current with the living wiki)

### Problem

The 10 section reference files in `skills/world-architect/references/sections/` were populated from a one-time wiki crawl. The Infinite Worlds wiki is a living document — field descriptions, mechanics, and limits change over time. The reference files will drift out of date silently.

A naive alternative — fetching wiki pages live on every agent request — introduces network latency, offline failures, and no review gate between wiki edits and agent behaviour. It also surfaced during research that the wiki already contained incorrect JSON field names, which were caught precisely because there was a human review step before the content reached agents.

### Proposed Solution

A **cached-fetch with manual review** pattern: a script (or MCP tool) that re-crawls the relevant wiki pages on demand and regenerates the local reference files, followed by a `git diff` review before the changes are committed.

This gives the benefits of a living document (you can pull fresh content when the wiki is updated) while preserving the safety guarantees of the static approach (a human reviews the diff and can catch errors before they reach agents).

### Implementation

**Option A: npm script (`npm run refresh-field-refs`)**

A Node.js script (`scripts/refresh-field-references.js`) that:
1. Fetches each of the 10 wiki section pages via the MediaWiki REST API (`/api.php?action=parse&page=X&prop=text&format=json`)
2. Strips HTML boilerplate (navigation, edit links, categories) using a lightweight HTML parser
3. Converts the cleaned content back to Markdown (via `turndown` or equivalent)
4. Overwrites the corresponding file in `skills/world-architect/references/sections/`
5. Prints a summary of which files changed

The developer then runs `git diff skills/world-architect/references/sections/` to review changes before committing.

**Page mapping table (stored in the script):**
```javascript
const WIKI_PAGE_MAP = {
  'introducing-the-story.md': 'World_editing#Standard_World_Sections',
  'main-instructions.md': 'Main_instructions',
  'image-style.md': 'Image_Style',
  'player-characters.md': 'Player_Character_Options',
  'victory-defeat.md': 'Victory_%26_Defeat',
  'other-characters.md': 'Other_Characters',
  'keyword-instruction-blocks.md': 'Keyword_Instruction_Blocks',
  'tracked-items.md': 'Tracked_Items',
  'trigger-events.md': 'Trigger_Events',
  'misc-advanced-features.md': 'World_editing#Advanced_World_Sections',
};
```

**Option B: MCP tool `refresh_field_reference(section)`**

Useful if the author wants to refresh a single section mid-session without leaving Claude Code. Accepts a section name, fetches the corresponding wiki page, and updates just that file.

### Important caveats for the refresh script

- **The wiki can contain errors.** The original crawl found two incorrect JSON field names. After every refresh, diff the output against `lib/helpers.js` `VALID_EFFECT_TYPES` / `VALID_CONDITION_TYPES` to check for mismatches before committing.
- **Curated content will be overwritten.** The current reference files contain non-obvious insights (e.g. "victory/defeat conditions are engine-evaluated — the AI cannot see them during play") that were added by hand during the initial crawl. A naive overwrite loses this. The refresh script should append a `## Notes` section preserved from the prior version, or prompt the developer to re-verify any hand-written additions.
- **The wiki structure may change.** If a page is renamed or restructured, the page mapping table must be updated manually before the script will work again.

### Acceptance Criteria

- [ ] `scripts/refresh-field-references.js` created with full page mapping table
- [ ] Script strips HTML boilerplate cleanly (no `[edit]` links, navigation lists, or category tags in output)
- [ ] Output is valid Markdown readable by the Read tool
- [ ] Script prints per-file change summary on completion
- [ ] `package.json` `scripts` includes `"refresh-field-refs": "node scripts/refresh-field-references.js"`
- [ ] README documents the refresh workflow and the diff-review step
- [ ] (Optional) MCP tool `refresh_field_reference` added to `index.js` for single-section refresh
