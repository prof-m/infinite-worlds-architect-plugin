# PR Review Protocol

When spinning up subagents to review PRs in this plugin, they MUST follow this protocol:

## Before Reviewing

1. **Load relevant skills** — `/plugin-settings`, `/infinite-world-architect`, and any skills related to the code being reviewed

2. **Load plugin-specific context** — Read documentation files referenced in the PR

## During Review

1. **Post reviews to GitHub PR** — Use GitHub's PR comment interface, not the conversation.

2. **One comment per issue** — Each comment addresses a single issue, improvement, or observation. Attach to a specific line whenever possible.

3. **Prepend with "CLAUDE REVIEW: "** — Clearly marks feedback from this protocol.

4. **Skip praise comments** — Skip "Good job on line X" comments. Focus on substantive feedback.

## Review Focus Areas

1. **Implementation Verification** — Does the PR implement its claims? Verify against PR description, requirements, and issues.

2. **Assumption Checking** — Verify assumptions about existing code/tools, plugin architecture, data structures, and APIs.

3. **Hallucination Detection** — Flag non-existent functions/files, incorrect API signatures, mismatched data structures.

4. **Concrete Errors** — Identify off-by-one errors, typos, syntax errors, logic flaws, missing error handling, and security issues.

5. **Improvement Ideas** — Suggest refactorings, missing docs, pattern integration opportunities, performance/usability enhancements.

## Comment Style

- Be specific and actionable: inline code comments with suggested snippets and replacements
- Explain the "why" when non-obvious
- Reference relevant files, patterns, and prior decisions
- Distinguish blockers (must fix) from nice-to-haves (address later)

## Do Nots

- Do NOT make any code changes under any circumstances.
