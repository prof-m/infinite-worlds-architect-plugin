# Story Comprehension Improvements for Sequel/Spinoff World Creation

## Status Summary

**Major Update (2026-03-28)**: Proposal 2B (Structured Story State Extraction) has been fully implemented and merged as PR #10. This document has been updated to reflect the actual implementation, integration roadmap, and refined 2C specification based on 2B learnings.

---

## Table of Contents

1. [Error Diagnosis Summary](#error-diagnosis-summary)
2. [Proposal 1: Anti-Fabrication Guard Rails](#proposal-1-anti-fabrication-guard-rails)
3. [Proposal 2: Story State Extraction — 2B IMPLEMENTED](#proposal-2-story-state-extraction--2b-implemented)
4. [Integration Roadmap](#integration-roadmap-using-2b-in-sequel-world-and-spinoff-world)
5. [Proposal 2C: Agent-Based Narrative Extraction (Refined)](#proposal-2c-agent-based-narrative-extraction-refined-based-on-2b-implementation)
6. [Proposal 3-8: Other Proposals](#remaining-proposals-3-5-7-8)
7. [Prioritized Implementation Order](#prioritized-implementation-order)
8. [Known Limitations](#known-limitations-and-design-notes)

---

## Error Diagnosis Summary

Analysis of a sequel-world generation session (Gemini agent processing a 250-turn story export for "How The Turns Table") revealed **28 distinct errors**.

### Error Pattern Distribution

| Category | Count | % | Description |
|----------|-------|---|-------------|
| Detail fabrication | 9 | 31% | Inventing physical descriptions, clothing, scents |
| Hallucination | 6 | 21% | Creating named abilities, secret projects that don't exist |
| Sanitization | 4 | 14% | Softening morally complex events |
| Stereotyping | 3 | 10% | Substituting genre-default appearances |
| Conflation/embellishment | 3 | 10% | Merging distinct events, inflating outcomes |
| Attribution error | 2 | 7% | Assigning one character's actions to another |
| Character flattening | 1 | 3% | Reducing complex characterization |
| Major factual inversion | 1 | 3% | Claiming intentional act was unintentional |

### Most Affected World Fields

1. **Other Characters - Appearance** (8 errors): Nearly every character received fabricated physical details
2. **Generalist Summary** (7 errors): Invented skill names, coined terminology, mischaracterized outcomes
3. **Other Characters - Secret Information** (4 errors): Fabricated motivations and projects
4. **Other Characters - Character Detail** (4 errors): Sanitized and simplified backstories

### Root Causes

1. **Stereotype substitution**: Genre-appropriate defaults when details missing
2. **Sanitization of dark content**: Softens manipulation, coercion, exploitation
3. **Proper noun invention**: Official-sounding capitalized terms
4. **Subagent cascade**: Flawed initial summary becomes ground truth
5. **Sarcasm/tone blindness**: Literal interpretation of ironic dialog
6. **Recency bias**: Fills gaps with fabrication rather than admitting uncertainty

---

## Proposal 1: Anti-Fabrication Guard Rails

**Status**: Ready to implement (low-cost, high-impact)

**What**: Add "Story Accuracy Requirements" section to sequel-world command prompt with explicit prohibitions against fabrication.

**How it works**: Insert guardrails before field-by-field walkthrough:
- ONLY include details explicitly stated in story text
- NEVER substitute genre stereotypes for missing details
- NEVER invent proper nouns, named abilities, coined terminology
- Distinguish literal statements from sarcasm, jokes, figurative language
- Do NOT sanitize morally complex events
- For appearance fields: prefer copying the story's own descriptions

**Token impact**: +150 tokens in command prompt. Very high ROI.

**Applies to**: Both sequel-world and spinoff-world.

**Plugin component**: command-development

---

## Proposal 2: Story State Extraction — 2B IMPLEMENTED

**Status**: ✅ FULLY IMPLEMENTED AND MERGED (PR #10)

### What Was Built

Two MCP tools that parse story exports into structured JSON:

1. **`extract_story_data`** — Parses story exports and writes JSON
   - Input: File paths, output directory
   - Output: manifest.json, metadata.json, turn_index.json, tracked_state.json, character_index.json (optional)
   - Returns: success, totalTurns, turnRange, inputFilesProcessed, hasTrackedItems, hasHiddenTrackedItems, filesWritten, warnings
   - Note: Character indexing is only available via direct function calls with characterList parameter; not exposed via MCP tool interface

2. **`query_story_data`** — Queries extracted data by category
   - Categories: manifest, metadata, turn_index, tracked_state, turn_detail
   - Features: "last" alias resolution, turn filtering, file caching (5+ turns)
   - Returns: structured data or error

### Parser Architecture

**Phase 1** (phase1-combining.js): Combines multiple files, deduplicates turns by mtime, detects gaps, builds manifest

**Phase 2** (phase2-headers.js): Extracts title, background, character details, skills, objective

**Phase 3** (phase3-turns.js): Parses turn sections (context, action, outcome, secret info), generates turn index with previews and line ranges

**Phase 4** (phase4-tracked-items.js): Discovers tracked/hidden items, builds value history snapshots (only on state changes)

### Output Files

- **manifest.json**: Version, source files, header source file, total turns, flags for tracked items presence, deduplication notes
- **metadata.json**: Title, story background, character details (name, background, skills), objective, turn count
- **turn_index.json**: Array of turns with action/outcome previews (100-char snippets only), line ranges, source files
- **tracked_state.json**: Snapshots of tracked items and hidden items by turn range (only if items exist). Each snapshot records state from from_turn to to_turn.
- **character_index.json** (optional): Character mention tracking by turn and line with context previews (requires characterList parameter, not exposed via MCP interface)

### What 2B Extracts

✅ Story background, player character sheet (name, background, skills), objective
✅ Tracked item histories with change detection (only turns where value changes)
✅ Hidden tracked items with full history
✅ Character mention counts seeded from world NPC names (simple string matching)
✅ Per-turn section text accessible via query_story_data(category='turn_detail')

### What 2B Defers to 2C

❌ Character descriptions, aliases, lastKnownLocation (require narrative understanding)
❌ Relationships (embedded in narrative, not structured in exports)
❌ Locations (no whereWhen field exists in tested exports)
❌ Events/plot milestones with descriptions (require semantic judgment)
❌ Story arc summaries (opening/final summaries, unresolved threads)

### Test Coverage

✅ 112 comprehensive tests (100% pass rate)
- Parser unit tests (all 4 phases)
- Handler/validation tests (extraction, query, output writing, character indexing)
- Character indexing tests
- Integration tests with real exports (4, 22, 30 turns)
- Performance: 22-turn export <5ms; 30-turn export ~3ms

### Design Principles Embodied in 2B

1. **Deterministic**: No hallucination risks, validated across 4 diverse exports. Character indexing is available internally but not exposed via MCP to prevent agents from requesting features not in the interface.
2. **Zero dependencies**: Uses only Node.js built-ins (fs, path)
3. **Multi-file output**: Agents load only what they need; tracked items isolated
4. **Query tools abstraction**: Path traversal defenses, automatic file caching for 5+ turn queries
5. **Honest schema**: Structured data with no invented fields. Narrative understanding (character descriptions, relationships, locations, events) intentionally deferred to 2C agents for semantic reading.

### Token Impact

**MAJOR REDUCTION**: Instead of loading 16,000+ lines of raw story text, agents receive structured JSON via query tools.
- Minimal worlds: ~500 tokens total
- Tracked-item-rich worlds: ~500-1K for metadata + 10K+ for tracked_items (loaded selectively)

### Documentation

See `skills/world-architect/references/story-extraction-tool.md` for complete tool reference (output schemas, usage examples, performance notes, character indexing feature).

---

## Integration Roadmap: Using 2B in Sequel-World and Spinoff-World

2B is complete and tested. These tasks integrate it into the commands so it actually gets used.

### Integration Task 1: Call extract_story_data from sequel-world command

**What**: When user provides story export file(s), automatically call extract_story_data to populate extraction directory.

**Details**:
- Agent specifies extraction directory (e.g., `$CWD/extracted_story`)
- Returns success/failure status; agent continues or falls back to manual processing
- Applies to: sequel-world (primary)
- Dependencies: None (2B is complete)
- Complexity: Low (add MCP tool call to command prompt)
- Expected token impact: One-time extraction cost (~100 tokens) + subsequent selective data loading via query tools

### Integration Task 2: Use query_story_data during field-by-field walkthrough

**What**: Modify command to load extraction data via query_story_data calls rather than having agent read raw story text.

**Details**:
- Agent calls `query_story_data(extraction_dir, 'metadata')` for story background/objective fields
- Agent calls `query_story_data(extraction_dir, 'turn_detail', [N, ...])` for deep-dives into specific turns
- Agent calls `query_story_data(extraction_dir, 'tracked_state')` or `query_story_data(extraction_dir, 'tracked_state', [N, ...])` for tracked item fields
- Applies to: sequel-world, spinoff-world (if story exports added)
- Dependencies: Task 1 (extraction must have been run before querying)
- Complexity: Medium (add query tool calls to field-by-field walkthrough; update reference docs)
- Expected token impact: Data access via query tools more efficient than re-reading raw files

### Integration Task 3: Integrate Proposal 1 (Anti-Fabrication Guard Rails)

**What**: Add "Story Accuracy Requirements" section from Proposal 1 to sequel-world prompt.

**Details**:
- Applies to: Both sequel-world and spinoff-world
- Dependencies: None (independent)
- Complexity: Low (prompt edit, +150 tokens in command)
- Saves far more tokens in reduced correction cycles

### Integration Task 4: Implement Proposal 4 (Character Field Writing Guide)

**What**: Create reference doc + integrate into command to guide agent on synthesizing extraction data to field values.

**Details**:
- Create `skills/world-architect/references/character_writing_guide.md`
- Guide includes: Identity, Appearance (ONLY from story text), Relationships, Arc Progression, Tracked State, Status Changes
- Applies to: Both sequel-world and spinoff-world
- Dependencies: Task 2 (optional, but guide designed for 2B-only and 2B+2C scenarios)
- Complexity: Medium (reference doc + prompt integration)
- Expected token impact: +200-300 tokens for guide; prevents fabrication errors across 5+ character fields per character

### Integration Task 5: Implement Proposal 5 (Source-First Field Proposal Protocol)

**What**: Require evidence citations before each field proposal, using 2B's extraction output as primary citation source.

**Details**:
- When extraction data available: cite specific extraction data (e.g., "From query_story_data(category='metadata'): objective = ...")
- When extraction data lacks field: cite turn numbers from raw story text
- Applies to: sequel-world (primary), spinoff-world for story-derived fields
- Dependencies: Task 2
- Complexity: Low-Medium (prompt edit to field proposal instructions)
- Expected token impact: +50-100 tokens per field for citations; net savings because citations reference structured data

### Integration Task 6: Implement Proposal 7 (Story-to-Lorebook Output Strategy)

**What**: Create reference doc + guidance defining tier strategy for distributing extracted story state across field types.

**Details**:
- Create `skills/world-architect/references/story_context_distribution.md`
- Define: Always-on fields (background, instructions, objective, descriptionRequest) vs. Keyword blocks (per-character, per-location) vs. Tracked items vs. SecretInfo
- Add distribution guidance to sequel-world/spinoff-world commands
- Applies to: Both sequel-world and spinoff-world
- Dependencies: None (can be done independently)
- Complexity: Low-Medium (reference doc + prompt integration)
- Expected token impact: NET REDUCTION; moves context from always-on fields to keyword blocks (only injected on relevance)

### Integration Task 7: Implement Proposal 8 (Pre-Generation Story Facts Review)

**What**: After extraction completes, agent assembles "Story Facts Brief" from extraction data. User reviews and corrects; agent writes verified_story_facts.md to persist corrections. Agent loads and references during field-by-field walkthrough.

**Details**:
- Agent assembles brief from extraction data + narrative comprehension
- User corrects character appearances, personality, relationships, major events, current status, terminology
- Agent writes `verified_story_facts.md` with corrections
- Agent references this file throughout walkthrough to ensure consistency
- Applies to: Both sequel-world and spinoff-world
- Dependencies: Task 1 (extraction must have been run)
- Complexity: Medium (orchestration + user interaction + file persistence)
- Expected token impact: Upfront cost (~500-1500 tokens for review) + per-field savings (corrections prevent multi-field propagation)

### Integration Sequence

**Phase 1 (Immediate)**: Tasks 1, 3
- Get extraction tool in use
- Add guard rails

**Phase 2 (Near-term)**: Tasks 2, 4, 5, 7
- Query tools integrated
- Character guide + field citations
- Facts review

**Phase 3 (Polish)**: Tasks 6
- Lorebook strategy

---

## Proposal 2C: Agent-Based Narrative Extraction (Refined Based on 2B Implementation)

**Status**: Not yet implemented. Refined specification based on actual 2B implementation.

### What 2C Would Do

Fill the 7 field categories that 2B leaves empty: character descriptions, relationships, locations, events, plot milestones, unresolved threads, story arc summaries. Uses Claude agents within Claude Code session (not external API calls).

### Why Agent-Based, Not API Calls

- Zero new dependencies (agent definition files are markdown)
- Zero API key management (agent runs within user's Claude Code session)
- Agents can use tools (verify claims by grepping source files, read 2B data via query tools)
- Natural fit for plugin architecture (agents are first-class components)
- Lower per-extraction cost (Haiku agent tokens, ~$0.01-0.05 per extraction)

### Lessons from 2B That Inform 2C

1. The 4-phase parser architecture works reliably (validated across 4 diverse exports)
2. Multi-file output with query tools is more efficient than monolithic extraction
3. Character indexing (PR #12) showed specialized extraction for entities is practical
4. Deterministic parsing revealed the actual data available (and what's NOT): Character descriptions/relationships/locations/events are narrative-only
5. Test infrastructure (144 tests) provides confidence in extraction accuracy

### 2C Agent Architecture

**Orchestrator agent** (`agents/narrative-extractor.md`)
- Reads 2B's manifest.json and metadata.json via query_story_data
- Spawns 4 specialist subagents in parallel
- Merges their outputs into `narrative/` subdirectory
- Validates merged output against 2B's factual data (cross-references)

**Character specialist subagent**
- Task: Extract descriptions, aliases, lastKnownLocation
- Input: character list from 2B + per-turn section text via query_story_data(turn_detail)
- Output: `narrative/characters.json` with name, descriptionsFound[], aliases[], lastKnownLocation, sourceTurns citations
- Method: Grep per-turn text for physical descriptions, clothing, mannerisms; note turn number

**Relationship specialist subagent**
- Task: Extract relationships between characters
- Input: character mention list from 2B + Outcome and SecretInfo sections
- Output: `narrative/relationships.json` with source, target, type, description, sourceTurns
- Method: Identify character interactions, power dynamics, relationship evolution across turns

**Location specialist subagent**
- Task: Extract locations and place descriptions
- Input: per-turn Outcome text (where events happen)
- Output: `narrative/locations.json` with name, description, firstTurn, lastTurn
- Method: Grep for place names, match against world geography context

**Event specialist subagent**
- Task: Extract events, plot milestones, unresolved threads
- Input: full turn-by-turn Outcome and SecretInfo text
- Output: `narrative/events.json` and `narrative/story_arc.json`
  - `events.json`: events array with type, description, involved characters, turn, status
  - `story_arc.json`: openingSummary, finalSummary, milestones[], unresolvedThreads[]
- Method: Identify narrative turning points, major plot events, open threads

### Output Structure

```
{extractionDir}/
  index.json                -- (from 2B, untouched)
  metadata.json             -- (from 2B, untouched)
  turn_index.json           -- (from 2B, untouched)
  tracked_state.json        -- (from 2B, untouched)
  narrative/                -- (NEW, from 2C agent)
    characters.json         -- name, descriptionsFound[], aliases[], lastKnownLocation (with sourceTurns)
    relationships.json      -- source, target, type, description, sourceTurns
    locations.json          -- name, description, firstTurn, lastTurn
    events.json             -- events with type/description/characters/turn/status/sourceTurns
    story_arc.json          -- openingSummary, finalSummary, milestones[], unresolvedThreads[]
```

Each data point includes `sourceTurns` array citing where supporting text was found.

### Integration With 2B Query Tools

When `narrative/` directory exists, query tools would require modifications to detect and merge 2C data:
- Currently: 2B query tools have no knowledge of `narrative/` directory
- Proposed: `query_story_data(category='metadata')` could include 2C's story_arc summaries and milestones if narrative/ directory is detected
- Current behavior: Agents must manually merge 2C results with 2B data
- **Note**: Adding narrative/ detection and auto-join would require modifications to query.js (specifically the 'metadata' case and new aggregation logic)

### Cost and Performance

- Orchestrator + 4 specialists run on Haiku (configurable in agent frontmatter)
- Total cost: ~$0.01-0.05 per extraction (Haiku tokens)
- Each specialist reads ~250 turns via query tools or direct file reads of `turns/` directory
- Parallel execution faster than sequential API calls
- Results cached in `narrative/` directory (re-run only if story changes or agent prompts improve)

### Testing Approach for 2C

1. Run 2C agent on the 4 validated story exports (4-turn, 22-turn, 30-turn, 30-turn no-tracked-items)
2. Verify that every extracted fact includes sourceTurns citations
3. Spot-check claims by grepping the cited turns (verify turn contains claimed text)
4. Cross-reference 2C claims against 2B's deterministic data where possible
5. Manual review by human who knows the test stories

### Implementation Complexity

- **Agent definition files**: ~200-400 lines of markdown prompts across orchestrator + 4 specialists
- **Query tool extensions**: ~100-150 lines of code in index.js to detect `narrative/` and join data
- **No new application code** beyond the above (no HTTP wrappers, no API key management, no SDK integration)
- Estimated effort: 2-3 days for experienced developer (writing specialist prompts, testing, integration)

### When 2C Becomes Essential

After 2B has been integrated and validated in real sessions. Priorities:

1. **Worlds with extensive tracked items** (HTTT): 2B captures most value; 2C adds character/relationship depth
2. **Worlds with few/no tracked items** (RingOfDis): 2B minimal; 2C essential for meaningful extraction
3. **Sequel-world sessions with many characters**: Character specialist becomes high-ROI
4. **Sessions wanting story-to-lorebook integration**: 2C's relationship/location/event data drives keyword block strategy

### Fallback Behavior (If 2C Never Implemented)

If 2C is never implemented, the sequel-world command still works fully with 2B alone:
- Agent reads 2B's deterministic data for tracked items, story structure
- Agent reads specific turns via `query_story_data(extraction_dir, 'turn_detail', [N, ...])` for narrative understanding and character descriptions
- Proposal 4 (Character Writing Guide) guides agent to synthesize character fields from turn text when `narrative/` doesn't exist
- Note: Character mention tracking via character_index.json requires character indexing, which is not currently exposed via MCP tool interface
- This is less efficient than 2C but significantly better than current approach (no extraction at all)

---

## Remaining Proposals (3, 5, 7, 8)

### Proposal 3: Safety Fallbacks (Manual Processing + Summary Validation)

**When**: Use if 2B extraction tool unavailable or fails on non-standard export

**What**: Structured manual processing protocol + summary validation step

**How**:
- Divide story into ~40-60 turn segments
- Process each segment independently (extract characters, tracked items, events)
- Merge segment extractions with equal weighting (counters recency bias)
- Validate merged summary before using for field proposals

**Token impact**: Moderate increase (~100-200 tokens per segment + ~300-500 for validation)

**Plugin component**: command-development

---

### Proposal 5: Source-First Field Proposal Protocol

See Integration Task 5 above.

---

### Proposal 7: Story-to-Lorebook Output Strategy

See Integration Task 6 above.

---

### Proposal 8: Pre-Generation Story Facts Review

See Integration Task 7 above.

---

## Prioritized Implementation Order

### Tier 1: Foundation (Done + Ready)

| Priority | What | Status | Effort |
|----------|------|--------|--------|
| P1 | 2B Story Extraction Tool | ✅ DONE | Merged PR #10 |
| P1a | Proposal 1: Anti-Fabrication Guard Rails | Ready | Low |
| P1b | Integration Task 1: Call extract_story_data | Ready | Low |

### Tier 2: Core Integration

| Priority | What | Effort | Complexity |
|----------|------|--------|-----------|
| P2a | Integration Task 2: Use query_story_data | Medium | Medium |
| P2b | Integration Task 3: Anti-Fabrication | Low | Low |
| P2c | Integration Task 4: Character Guide | Medium | Medium |
| P2d | Integration Task 5: Field Citations | Low-Medium | Low-Medium |
| P2e | Integration Task 7: Facts Review | Medium | Medium |

### Tier 3: Polish & Future

| Priority | What | Effort | Complexity |
|----------|------|--------|-----------|
| P3a | Integration Task 6: Lorebook Strategy | Low-Medium | Low-Medium |
| P3b | Proposal 3: Safety Fallbacks | Low | Low |
| P3c | Proposal 2C: Agent-Based Narrative Extraction | Medium | Medium |

### Implementation Dependencies

```
2B Implementation (DONE) ──── PR #10 merged
      │
      ├── Integration Task 1: Call extract_story_data
      │         │
      │         ├── Integration Task 2: Use query_story_data
      │         │         │
      │         │         ├── Integration Task 4: Character Writing Guide
      │         │         └── Integration Task 5: Field Citations
      │         │
      │         └── Integration Task 7: Facts Review
      │
      ├── Integration Task 3: Anti-Fabrication (Proposal 1)
      │
      ├── Integration Task 6: Lorebook Strategy (Proposal 7)
      │
      └── 2C: Agent-Based Narrative Extraction (optional, builds on 2B)
                   │
                   └── Requires: narrative/ directory structure + query tool extensions
```

---

## Known Limitations and Design Notes

### What 2B Implementation Revealed

1. **Tracked item text blobs can be very large**: HTTT's Suggestions and Traits fields exceed 10K tokens
2. **Character mention counting is simple string matching**: No alias resolution; requires name seeds from world NPC list
3. **Secret Information format varies across worlds**: Counsellor2 uses structured `### SECRETINFO_START` blocks; others use free-form prose
4. **Per-turn section extraction enables deep-dives**: Agent can read specific turns for narrative understanding without loading entire export
5. **Narrative understanding appropriately deferred to 2C**: No deterministic parser can extract relationships, character descriptions, locations, events from prose
6. **4-phase parser architecture robust**: Validated across 4 diverse exports (4, 22, 30, 30 turns)
7. **Multi-file output with query tools efficient**: Agents load selectively; tracked items isolated; batch queries use file caching

### Design Choices Made in 2B

- **Left narrative understanding to 2C**: Rather than attempting deterministic parsing that would produce empty arrays or hallucinated data
- **Character indexing optional feature**: Core extraction works without it; available when character list provided
- **Multi-file output trades count for efficiency**: More files but agents load selectively; smaller context per query
- **Path traversal defenses + file caching built in**: Prevents abuse; optimizes batch queries

---

## Adversarial Review Notes (From Original Analysis)

**Still applicable to all proposals**: The error patterns from the original diagnosis remain the fundamental problems. All proposals address specific error categories:

- Proposals 1 + 3: Structural guardrails (detail fabrication, hallucination, stereotyping, sanitization)
- Proposal 2 (2B): Root cause fix (eliminates need to read raw story; provides structured data)
- Proposal 4: Synthesis guardrails (character appearance, relationships)
- Proposal 5: Transparency (citations let user verify agent reasoning)
- Proposal 7: Efficiency (token reduction via keyword blocks)
- Proposal 8: Upstream error detection (review before field-by-field walkthrough)
- Proposal 2C: Automation (agents extract narrative fields; humans review)

