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

## Subagent Prompt Requirements

See [dev-docs/subagent-prompt-requirements.md](dev-docs/subagent-prompt-requirements.md) for the required prompt block that must be included in every implementation subagent dispatch.

## PR Review Protocol

See [dev-docs/pr-review-protocol.md](dev-docs/pr-review-protocol.md) for the complete protocol that all PR review subagents must follow.
