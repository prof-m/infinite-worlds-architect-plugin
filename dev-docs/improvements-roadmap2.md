# Infinite Worlds Architect Plugin — Improvements Roadmap v2

Generated: 2026-03-28
Plugin Version: 1.3.0
Focus: Code Quality, UX, and Advanced Features

---

## Overview

This roadmap captures 9 key improvements identified through plugin analysis:

1. **Trigger Phrase Documentation** — Explicit documentation of skill activation patterns
2. **Unit Tests** — Test coverage for handler modules
3. **JSDoc Types** — Add type annotations to JavaScript functions
4. **Pre-Commit Checks for Tests** — Automated test execution before commits
5. **Pre-Merge GitHub Checks** — Required CI checks before merging
6. **Incremental Draft Validation** — Real-time field validation during drafting
7. **Batch Entity Tools** — Import multiple entities at once (characters, NPCs, items)
8. **World Comparison Analytics** — Enhanced comparison dashboard with metrics
9. **Git-Based World Versioning** — Version control integration for world.json files

---

## Status Tracker

| ID | Priority | Status | Effort | Impact | Description |
|----|----------|---------|---------|---------|----|
| I4 | Highest  | Pending | Low | Low | Trigger phrase documentation |
| I2 | High     | Pending | High | High | Unit tests for lib/handlers/* modules |
| I1 | High     | Pending | Medium | Medium | JSDoc types for IDE autocomplete and documentation |
| I8 | Medium   | Pending | Medium | High | Pre-commit hooks to run tests before commits |
| I9 | Medium   | Pending | Medium | High | GitHub branch protection and required status checks |
| I3 | Medium   | Pending | Medium | High | Incremental validation during draft workflow |
| I5 | Medium   | Pending | Medium | Medium | Batch entity import tools |
| I6 | Low      | Pending | High | High | World comparison analytics dashboard |
| I7 | Low      | Pending | High | Medium | Git-based world versioning |

---

## I4: Trigger Phrase Documentation

**Status:** Pending
**Effort:** Low
**Impact:** Low (Documentation value, user education)

### Current State

- Skills are discoverable via `/help`, but trigger phrases not explicitly listed
- Users don't know what natural language will activate skills
- No centralized reference for skill activation patterns

### Proposed Solution

Create **`TRIGGER_PHRASES.md`** file documenting all skill activation patterns.

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
- [ ] TRIGGER_PHRASES.md created with all 6 skills
- [ ] 3-5 trigger phrases per skill
- [ ] Examples of actual usage patterns
- [ ] Linked in README.md "How to Use Skills" section

---

## I2: Unit Tests for Handler Modules

**Status:** Pending
**Effort:** Medium
**Impact:** Medium (Better DX, IDE support)

### Current State

- Plain JavaScript functions with no type hints
- No JSDoc annotations
- IDE autocomplete limited to built-in Node APIs

### Proposed Solution

Add **JSDoc type annotations** to all exported functions and public handlers.

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
- [ ] All public functions have JSDoc signatures
- [ ] WorldJSON typedef defined and reused
- [ ] Tool arguments documented with types
- [ ] IDE autocomplete works in test file

---

## I2: Unit Tests for Handler Modules

**Status:** Pending
**Effort:** High
**Impact:** High (Regression prevention, confidence)

### Current State

- 23-test parity harness validates tool outputs vs. original monolith
- No focused unit tests for individual handler functions
- No tests for edge cases, error conditions, or data transformations

### Proposed Solution

Add **Jest or Node test** suite with focused unit tests for each handler module.

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
- [ ] Jest config created (package.json + jest.config.js)
- [ ] 15+ unit tests per handler module
- [ ] Coverage reports show 80%+
- [ ] All tests pass in CI
- [ ] Test fixtures include edge cases (empty worlds, max-size worlds, etc.)

---

## I1: JSDoc Types for JavaScript Functions

**Status:** Pending
**Effort:** Medium
**Impact:** Medium (Better DX, IDE support)

### Current State

- Plain JavaScript functions with no type hints
- No JSDoc annotations
- IDE autocomplete limited to built-in Node APIs

### Proposed Solution

Add **JSDoc type annotations** to all exported functions and public handlers.

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
- [ ] All public functions have JSDoc signatures
- [ ] WorldJSON typedef defined and reused
- [ ] Tool arguments documented with types
- [ ] IDE autocomplete works in test file

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

**Status:** Pending
**Effort:** Medium
**Impact:** High (Prevents broken commits, improves code quality)

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
- [ ] husky and lint-staged installed
- [ ] Pre-commit hook configured
- [ ] Tests run automatically on git commit
- [ ] Commit blocked if tests fail
- [ ] Can run locally and in CI
- [ ] Documentation added to README

---

## I9: Pre-Merge GitHub Checks

**Status:** Pending
**Effort:** Medium
**Impact:** High (Ensures quality before merging, enforces CI)

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
- [ ] GitHub Actions workflow created and running
- [ ] Tests pass in CI for all commits
- [ ] Branch protection rules configured
- [ ] Required status checks enforced
- [ ] PRs show check status before merge option
- [ ] Merge blocked until all checks pass
- [ ] Documentation updated with CI/CD process

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

---

## Notes

- All implementations should maintain **alphabetical ordering** of MCP tools in index.js
- All MCP tools should include JSDoc signatures (I1 enables this)
- All new tools should have unit tests (I2)
- All user-facing features should be documented in SKILL.md and trigger phrases in TRIGGER_PHRASES.md (I4)
- Plugin version should increment as features are added (1.3.0 → 1.4.0 for major features, 1.3.1 for bug fixes)
