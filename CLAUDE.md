# Infinite Worlds Architect Plugin — Development Guide

## Schema & Data Integrity
- **Maintain Schema Accuracy**: Whenever you modify the compiler, decompiler, or any MCP tools in `index.js`, you MUST immediately update the corresponding schema files in `skills/world-architect/references/` (`schema.md` and `draft_schema.md`). These files are the "source of truth" for both the AI and the user.
- **Cross-Reference**: Always cross-reference your logic in `index.js` against the definitions in the schema files to ensure consistency between the JSON structure and the Markdown draft format.

## Plugin Structure
- **Commands** are in `commands/*.md` (Markdown with YAML frontmatter).
- **Skills** are in `skills/world-architect/SKILL.md` with supporting files in `references/` and `scripts/`.
- **MCP Server** is `index.js` using `@modelcontextprotocol/sdk` with stdio transport.
- **Manifest** is `.claude-plugin/plugin.json`. MCP server config is in `.mcp.json`.
- Use `${CLAUDE_PLUGIN_ROOT}` for all intra-plugin path references in `.mcp.json` and hook scripts.

## Testing
- Test files are in `test-files/` — use these to validate compiler/decompiler changes.
- After modifying `index.js`, test the MCP server by running `node index.js` and verifying it starts without errors.
- MCP SDK v1.27.1 uses **newline-delimited JSON** for stdio transport (NOT Content-Length framing). Test harnesses must use `\n`-delimited messages.
- To reload plugin changes, restart your Claude Code session.

## Conventions
- Keep command prompts self-contained — they should not reference this file or any other file the end user won't have in context.
- Runtime behavioral instructions belong in `skills/world-architect/SKILL.md`, not here.
- When adding new MCP tools, update the SKILL.md "Reference Materials" section and relevant command prompts.
- Tool definitions in `ListToolsRequestSchema` must be in **alphabetical order**.
- All commands that produce world JSON must include a `validate_world` post-step.

## Known Issues
- Git worktree operations on WSL emit "could not write config file: Device or resource busy" — non-blocking, use `rm -rf` + `git worktree prune` as fallback.

## Roadmap
- See `.claude/improvement-roadmap.md` for the full prioritized improvement backlog (P0-P3).
