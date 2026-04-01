# Infinite Worlds Architect Plugin — Development Guide

## Schema & Data Integrity
- **Maintain Schema Accuracy**: Modifying compiler/decompiler/MCP tools in `index.js` requires immediate schema updates in `skills/world-architect/references/` (`schema.md`, `draft_schema.md`). These are the source of truth.
- **Cross-Reference**: Verify logic in `index.js` against schema definitions for JSON-to-Markdown consistency.

## Plugin Structure
- **Workflows** in `skills/<name>/SKILL.md` (Markdown + YAML frontmatter)
- **Core skill** in `skills/world-architect/SKILL.md` with `references/` and `scripts/`
- **MCP Server**: `index.js` using `@modelcontextprotocol/sdk` (stdio transport)
- **Manifest**: `.claude-plugin/plugin.json`; config in `.mcp.json`
- Use `${CLAUDE_PLUGIN_ROOT}` in `.mcp.json` and hook scripts for intra-plugin paths

## Testing
- Test files in `test-files/` validate compiler/decompiler changes
- Test MCP server: `node index.js` should start without errors
- MCP SDK v1.27.1 uses **newline-delimited JSON** (not Content-Length framing); test harnesses must use `\n`-delimited
- Reload plugin changes by restarting Claude Code session

## Conventions
- Skill prompts must be self-contained; don't reference files outside user context
- Runtime instructions go in `skills/world-architect/SKILL.md`, not here
- New MCP tools: update SKILL.md "Reference Materials" and related skill prompts
- `ListToolsRequestSchema` definitions must be alphabetically ordered
- Commands producing world JSON must include `validate_world` post-step

## Known Issues
- WSL git worktree "Device or resource busy" error — non-blocking; fallback: `rm -rf` + `git worktree prune`

## Scratchpad Directory
Temporary/uncommitted files go in `claude-scratchpad`. Before creating any file, verify if it should be committed; if not, place it there. Review commits to ensure all files are relevant; move extraneous files to scratchpad.

## Story Data Extraction Tools
See `skills/world-architect/references/story-extraction-tool.md` for docs on `extract_story_data` and `query_story_data` MCP tools.

### Bug Fixes (PR: fix/extraction-tool-bugs)
- **Parameter Naming**: Handlers now accept snake_case parameters (`input_paths`, `extraction_dir`) matching MCP spec
- **MCP Response Format**: Fixed response envelope to wrap results in proper MCP content format
- **Turn Extraction Regex**: Fixed to handle multiple consecutive newlines in turn markers
- **Test Coverage**: Added 19 comprehensive integration tests with 100% test pass rate

## Subagent Prompt Requirements
See [dev-docs/subagent-prompt-requirements.md](dev-docs/subagent-prompt-requirements.md) for required prompt block for implementation subagents.

## PR Review Protocol
See [dev-docs/pr-review-protocol.md](dev-docs/pr-review-protocol.md) for PR review subagent protocol.
