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

## Story Data Extraction Tool

**New MCP tools** for parsing story exports programmatically (replaces "read entire export" approach).

### Tools

- **`extract_story_data`** — Parse story export files and write structured JSON output
  - Input: Array of file paths and output directory
  - Output: manifest.json, metadata.json, turn_index.json, tracked_state.json (optional)
  - Returns: success status, turn count, range, tracked items flags, warnings

- **`query_story_data`** — Query previously extracted data by category
  - Categories: `manifest`, `metadata`, `turn_index`, `tracked_state`, `turn_detail`
  - Features: "last" alias resolution, turn filtering, source file extraction
  - Returns: structured data or error message

### Architecture

**Parser phases** (lib/parsers/):
1. **Phase 1** (phase1-combining.js): Combine files, deduplicate turns by mtime, detect gaps
2. **Phase 2** (phase2-headers.js): Extract title, story background, character, objective
3. **Phase 3** (phase3-turns.js): Parse turn sections (action, outcome, secret info, tracked items)
4. **Phase 4** (phase4-tracked-items.js): Parse tracked items, generate state snapshots

**Handlers** (lib/handlers/):
- **validation.js**: Input validation for both tools
- **output-writer.js**: Atomic JSON file writing with proper schemas
- **extraction.js**: Orchestrates parsing → file writing
- **query.js**: Loads and filters extracted data

**Integration**:
- Both tools registered in index.js (ListToolsRequestSchema and toolHandlers)
- Alphabetical ordering maintained
- MCP server tested to start without errors

### Schema Files

Output JSON schemas defined in implementation plan (Section 2, Step 8):
- `manifest.json` — version, source files, total turns, detected gaps, tracked items flags
- `metadata.json` — title, background, objective, character (name, background, skills), turn count
- `turn_index.json` — turn array with action/outcome previews (100-char), line ranges, source files
- `tracked_state.json` — snapshots of tracked/hidden items by turn range (only if items exist)

### Usage Example

```javascript
// Extract story
const result = await extractStoryData(
  ['/path/to/export.txt'],
  '/tmp/extraction'
);

// Query extracted data
const manifest = await queryStoryData(
  '/tmp/extraction',
  'manifest',
  []
);

const lastTurn = await queryStoryData(
  '/tmp/extraction',
  'turn_detail',
  ['last']
);
```

### Testing

- **Unit tests**: 103 tests covering all phases, handlers, and integration
- **Integration tests**: Real story exports (4, 22, 30 turns)
- **Manual tests**: Comprehensive end-to-end harness in test-mcp-manual.js
- **Performance**: 22-turn export parses in < 5ms

## Roadmap
- See `claude-scratchpad/improvement-roadmap.md` for the full prioritized improvement backlog (P0-P3).
