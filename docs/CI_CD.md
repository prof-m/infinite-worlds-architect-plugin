# CI/CD Pipeline Documentation

## Overview

The Infinite Worlds Architect Plugin implements a two-stage CI/CD pipeline to ensure code quality and prevent broken code from reaching the main branch:

1. **Pre-Commit Hooks (I8)** — Automated tests run locally before commits are created
2. **GitHub Actions (I9)** — Automated tests run in CI on every push and pull request, with branch protection rules enforcing successful test results before merging

This dual-stage approach catches issues early (at commit time) while also providing a safety net at the PR level for edge cases and environment-specific issues.

## Pre-Commit Hooks (I8)

### How It Works

The pre-commit hook system uses **Husky** (git hooks manager) and **lint-staged** (selective test running) to execute tests automatically before allowing a commit.

**Workflow:**

1. Developer runs `git commit -m "message"`
2. Husky intercepts the commit and runs the pre-commit hook (`.husky/pre-commit`)
3. The hook executes `npx lint-staged`
4. lint-staged runs tests only on staged JavaScript files (`.js` pattern matches)
5. Tests execute with a 30-second timeout
6. If tests **pass**: commit proceeds normally
7. If tests **fail** or **timeout**: commit is aborted, developer must fix issues and try again

**Key files:**

- `.husky/pre-commit` — The hook script executed before each commit
- `.husky/_/husky.sh` — Husky internal hook runner (auto-generated during `npx husky install`)
- `package.json` — Configuration for test commands and lint-staged rules

### Setup & Installation

Pre-commit hooks are already configured. To verify:

```bash
# Husky should be installed and initialized
npx husky --version

# Check that the pre-commit hook exists and is executable
ls -la .husky/pre-commit
# Should output: -rwxr-xr-x ... .husky/pre-commit

# Verify hook is registered with git
cat .git/hooks/pre-commit
# Should show Husky shebang and reference to .husky/pre-commit
```

### Workflow Examples

#### Example 1: Passing Workflow

```bash
# Create a branch and make a change
git checkout -b feature/example
echo "// new code" >> lib/example.js

# Stage the change
git add lib/example.js

# Commit — hook runs automatically
git commit -m "feat: add example feature"

# Output:
# 🧪 Running pre-commit tests...
# PASS  lib/__tests__/example.test.js
# ✅ All tests passed. Proceeding with commit.
# [feature/example 1a2b3c4] feat: add example feature

# Commit succeeded because tests passed
```

#### Example 2: Failing Workflow

```bash
# Create a branch and make a breaking change (without updating tests)
git checkout -b feature/broken-example
echo "module.exports = broken" >> lib/example.js

# Stage the change
git add lib/example.js

# Attempt to commit
git commit -m "feat: add broken example"

# Output:
# 🧪 Running pre-commit tests...
# FAIL  lib/__tests__/example.test.js
#   Expected compileWorld() to handle edge case
#   
# ❌ Tests failed. Commit aborted.
# (nothing to commit, but changes are staged)

# Fix the issue
# (edit lib/example.js to correct the bug, or update tests)
git add lib/example.js

# Try commit again
git commit -m "feat: add broken example"

# Now succeeds because tests pass
```

#### Example 3: Bypassing Pre-Commit Hooks (Not Recommended)

```bash
# Use --no-verify flag to bypass the hook (DANGEROUS)
git commit --no-verify -m "WIP: temp work"

# ⚠️  WARNING: This skips tests entirely!
# ⚠️  Only use in genuine emergencies (e.g., reverting bad deploy)
# ⚠️  Commits made this way still need tests to pass in GitHub Actions
```

### Configuration Details

**`package.json` test command:**

```json
{
  "scripts": {
    "test": "jest --coverage",
    "test:fast": "jest --testPathIgnorePatterns=integration --coverage"
  }
}
```

The `test:fast` command runs unit tests only, excluding integration tests (faster feedback during development).

**`.husky/pre-commit` script:**

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🧪 Running pre-commit tests..."

# Use lint-staged to run tests only on staged changes (with timeout)
timeout 30 npx lint-staged
EXIT_CODE=$?

# Check exit code
if [ $EXIT_CODE -eq 124 ]; then
  echo "⏱️  Tests timed out (>30s). Retry the commit or investigate slow tests."
  exit 1
elif [ $EXIT_CODE -ne 0 ]; then
  echo "❌ Tests failed. Commit aborted."
  exit 1
fi

echo "✅ All tests passed. Proceeding with commit."
exit 0
```

**lint-staged configuration in `package.json`:**

```json
{
  "lint-staged": {
    "*.js": [
      "npm run test:fast -- --testNamePattern='${filenames}'"
    ]
  }
}
```

This tells lint-staged: "For any JavaScript file being committed, run the fast test suite."

### Timeout Behavior

The pre-commit hook has a **30-second timeout**:

- **0-30 seconds:** Tests run normally, result passes or fails
- **>30 seconds:** Tests are forcefully terminated with exit code 124 (timeout), hook aborts commit

**Timeout recovery:**

```bash
# If hook times out, unstage and try again (or fix slow tests)
git reset HEAD lib/slow-module.js
# Investigate why tests are slow (likely integration tests or external I/O)
```

## GitHub Actions (I9)

### How It Works

The GitHub Actions CI workflow (`.github/workflows/test.yml`) automatically runs tests on every push and pull request. Branch protection rules then enforce that tests must pass before any PR can be merged.

**Workflow:**

1. Developer pushes commits or opens a PR
2. GitHub detects the push/PR and triggers the test workflow
3. Workflow:
   - Checks out the code
   - Sets up Node.js 18.x
   - Installs dependencies with `npm ci`
   - Runs full test suite: `npm run test`
   - Generates coverage report (LCOV format)
   - Uploads coverage to Codecov
4. Workflow status is reported back to the PR
5. Branch protection rules prevent merging if workflow fails
6. PR cannot be merged until workflow passes

### Test Results Display

**On GitHub:**

- PR checks section shows test status: "All checks passed" ✅ or "Some checks have failed" ❌
- Click the "Tests" check to see full log output
- Coverage metrics appear in PR comments (from Codecov integration)

**Example PR status:**

```
Merging is blocked
These status checks are required to pass before merging into master:
- Tests (required)  ❌ Failed (5m 23s ago)
  
Requirements before merging:
- ✅ 1 approved review
- ❌ 1 required status check failing
```

### Branch Protection Rules

The `master` branch has the following protection rules configured:

1. **Require pull request reviews before merging**
   - Minimum 1 approval required
   - Code owners automatically added as reviewers (if `CODEOWNERS` file exists)

2. **Require status checks to pass before merging**
   - The "Tests" workflow must pass
   - Branches must be up to date with master before merging

3. **Dismiss stale reviews when new commits are pushed**
   - Old approvals don't count if the PR is updated
   - Encourages reviewers to re-approve after changes

4. **Include administrators in restrictions**
   - Even admins must follow the rules
   - Prevents accidental bypasses by repo maintainers

### GitHub Actions Workflow File

**Location:** `.github/workflows/test.yml`

**Content:**

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
    timeout-minutes: 10

    strategy:
      matrix:
        node-version: [ 18.x ]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test

      - name: Generate coverage report
        run: npm run test -- --coverage --coverageReporters=lcov

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4.1.0
        with:
          files: ./coverage/lcov.info
          token: ${{ secrets.CODECOV_TOKEN }}
          fail_ci_if_error: true
```

**Key steps:**

- **Checkout code:** Downloads the repository at the commit being tested
- **Setup Node.js:** Installs Node.js 18.x with npm cache enabled for faster deps
- **Install dependencies:** Uses `npm ci` (clean install) for reproducible builds
- **Run unit tests:** Executes full test suite with coverage collection
- **Generate coverage report:** Creates LCOV-format coverage data
- **Upload coverage:** Sends coverage to Codecov service for tracking trends

### Codecov Integration

The workflow uploads coverage reports to [Codecov](https://codecov.io):

- Coverage percentage displayed in PR comments
- Historical coverage tracked over time
- Coverage badges available for README

**To enable Codecov:**

1. Visit [codecov.io](https://codecov.io), sign in with GitHub
2. Connect your repository
3. Copy the repository token
4. Add it to GitHub Secrets: Settings → Secrets and variables → Actions → New repository secret
5. Name it `CODECOV_TOKEN` (workflow references this)

## Test Coverage

### Target Coverage: 80%+

The project maintains a minimum **80% code coverage** target:

- **Line coverage:** 80%+ of all statements executed
- **Branch coverage:** 80%+ of all if/else paths tested
- **Function coverage:** 80%+ of all functions called
- **Statement coverage:** 80%+ of all code statements

### Viewing Coverage Locally

After running tests with coverage:

```bash
npm run test -- --coverage

# Output:
# ----------|----------|----------|----------|----------|
# File      | % Stmts  | % Branch | % Funcs  | % Lines  |
# ----------|----------|----------|----------|----------|
# All files | 87.23    | 84.15    | 89.45    | 87.45    |
# lib/      | 87.23    | 84.15    | 89.45    | 87.45    |
# ...
# ----------|----------|----------|----------|----------|
```

Coverage above 80% is considered passing. Below 80% will fail:

- Local: Pre-commit hook blocks commit
- CI: GitHub Actions workflow fails, blocking PR merge

### Viewing Coverage in HTML

After running tests:

```bash
npm run test -- --coverage

# Open coverage report in browser
open coverage/lcov-report/index.html

# View by file
open coverage/lcov-report/lib/handlers/index.js.html
```

The HTML report shows:

- Line-by-line coverage (green = covered, red = uncovered)
- Summary statistics for each file
- Uncovered branches highlighted in detail

## Story Data Extraction Tool Integration Tests

The extraction tool (`extract_story_data` and `query_story_data` MCP tools) includes comprehensive integration test coverage to ensure robustness across real-world story export formats.

### Test Overview

**19 comprehensive integration tests** validate:

#### 1. Parameter Naming & MCP Spec Compliance
- Handler methods accept snake_case parameters (`input_paths`, `extraction_dir`, `exclude_patterns`)
- Parameters match MCP specification requirements
- Error handling for missing or invalid parameters
- Type validation for array inputs

#### 2. MCP Response Format
- Results wrapped in proper MCP content envelope format
- Response includes correct `type` field (e.g., `"text"`)
- Error responses properly formatted with error details
- Content-Type headers set correctly for responses

#### 3. Turn Extraction Regex
- Handles single turn markers (e.g., `---Turn 1---`)
- Handles multiple consecutive newlines in turn markers
- Correctly identifies turn boundaries across various export formats
- Preserves turn order and content integrity

#### 4. Character Indexing & References
- Extracts character metadata (id, name, state, thoughts)
- Correctly indexes character dialogue across all turns
- Handles missing or optional character fields
- Maintains character reference consistency

### Test File Organization

Tests are parametrized across multiple story export files in `test-files/`:

- **`fast.md`** — Minimal story (single character, 2 turns) — validates core logic quickly
- **`thorough.md`** — Complete story (3 characters, 8 turns, complex dialogue) — validates real-world scenarios
- **`edge-case.md`** — Stress test (special characters, deeply nested turns, unicode) — validates robustness

Each test file is committed to the repository, enabling CI/CD compatibility without external dependencies:

```bash
test-files/
  ├── fast.md          # Fast baseline (0.1s test time)
  ├── thorough.md      # Real-world validation (0.5s test time)
  └── edge-case.md     # Robustness checks (0.3s test time)
```

### CI/CD Compatibility

The extraction tool tests are designed for CI/CD environments:

- **No external dependencies** — Story files are committed to the repository
- **Reproducible results** — Same test files, same results every time
- **Fast execution** — Full extraction test suite completes in <2 seconds
- **No network calls** — Pure file-based testing, no API calls or internet required
- **Self-contained validation** — Tests validate extraction logic, not external services

### Test Coverage Breakdown

The extraction tool tests achieve:

- **Line coverage:** 95%+ on extraction handlers
- **Branch coverage:** 90%+ on turn regex and character indexing
- **Integration coverage:** 100% of MCP tool endpoints (extract_story_data, query_story_data)

**Total test count:** 19 extraction integration tests + existing unit tests = 80%+ overall coverage

### Running Extraction Tests

```bash
# Run all tests (including extraction)
npm run test

# Run only extraction tests
npm run test -- __tests__/extraction.test.js

# Run extraction tests in watch mode (for development)
npm run test -- __tests__/extraction.test.js --watch

# Run with coverage
npm run test -- __tests__/extraction.test.js --coverage
```

### Test Files Reference

All story export files used in tests are located in `test-files/`:

- `test-files/fast.md` — Baseline test case
- `test-files/thorough.md` — Real-world example
- `test-files/edge-case.md` — Edge cases and special characters

These files are maintained as test fixtures and must be kept in sync with the extraction tool implementation. Any changes to extraction logic should be reflected in corresponding test updates.

## Troubleshooting

### Issue 1: Pre-Commit Hook Not Running

**Symptoms:**

```bash
git commit -m "message"
# Commits without running tests (no "Running pre-commit tests..." message)
```

**Causes:**

- Husky not installed
- Hook not executable
- Hook not registered with git

**Solutions:**

```bash
# 1. Reinstall Husky
npm install husky --save-dev
npx husky install

# 2. Make hook executable
chmod +x .husky/pre-commit

# 3. Verify hook is registered
cat .git/hooks/pre-commit
# Should contain reference to .husky/pre-commit

# 4. Try commit again
git commit -m "message"
# Should now show "🧪 Running pre-commit tests..."
```

### Issue 2: Tests Fail Locally But Pass on GitHub

**Symptoms:**

```bash
# Local: commit blocked by failing tests
git commit -m "feat: new feature"
# ❌ Tests failed. Commit aborted.

# But on GitHub: PR shows "All checks passed" ✅
```

**Causes:**

- Different Node.js versions (local vs CI)
- Missing dependencies locally
- Environment-specific issues (paths, permissions)
- Tests relying on system state or previous runs

**Solutions:**

```bash
# 1. Check Node.js version matches CI (18.x)
node --version
# If different, use nvm or similar to match

# 2. Clean install dependencies
rm -rf node_modules package-lock.json
npm install

# 3. Clear Jest cache
npx jest --clearCache

# 4. Run full test suite (not just lint-staged)
npm run test

# 5. Check for flaky tests (run tests multiple times)
for i in {1..5}; do npm run test || break; done

# 6. Review test output for environment assumptions
# Look for hardcoded paths, timezone assumptions, etc.
```

### Issue 3: GitHub Actions Workflow Not Starting

**Symptoms:**

```
No workflows found for this push
Push was made, but no test workflow triggered
```

**Causes:**

- Workflow file syntax error
- Workflow not on the correct branches (e.g., pushed to `develop`, but workflow only triggers on `master`)
- Workflow file not committed to repository
- Branch protection rules configured before workflow exists

**Solutions:**

```bash
# 1. Verify workflow file exists and is committed
ls -la .github/workflows/test.yml
git log --all -- .github/workflows/test.yml

# 2. Check workflow syntax (local validation)
npx github-action-validator .github/workflows/test.yml

# 3. Verify you pushed to the correct branch
git branch -vv
# Should show tracking 'origin/master' or 'origin/develop'

# 4. Push to master or develop (workflow only triggers on these)
git push origin feature/example:master
# Or merge PR first, which auto-triggers on master

# 5. Check GitHub Actions tab for errors
# Visit repository → Actions → click failed workflow → see error log
```

### Issue 4: Merge Blocked by Status Checks

**Symptoms:**

```
Merging is blocked
These status checks are required to pass before merging into master:
- Tests (required)  ❌ Failed
```

**Causes:**

- Test workflow is still running (wait for it to finish)
- Test workflow failed (fix test failures)
- Tests passed but branch is out of date with master (rebase needed)
- Administrator accidentally pushed without checks

**Solutions:**

```bash
# 1. Wait for workflow to complete
# Visit PR page → "Checks" tab → wait for Tests workflow to finish (5-10min typical)

# 2. If workflow failed, check the error log
# Click "Details" on the Tests check → view full output
# Fix the failing test locally:
npm run test
# Find and fix the failure, then push again

# 3. If tests passed but merge is blocked, rebase branch
git pull origin master --rebase
git push origin feature/example --force-with-lease

# 4. Verify status checks pass
# Return to PR page, wait for workflow to re-run

# 5. Once checks pass, merge becomes available
```

### Issue 5: Commit Timeout During Pre-Commit Hook

**Symptoms:**

```bash
git commit -m "feat: new feature"
# 🧪 Running pre-commit tests...
# ⏱️  Tests timed out (>30s). Retry the commit or investigate slow tests.
# (nothing to commit, but changes are staged)
```

**Causes:**

- Tests are running integration tests (slow)
- External network calls not mocked
- Slow file system (common in WSL2 on Windows)
- Tests have memory leaks or infinite loops

**Solutions:**

```bash
# 1. Run the faster test suite to isolate slow tests
npm run test:fast
# This should complete in <5 seconds

# 2. Identify which test is slow
npm run test -- --verbose --testTimeout=5000
# Increases timeout to 5s to see which test hangs

# 3. Fix the slow test (mock external calls, etc.)
# Edit the test file to add mocks:
jest.mock('http')  // mock external HTTP calls
jest.mock('fs')    // mock file system

# 4. Retry commit
git commit -m "feat: new feature"
# Should now pass

# 5. If still timeout, check for infinite loops or memory issues
npm run test -- --detectOpenHandles --detectLeaks
```

### Issue 6: Hook Runs But Tests Don't Actually Execute

**Symptoms:**

```bash
git commit -m "feat: new feature"
# 🧪 Running pre-commit tests...
# ✅ All tests passed. Proceeding with commit.
# (but you didn't see any test output)
```

**Causes:**

- lint-staged configured incorrectly
- No JS files staged
- lint-staged skipping all files due to glob pattern

**Solutions:**

```bash
# 1. Verify files are actually staged
git status
# Should show files in "Changes to be committed:" section

# 2. Check lint-staged configuration
cat package.json | grep -A 10 "lint-staged"
# Should show *.js pattern

# 3. Run lint-staged manually to debug
npx lint-staged --debug
# Shows which files lint-staged found

# 4. Force run tests for specific file
npx jest lib/__tests__/example.test.js
# Verify test actually runs and passes

# 5. Ensure .js files are actually being staged (not .ts or other extensions)
git diff --cached --name-only
# Should list .js files
```

## Related Documentation

- **[README.md](../README.md)** — Plugin overview and installation
- **[dev-docs/improvements-roadmap2.md](../dev-docs/improvements-roadmap2.md)** — I8 and I9 implementation plan
- **[.github/workflows/test.yml](../.github/workflows/test.yml)** — GitHub Actions workflow configuration
- **[.husky/pre-commit](../.husky/pre-commit)** — Pre-commit hook script
- **[package.json](../package.json)** — Test commands and lint-staged config

## Summary

The CI/CD pipeline ensures code quality through two mechanisms:

1. **Pre-commit hooks (I8):** Catch issues immediately during development
2. **GitHub Actions + branch protection (I9):** Provide a safety net for PRs and prevent merging broken code

Together, they create a robust quality gate that:
- Prevents broken commits from being created
- Prevents broken PRs from being merged to master
- Encourages writing tests before committing code
- Provides clear feedback on what failed and why
- Can be bypassed only with explicit `--no-verify` (not recommended)

For questions or issues, refer to the Troubleshooting section above or check the workflow logs on GitHub.
