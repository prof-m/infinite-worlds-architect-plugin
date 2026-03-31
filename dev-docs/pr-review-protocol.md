# PR Review Protocol

When spinning up subagents to review PRs in this plugin, they MUST follow this protocol:

## Before Reviewing

1. **Load all relevant skills** — This will typically include:
   - `/plugin-settings` — Understanding plugin architecture and settings
   - `/infinite-world-architect` (or other applicable plugin skills) — Understanding what the PR modifies
   - Any other skills directly related to the code being reviewed

2. **Load plugin-specific context** — Read the relevant documentation files referenced in the PR to understand the full context of changes

## During Review

1. **Post reviews directly to the GitHub PR** — Do NOT return review feedback in the conversation. Use GitHub's PR comment interface to leave comments on the actual code.

2. **One comment per piece of feedback** — Each comment should address a single issue, improvement, or observation. Attach each comment to a specific line of code in the changed files whenever possible.

3. **Prepend all comments with "CLAUDE REVIEW: "** — This clearly marks feedback as coming from the review protocol.

4. **Skip complimentary comments** — Do not waste time or create noise by leaving comments that simply praise the PR (e.g., "Good job on line X"). Focus only on substantive feedback.

## Review Focus Areas

1. **Implementation Verification** — Does the PR actually implement what it claims to implement? Verify against the PR description, feature requirements, or linked issues.

2. **Assumption Checking** — Double-check the PR author's assumptions about:
   - How existing code/tools work
   - Plugin architecture and patterns
   - Data structures and APIs
   - Tool parameters and return values

3. **Hallucination Detection** — Flag cases where the PR references or assumes:
   - Functions/files that don't exist
   - API signatures that are incorrect
   - Data structures that don't match actual implementation

4. **Concrete Errors** — Identify:
   - Off-by-one errors, typos, incorrect syntax
   - Logic errors that would cause runtime failures
   - Missing error handling or edge cases
   - Security/safety issues

5. **Improvement Ideas** — Suggest concrete improvements such as:
   - Simplifications or refactorings
   - Missing documentation or examples
   - Integration opportunities with existing patterns
   - Performance or usability enhancements

## Comment Style

- Be specific and actionable: leave in-line code comments on the PR's changed files, not just generic comments on the PR itself. Suggest code snippets, and exact replacements.
- Explain the "why" when the issue isn't obvious
- Reference relevant files, architecture patterns, or prior decisions when applicable
- Distinguish between blockers (must fix before merge) and nice-to-haves (can be addressed later)

## Do Nots

- Do NOT make any code changes under any circumstances.
