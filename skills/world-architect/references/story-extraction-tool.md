# Story Data Extraction Tool — Reference

This document provides complete reference material for the story data extraction MCP tools: `extract_story_data` and `query_story_data`.

## Overview

Programmatically parses Infinite Worlds story export files into structured JSON output. Replaces "read entire export" approach, reducing context usage by ~10x and eliminating hallucination risks when extracting data for sequel world generation.

## Tools

### `extract_story_data`

Parses story export files and writes structured JSON output.

**Parameters:**
- `input_paths` (string[]): Array of file paths to story exports
- `extraction_dir` (string): Directory where output JSON files will be written
- `characters` (optional, Character[]): Array of character definitions for optional character indexing
  - Each character has `name` (string) and `aliases` (string[])

**Returns:**
```json
{
  "success": boolean,
  "turnCount": number,
  "turnRange": { "min": number, "max": number },
  "trackedItemsFound": boolean,
  "characterIndexingCompleted": boolean,
  "filesWritten": string[],
  "warnings": string[]
}
```

**Output Files:**
- `manifest.json`: Extraction summary and file provenance
- `metadata.json`: Story header (title, background, character details, objective)
- `turn_index.json`: Turn-level summary (context, action, result text; line ranges)
- `tracked_state.json`: Tracked item snapshots (created only if items found)
- `character_index.json`: Character mention tracking (created only if characters provided)

### `query_story_data`

Queries previously extracted data by category.

**Parameters:**
- `extraction_dir` (string): Directory containing extracted JSON files
- `category` (string): One of `manifest`, `metadata`, `turn_index`, `tracked_state`, `turn_detail`
- `turns` (optional, string[]): Turn filters; supports "last" alias and turn numbers as strings

**Returns:** Structured data matching the requested category, or error message on failure

**Features:**
- "last" keyword resolves to highest turn number
- Turn filtering for targeted queries
- Source file extraction and provenance tracking

## Architecture

### Parser Phases

Located in `lib/parsers/`:

1. **Phase 1** (`phase1-combining.js`)
   - Combines multiple export files (handles 100-turn limit per export)
   - Deduplicates turns using mtime-based precedence
   - Detects gaps in turn numbering

2. **Phase 2** (`phase2-headers.js`)
   - State machine parsing of story headers
   - Extracts: title, story background, character details, skills, objectives

3. **Phase 3** (`phase3-turns.js`)
   - Section-based extraction of turn data
   - Parses: context, action, result sections
   - Tracks item mentions within turns

4. **Phase 4** (`phase4-tracked-items.js`)
   - Discovers tracked/hidden items from turn sections
   - Generates state snapshots (only when state changes)

### Handlers

Located in `lib/handlers/`:

- **validation.js**: Input validation for both tools (file existence, permissions, paths)
- **extraction.js**: Orchestrates parsing phases, character indexing, file writing
- **character-indexer.js**: Indexes character mentions by turn and line number
- **query.js**: Loads and filters extracted data
- **output-writer.js**: Atomic JSON file writing with schema validation

### Integration

- Both tools registered in `index.js` (ListToolsRequestSchema and toolHandlers)
- Alphabetical tool ordering maintained
- MCP server validated to start without errors

## Output Schemas

### manifest.json

```json
{
  "version": "1.0",
  "sourceFiles": [
    {
      "path": "string",
      "turns": "number[]",
      "mtime": "string"
    }
  ],
  "totalTurns": "number",
  "detectedGaps": ["number[]"],
  "trackedItemsFound": "boolean",
  "characterIndexingAttempted": "boolean"
}
```

### metadata.json

```json
{
  "title": "string",
  "background": "string",
  "character": {
    "name": "string",
    "background": "string",
    "skills": "string[]",
    "objective": "string"
  },
  "turnCount": "number"
}
```

### turn_index.json

```json
{
  "turns": [
    {
      "turnNumber": "number",
      "actionPreview": "string (100 chars)",
      "outcomePreview": "string (100 chars)",
      "lineRange": { "start": "number", "end": "number" },
      "sourceFile": "string"
    }
  ]
}
```

### tracked_state.json

```json
{
  "trackedItems": [
    {
      "itemName": "string",
      "snapshots": [
        {
          "turnRange": { "start": "number", "end": "number" },
          "state": "string"
        }
      ]
    }
  ]
}
```

### character_index.json

```json
{
  "characters": {
    "CharacterName": {
      "aliases": ["string[]"],
      "mentions": [
        {
          "turn": "number",
          "lines": ["number[]"],
          "context": "string (100 char preview)"
        }
      ]
    }
  },
  "indexed_character_count": "number",
  "total_mentions": "number",
  "incomplete": "boolean"
}
```

## Usage Examples

### Extract Story Without Character Indexing

```javascript
const result = await extractStoryData(
  ['/path/to/export.txt'],
  '/tmp/extraction'
);
```

Returns story structure without character mention tracking.

### Extract Story With Character Indexing

```javascript
const resultWithCharacters = await extractStoryData(
  ['/path/to/export.txt'],
  '/tmp/extraction',
  [
    { name: 'Victor', aliases: ['The Maestro', 'V'] },
    { name: 'Alice', aliases: [] }
  ]
);
```

Generates `character_index.json` with mention tracking for each character.

### Query Story Manifest

```javascript
const manifest = await queryStoryData(
  '/tmp/extraction',
  'manifest'
);
```

Returns: file sources, turn ranges, detected gaps, tracked items flags.

### Query Last Turn Details

```javascript
const lastTurn = await queryStoryData(
  '/tmp/extraction',
  'turn_detail',
  ['last']
);
```

Resolves "last" to highest turn number and returns full details.

## Key Features

- **Multi-file combining**: Handles 100+ turn stories split across multiple exports
- **Deterministic parsing**: No LLM/NLP; pure string and regex processing for reproducibility
- **No new dependencies**: Uses only Node.js built-ins
- **Generic entity discovery**: Parser learns item names from structural patterns
- **Snapshot-on-change**: Tracked items stored only when state changes (efficient storage)
- **Idempotent extraction**: Re-running with same inputs overwrites previous extraction
- **Atomic writes**: Output directory writes are atomic (write-then-rename pattern)
- **Input validation**: Comprehensive checks for file existence, permissions, paths

## Character Indexing (Optional Feature)

When character names are provided to `extract_story_data()`, the tool:

- Performs case-insensitive matching with word boundaries to avoid false positives
- Tracks line-by-line character mentions across all turns
- Extracts context (100 character preview of first mention)
- Sets incomplete flag if not all provided characters are found in the story
- Automatically searches character names and aliases

This enables targeted queries like "where is Victor mentioned?" without re-reading the entire story.

## Performance

- 22-turn export: <5ms parsing (with character indexing: <10ms)
- 30-turn export: ~3ms parsing
- 100-turn export: <15ms parsing (estimated)
- Memory: Minimal allocation with single-pass streaming where possible

## Testing

- **62 parser unit tests** covering all 4 phases
- **31 handler/validation tests** for extraction, query, and output writing
- **10 integration tests** with real story exports (4, 22, 30 turns)
- **16 character indexing tests** (finds characters, handles aliases, incomplete flag)
- **103+ total tests** with 100% pass rate
- **Manual test harness** for comprehensive end-to-end validation

## Design Principles

1. **No LLM/NLP**: Reproducible deterministic parsing, not subject to model hallucination
2. **No dependencies**: Uses only Node.js built-ins for reliability and minimal surface area
3. **Generic discovery**: Item parser learns from structural patterns, not hardcoded lists
4. **Efficient storage**: Snapshot-on-change strategy reduces file sizes for long stories
5. **Idempotent operations**: Safe to re-run extraction; output files overwrite safely
6. **Atomic writes**: Multi-file output written atomically to prevent partial states
7. **User-driven indexing**: Character indexing is opt-in; kept separate from core extraction

## Known Limitations

- Handles up to 100 turns per export file (Infinite Worlds limitation)
- Requires Turn 1 to be present in exports (parser anchor)
- Item discovery limited to items explicitly marked as "Tracked" or "Hidden"
- Character indexing depends on exact character name/alias provided (not fuzzy matching)

## Backward Compatibility

- Optional character indexing doesn't affect existing extraction functionality
- No breaking changes to core `extract_story_data` and `query_story_data` interfaces
- Existing code that calls these tools without character list continues to work unchanged
