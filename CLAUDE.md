# Infinite Worlds Architect Plugin — Development Guide

## Schema & Data Integrity
- **Maintain Schema Accuracy**: Whenever you modify the compiler, decompiler, or any MCP tools in `index.js`, you MUST immediately update the corresponding schema files in `skills/world-architect/references/` (`schema.md` and `draft_schema.md`). These files are the "source of truth" for both the AI and the user.
- **Cross-Reference**: Always cross-reference your logic in `index.js` against the definitions in the schema files to ensure consistency between the JSON structure and the Markdown draft format.

## Plugin Structure
- **User-invocable workflows** (commands) are in `skills/<name>/SKILL.md` (Markdown with YAML frontmatter).
- **Core world-architect skill** is in `skills/world-architect/SKILL.md` with supporting files in `references/` and `scripts/`.
- **MCP Server** is `index.js` using `@modelcontextprotocol/sdk` with stdio transport.
- **Manifest** is `.claude-plugin/plugin.json`. MCP server config is in `.mcp.json`.
- Use `${CLAUDE_PLUGIN_ROOT}` for all intra-plugin path references in `.mcp.json` and hook scripts.

## Testing
- Test files are in `test-files/` — use these to validate compiler/decompiler changes.
- After modifying `index.js`, test the MCP server by running `node index.js` and verifying it starts without errors.
- MCP SDK v1.27.1 uses **newline-delimited JSON** for stdio transport (NOT Content-Length framing). Test harnesses must use `\n`-delimited messages.
- To reload plugin changes, restart your Claude Code session.

## Conventions
- Keep skill prompts self-contained — they should not reference this file or any other file the end user won't have in context.
- Runtime behavioral instructions belong in `skills/world-architect/SKILL.md`, not here.
- When adding new MCP tools, update the SKILL.md "Reference Materials" section and relevant skill prompts.
- Tool definitions in `ListToolsRequestSchema` must be in **alphabetical order**.
- All commands that produce world JSON must include a `validate_world` post-step.

## Known Issues
- Git worktree operations on WSL emit "could not write config file: Device or resource busy" — non-blocking, use `rm -rf` + `git worktree prune` as fallback.

## Use the Scratchpad Directory For Temporary Files
When creating temporary files or files that are not meant to be committed to the main repo, always place those files in the claude-scratchpad directory. Before creating any file, always check if it's a file that needs to be committed to the repository. If it's not, put it in the claude-scratchpad directory.

Before committing any files, review them carefully to make sure each file is relevant to the commit's purpose. If there are extraneous files in the commit, move them to the claude-scratchpad directory before committing.

## Story Data Extraction Tools

See `skills/world-architect/references/story-extraction-tool.md` for complete documentation of the `extract_story_data` and `query_story_data` MCP tools.

## Git Workflow
- **All work on a feature branch in a worktree** — never directly on master. First action for any feature or fix: `git worktree add .claude/worktrees/<name> -b feature/<name>` and switch to it.
- **Never commit to master** — master is only updated via merged PRs.
- **Never push directly to master** — push with `git push origin feature/<branch-name>` and open a PR.
- **Stage but never commit without explicit user instruction** — use `git add` to prepare changes, then wait for the user to say "commit" or "create PR" before running `git commit`.
- **Subagents implementing features** must create a feature branch in a worktree as their very first action, before reading any files or writing any code.

### Subagent Prompt Requirements

Every prompt dispatched to an implementation subagent must include this block at the top, before the task description:

```
## Your first action (do this before anything else)
1. Create a git worktree: `git worktree add .worktrees/<branch-name> -b feature/<branch-name>`
2. All file reads and writes must happen within that worktree path
3. Never touch files on master

## Do NOT
- Commit to master
- Push to master
- Make any changes outside the worktree
```

Provide the exact branch name in the prompt — never leave branching to the agent's discretion.

## PR Review Protocol

When spinning up subagents to review PRs in this plugin, they MUST follow this protocol:

### Before Reviewing
1. **Load all relevant skills** — This will typically include:
   - `/plugin-settings` — Understanding plugin architecture and settings
   - `/infinite-world-architect` (or other applicable plugin skills) — Understanding what the PR modifies
   - Any other skills directly related to the code being reviewed

2. **Load plugin-specific context** — Read the relevant documentation files referenced in the PR to understand the full context of changes

### During Review
1. **Post reviews directly to the GitHub PR** — Do NOT return review feedback in the conversation. Use GitHub's PR comment interface to leave comments on the actual code.

2. **One comment per piece of feedback** — Each comment should address a single issue, improvement, or observation. Attach each comment to a specific line of code in the changed files whenever possible.

3. **Prepend all comments with "CLAUDE REVIEW: "** — This clearly marks feedback as coming from the review protocol.

4. **Skip complimentary comments** — Do not waste time or create noise by leaving comments that simply praise the PR (e.g., "Good job on line X"). Focus only on substantive feedback.

### Review Focus Areas
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

### Comment Style
- Be specific and actionable: leave in-line code comments on the PR's changed files, not just generic comments on the PR itself. Suggest code snippets, and exact replacements.
- Explain the "why" when the issue isn't obvious
- Reference relevant files, architecture patterns, or prior decisions when applicable
- Distinguish between blockers (must fix before merge) and nice-to-haves (can be addressed later)

### Do Nots
- Do NOT make any code changes under any circumstances.
