# Story Comprehension Improvements for Sequel/Spinoff World Creation

## Status Summary

**Latest Update (2026-03-31)**: 
- ✅ **Proposal 1** (Anti-Fabrication Guard Rails) - FULLY IMPLEMENTED (PR #22)
- ✅ **Integration Tasks 1 & 2** (Extract & Query Story Data) - FULLY IMPLEMENTED (PR #21)
- ✅ **Proposal 2B** (Story State Extraction) - FULLY IMPLEMENTED & INTEGRATED (PR #10, original implementation)

**Implementation archived**: See `story-comprehension-improvements-implemented.md` for completed work details.

---

## Table of Contents

1. [Completed Work Summary](#completed-work-summary)
2. [Proposal 2B: Story State Extraction (Foundation)](#proposal-2b-story-state-extraction-foundation)
3. [Proposal 2C: Agent-Based Narrative Extraction (Refined)](#proposal-2c-agent-based-narrative-extraction-refined-based-on-2b-implementation)
4. [Remaining Proposals (3, 4, 5, 7, 8)](#remaining-proposals-3-4-5-7-8)
   - [Proposal 3: Safety Fallbacks](#proposal-3-safety-fallbacks-manual-processing--summary-validation)
   - [Proposal 4: Character Field Writing Guide](#proposal-4-character-field-writing-guide-2b-integration)
   - [Proposal 5: Source-First Field Proposal Protocol](#proposal-5-source-first-field-proposal-protocol-2b-integration)
   - [Proposal 7: Story-to-Lorebook Output Strategy](#proposal-7-story-to-lorebook-output-strategy-2b-integration)
   - [Proposal 8: Pre-Generation Story Facts Review](#proposal-8-pre-generation-story-facts-review-2b-integration)
5. [Prioritized Implementation Order](#prioritized-implementation-order)

---

## Completed Work Summary

**✅ Proposal 1: Anti-Fabrication Guard Rails** (PR #22, merged 2026-03-31)
- Added 7 anti-fabrication guardrails to sequel-world and spinoff-world commands
- Field-level verification checklist before field-by-field walkthrough
- Addresses all 6 major error categories from original diagnosis
- Files: `skills/sequel-world/SKILL.md`, `skills/spinoff-world/SKILL.md`

**✅ Integration Tasks 1 & 2** (PR #21, merged 2026-03-31)
- Task 1: Call `extract_story_data` MCP tool when user provides story exports
- Task 2: Use `query_story_data` queries instead of raw story file reading
- Result: ~10x token efficiency gain (16K+ lines → 500-1K tokens)
- Files: `skills/sequel-world/SKILL.md`

**See `story-comprehension-improvements-implemented.md` for complete implementation details, error diagnosis context, design notes, and review findings.**

---

## Proposal 2B: Story State Extraction (Foundation)

**Status**: ✅ FULLY IMPLEMENTED AND MERGED (PR #10)

**What**: Two MCP tools that parse story exports into structured JSON:
- `extract_story_data` — Parses story exports, writes manifest.json, metadata.json, turn_index.json, tracked_state.json
- `query_story_data` — Queries extracted data by category (manifest, metadata, turn_index, turn_detail, tracked_state)

**Design**: 4-phase deterministic parser. Zero dependencies, multi-file output, path traversal defenses.

**Token Impact**: ~10x reduction (16K+ lines of raw text → 500-1K tokens of structured JSON)

**Documentation**: See `skills/world-architect/references/story-extraction-tool.md`

**Note**: Defers narrative understanding (character descriptions, relationships, locations, events) to Proposal 2C agents.

---

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

## Remaining Proposals (3, 4, 5, 7, 8)

### Proposal 3: Safety Fallbacks (Manual Processing + Summary Validation)

**Status**: Optional (use only if 2B extraction tool unavailable or fails)

**What**: Structured manual processing protocol + summary validation step

**When**: Use if 2B extraction tool unavailable or fails on non-standard export

**How**:
- Divide story into ~40-60 turn segments
- Process each segment independently (extract characters, tracked items, events)
- Merge segment extractions with equal weighting (counters recency bias)
- Validate merged summary before using for field proposals

**Token impact**: Moderate increase (~100-200 tokens per segment + ~300-500 for validation)

**Plugin component**: command-development

---

### Proposal 4: Character Field Writing Guide (2B Integration)

**Status**: Ready to implement (after Integration Task 2)

**What**: Create reference doc + integrate into command to guide agent on synthesizing extraction data to field values.

**How**:
- Create `skills/world-architect/references/character_writing_guide.md`
- Guide teaches: Identity, Appearance (ONLY from story text via 2B's turn_detail), Relationships, Arc Progression (from tracked_state), Status Changes (from turn_detail)
- Integrate into sequel-world/spinoff-world command prompts as reference material
- Emphasis: Use 2B's extraction data as ground truth; only read raw story text for narrative understanding (descriptions, relationships, events)

**Dependencies**: Integration Task 2 (query_story_data available)

**Complexity**: Medium (reference doc + prompt integration)

**Expected token impact**: +200-300 tokens for guide; prevents fabrication errors across 5+ character fields per character. Net savings vs. current approach.

**Plugin component**: command-development

---

### Proposal 5: Source-First Field Proposal Protocol (2B Integration)

**Status**: ✅ FULLY IMPLEMENTED & MERGED (PR #23, commit a84e40a)

**What Was Implemented:**
- Added "Pre-Citation Validation" section to verify extraction data exists before citing
- Added "Field Proposal Citation Requirements" section with explicit citation patterns for metadata, turn_detail, turn_index, and tracked_state
- Added tracked_state citation example showing state evolution across turns
- Made gap-check rule explicit: "No extraction data = no proposal"
- Clarified Evidence tag usage as both internal reasoning and user-facing documentation
- Files Modified: `skills/sequel-world/SKILL.md`

**Key Design Points:**
- Citations require extraction_dir parameter: `query_story_data(extraction_dir, 'category', [optional_params])`
- Validation prevents agents from citing nonexistent data
- All 4 query sources covered with examples: metadata, turn_detail, turn_index, tracked_state
- Non-negotiable rule: No citation evidence = field not proposed

---

### Proposal 7: Story-to-Lorebook Output Strategy (2B Integration)

**Status**: Ready to implement (independent of integration tasks)

**What**: Create reference doc + guidance defining tier strategy for distributing extracted story state across field types.

**How**:
- Create `skills/world-architect/references/story_context_distribution.md`
- Define tiers: Always-on fields (background, instructions, objective from 2B) vs. Keyword blocks (character/location specific, populated from 2B's tracked_state and turn_detail) vs. Hidden tracked items vs. SecretInfo blobs
- Document how to use 2B's multi-file output to distribute context efficiently:
  - Always load: manifest.json (extraction metadata), metadata.json (story background/objective)
  - Load conditionally: turn_index.json (turn summaries), tracked_state.json (if present), character_index.json (if present)
  - Load selectively: turn_detail queries for deep narrative understanding of specific turns
- Add distribution guidance to sequel-world/spinoff-world command prompts

**Dependencies**: None (can be done independently; benefits from having 2B available)

**Complexity**: Low-Medium (reference doc + prompt integration)

**Expected token impact**: NET REDUCTION; moves context from always-on fields to keyword blocks (only injected on relevance). 2B's selective loading makes this efficient.

**Plugin component**: command-development

---

### Proposal 8: Pre-Generation Story Facts Review (2B Integration)

**Status**: Ready to implement (after Integration Task 1)

**What**: After extraction completes, agent assembles "Story Facts Brief" from 2B's extraction data. User reviews and corrects; agent writes verified_story_facts.md to persist corrections. Agent loads and references during field-by-field walkthrough.

**How**:
- Agent calls extract_story_data and waits for success
- Agent assembles brief from 2B's extraction data: query_story_data(category='metadata') for background/objective; query_story_data(category='turn_detail', turn_nums) for character appearances and key events
- Agent presents brief to user with requested corrections
- User corrects character appearances, personality, relationships, major events, current status, terminology
- Agent writes `verified_story_facts.md` file (agent-implemented file I/O; not a 2B feature) to extraction directory to persist corrections
- Agent loads and references this file throughout field-by-field walkthrough to ensure consistency

**Dependencies**: Integration Task 1 (extract_story_data called)

**Complexity**: Medium (orchestration + user interaction + file persistence)

**Expected token impact**: Upfront cost (~500-1500 tokens for review) + per-field savings (corrections prevent multi-field propagation). Break-even or positive ROI on medium/large stories.

**Plugin component**: command-development + user-interaction

---

## Prioritized Implementation Order

### Tier 1: Foundation (✅ COMPLETE)

| Priority | What | Status | Merged |
|----------|------|--------|--------|
| P1 | 2B Story Extraction Tool | ✅ DONE | PR #10 |
| P1a | Proposal 1: Anti-Fabrication Guard Rails | ✅ DONE | PR #22 (2026-03-31) |
| P1b | Integration Task 1: Call extract_story_data | ✅ DONE | PR #21 (2026-03-31) |
| P1c | Integration Task 2: Use query_story_data | ✅ DONE | PR #21 (2026-03-31) |

**All foundation tasks complete.** Core story comprehension improvements integrated into sequel-world and spinoff-world commands.

### Tier 2: Core Proposals (Next Priority)

| Priority | What | Status | Complexity | Deps |
|----------|------|--------|-----------|------|
| P2a | Proposal 4: Character Field Writing Guide | Ready | Medium | P1c |
| P2b | Proposal 5: Source-First Field Proposal Protocol | Ready | Low-Medium | P1c |
| P2c | Proposal 8: Pre-Generation Story Facts Review | Ready | Medium | P1b |

### Tier 3: Polish & Future

| Priority | What | Status | Complexity | Deps |
|----------|------|--------|-----------|------|
| P3a | Proposal 7: Story-to-Lorebook Output Strategy | Ready | Low-Medium | None |
| P3b | Proposal 3: Safety Fallbacks | Ready | Low | None |
| P3c | Proposal 2C: Agent-Based Narrative Extraction | Design | Medium | P1c |

### Implementation Dependencies

```
✅ COMPLETED: Tier 1 Foundation (P1, P1a, P1b, P1c)
   │
   ├─── READY: Tier 2 Proposals (P2a, P2b, P2c)
   │    ├─ P2a: Character Field Writing Guide (depends on P1c query tools)
   │    ├─ P2b: Source-First Field Citations (depends on P1c guardrails)
   │    └─ P2c: Story Facts Review (depends on P1b extraction)
   │
   └─── READY: Tier 3 Polish & Future (P3a, P3b, P3c)
        ├─ P3a: Lorebook Distribution (independent)
        ├─ P3b: Safety Fallbacks (independent)
        └─ P3c: Agent-Based Narrative Extraction (depends on P1c query tools)
```
