# Story Comprehension Improvements — Implementation Complete

**Date**: 2026-04-05
**Status**: Proposal 2B, Proposal 1, Integration Tasks 1 & 2, Proposal 5, and Proposal 7 fully implemented and merged to master

---

## Summary of Completed Work

This document archives the implementation details for completed proposals from the story-comprehension-improvements roadmap. See the main roadmap document for remaining proposals and overall context.

**Completed:**
- ✅ Proposal 2B: Story State Extraction (Foundation) (PR #10)
- ✅ Proposal 1: Anti-Fabrication Guard Rails (PR #22)
- ✅ Integration Task 1: Call extract_story_data (PR #21)
- ✅ Integration Task 2: Use query_story_data (PR #21)
- ✅ Proposal 5: Source-First Field Proposal Protocol (PR #23)
- ✅ Proposal 7: Story Context Distribution Strategy (PR #35)

---

## Error Diagnosis Summary (Context)

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

## Proposal 1: Anti-Fabrication Guard Rails (✅ IMPLEMENTED)

**Status**: ✅ FULLY IMPLEMENTED AND MERGED (PR #22, 2026-03-31)

**What Was Implemented**

Added "Story Accuracy Requirements" section to sequel-world and spinoff-world command prompts with 7 explicit guardrails:

1. **ONLY include details explicitly stated in story text** - Source proposals directly from story export, use exact language from story where possible
2. **NEVER substitute genre stereotypes for missing details** - Leave field empty/uncertain rather than inventing typical descriptions
3. **NEVER invent proper nouns, named abilities, or coined terminology** - Do not create official-sounding names; use story's own language
4. **Distinguish literal statements from sarcasm, jokes, and figurative language** - Alert to tone in dialogue; don't take self-deprecating humor as character truth
5. **Do NOT sanitize morally complex events** - Represent manipulation, betrayal, coercion, exploitation accurately; preserve dark elements
6. **For appearance fields, prefer copying the story's own descriptions verbatim** - Use exact story descriptions rather than paraphrasing
7. **For tracked items, preserve exact state and descriptions from story** - Extract tracked item values/motivations/secret projects only from explicit story content; don't invent hidden motivations

**How It Works**

- Guardrails placed BEFORE field-by-field walkthrough in sequel-world and spinoff-world commands
- Field-level verification checklist added before field proposals ensure agents actively reference guardrails during refinement
- Spinoff-world version adapted to reflect different inputs (original world JSON + user concept, not story exports)

**Files Modified**

- `skills/sequel-world/SKILL.md` - Added guardrails section + field-level verification checklist
- `skills/spinoff-world/SKILL.md` - Added adapted guardrails section

**Implementation Details**

- Addresses all 6 major error categories from diagnosis: detail fabrication, hallucination, stereotyping, sanitization, tone blindness, character flattening
- Adds 7th guardrail for tracked items (4 documented errors in "Secret Information" field)
- Token impact: +150 tokens in command prompts; very high ROI through error reduction
- Review findings: No bugs; 3 minor enhancements made during revision process

**PR Details**

- Branch: `feature/proposal-1-guardrails`
- PR #22: 2 commits (initial + revisions)
- Conflict resolution: Merged with PR #21 changes successfully
- Final commit: Merge pull request #22

---

## Integration Roadmap: Using 2B in Sequel-World and Spinoff-World (✅ COMPLETED)

**Status**: Both integration tasks ✅ FULLY IMPLEMENTED AND MERGED (PR #21, 2026-03-31)

### Integration Task 1: Call extract_story_data from sequel-world command (✅ IMPLEMENTED)

**What Was Implemented**

When user provides story export file(s), the sequel-world command automatically calls extract_story_data to populate extraction directory.

**How It Works**

1. User provides path to story export file(s) after path confirmation
2. Agent calls `extract_story_data` MCP tool with file paths and extraction directory
3. Tool returns success/failure status with output files created (manifest.json, metadata.json, turn_index.json, tracked_state.json)
4. If extraction fails, agent gracefully falls back to manual story processing
5. Extraction directory persists for subsequent query_story_data calls in field-by-field walkthrough

**Token Impact**

- One-time extraction cost: ~100 tokens
- Subsequent queries via query_story_data: Much more efficient than re-reading raw files

**Implementation Details**

- Extraction directory creation and management clarified (ensure directory exists or use absolute path)
- Success/failure handling explicit with fallback instructions
- No changes needed to index.js (tools already exist from PR #10)

### Integration Task 2: Use query_story_data during field-by-field walkthrough (✅ IMPLEMENTED)

**What Was Implemented**

Modified sequel-world command to load extraction data via query_story_data calls rather than having agent read raw story text (16,000+ lines → 500-1K tokens).

**Query Pattern Established**

1. `query_story_data(extraction_dir, 'metadata')` - For story background/objective fields
2. `query_story_data(extraction_dir, 'turn_index')` - For turn summaries and story arc overview
3. `query_story_data(extraction_dir, 'turn_detail', [N, ...])` - For narrative deep-dives on specific turns
4. `query_story_data(extraction_dir, 'tracked_state')` - For tracked item state history
5. `query_story_data(extraction_dir, 'manifest')` - Optional, for extraction diagnostics

**Token Efficiency Gain**

**MAJOR REDUCTION**: ~10x reduction in token usage
- Before: Load 16K+ lines of raw story text into context
- After: Load 500-1K tokens of structured JSON via query tools
- Tracked items loaded selectively (check manifest's `has_tracked_items` flag first)

**Files Modified**

- `skills/sequel-world/SKILL.md` - Added Integration Task 1 & 2 instructions, reference guide for field proposals

**Implementation Details**

- Logical flow: extract story → query metadata → query turns → field-by-field walkthrough
- Story Accuracy Requirements (Proposal 1) integrated before field work begins
- Field-level verification checklist ensures guardrails actively enforced
- Fallback behavior documented for extraction failures
- Reference guide ties field types to appropriate query sources

**PR Details**

- Branch: `feature/integration-tasks-1-2` (originally worktree-integration-tasks)
- PR #21: Initial implementation + 1 commit with review suggestions applied
- Review findings: ZERO bugs, ZERO false assumptions; 3 non-blocking improvements applied
- Final verdict: READY TO MERGE; no issues found
- Merged: 2026-03-31

---

## Known Limitations and Design Notes

### What 2B Extracts (Foundation for Integration Tasks)

✅ Story background, player character sheet (name, background, skills), objective  
✅ Tracked item histories with change detection (only turns where value changes)  
✅ Hidden tracked items with full history  
✅ Character mention counts seeded from world NPC names (simple string matching)  
✅ Per-turn section text accessible via query_story_data(category='turn_detail')

### What 2B Defers to 2C (Remaining work)

❌ Character descriptions, aliases, lastKnownLocation (require narrative understanding)  
❌ Relationships (embedded in narrative, not structured in exports)  
❌ Locations (no whereWhen field exists in tested exports)  
❌ Events/plot milestones with descriptions (require semantic judgment)  
❌ Story arc summaries (opening/final summaries, unresolved threads)  

Note: Proposal 4 & 8 address some gaps with reference guides and user review steps; Proposal 2C (Agent-Based Narrative Extraction) would fully automate narrative field extraction.

### Design Choices

1. **Guardrails are active, not passive**: Field-level verification checklist ensures agents reference guardrails during refinement, not just at the start
2. **Integration Tasks + Proposal 1 are complementary**: Extraction (2B) provides data ground truth; guardrails (P1) ensure agents use it correctly
3. **Spinoff-world customization**: Anti-fabrication guardrails adapted to reflect different inputs (original world + user concept vs. story export)
4. **Query tools prevent re-reading**: Instead of agents re-reading raw exports multiple times, structured queries isolate relevant data
5. **Error diagnosis directly addressed**:
   - Detail fabrication (31%) → Proposal 1 guardrail 1 + Integration Task 2 (use queries instead of raw text)
   - Hallucination (21%) → Proposal 1 guardrail 3 (no invented proper nouns)
   - Stereotyping (10%) → Proposal 1 guardrail 2 (no genre defaults)
   - Sanitization (14%) → Proposal 1 guardrail 5 (preserve dark elements)
   - Tone blindness → Proposal 1 guardrail 4 (distinguish literal vs figurative)
   - Character flattening → Proposal 1 guardrail 6 (verbatim descriptions)
   - Secret info fabrication → Proposal 1 guardrail 7 (tracked items + secret info accuracy)

---

## Adversarial Review Notes

### Bugs Found and Fixed

**PR #22 Revisions (3 minor fixes applied):**
1. Spinoff-world phrasing: Removed reference to non-existent "story materials" input
2. Tracked items guardrail: Added 7th guardrail addressing 4 documented errors in secret information field
3. Field-level enforcement: Added verification checklist before field-by-field walkthrough to prevent drift

**PR #21 Review (0 bugs found):**
- All MCP tool calls syntactically correct
- Error handling properly implemented with explicit fallback
- All edge cases addressed
- Spec compliance: Integration Task 1 & 2 FULLY COMPLIANT

### False Assumptions Eliminated

- ❌ Agents will remember guardrails throughout field work → ✅ Added active field-level verification checklist
- ❌ Spinoff uses story materials as input → ✅ Corrected guardrails to reflect original world only
- ❌ Tracked items don't need special guardrails → ✅ Added 7th guardrail addressing tracked items fabrication

### Quality Assessment

Both PRs received high marks from independent review:
- **PR #21**: READY FOR MERGE (no blocking issues; 3 non-blocking improvements applied)
- **PR #22**: NEEDS MINOR REVISION → Applied revisions → READY FOR MERGE

---

## Proposal 8 Status Update (2026-03-31)

**PR #24 Closed**: Proposal 8 implementation attempt shelved pending Proposal 2C completion.

**Reason**: PR #24 review (8 detailed comments) revealed critical design gaps that cannot be resolved without Proposal 2C (Agent-Based Narrative Extraction) foundation:

1. **File I/O pattern misalignment** - Atomic write pattern not specified; plugin standard vs. agent responsibility unclear
2. **Parameter type ambiguity** - query_story_data turn parameter (string vs. numeric) inconsistency in Step 1
3. **Markdown parsing strategy undefined** - No standardized format for "Resolved Facts" extraction from user-provided markdown
4. **Unimplementable timeout logic** - Step 2B timeout handling impossible for agents (no background timers)
5. **Context overflow risk** - Turn detail queries for 5+ turns on large stories could exceed budget
6. **Redundant verification** - extract_story_data filesWritten response makes re-verification unnecessary
7. **Redundant sections** - Story Accuracy Requirements duplicated existing guidance
8. **Unmapped narrative data** - Key Locations field extracted but no world JSON destination

**Revised Plan**: Proposal 8 becomes viable as **narrative review gate** once Proposal 2C provides:
- Structured narrative data (`narrative/` directory with characters, relationships, locations, events)
- Standardized extraction format (eliminating parsing ambiguity)
- Selective context loading (avoiding overflow risks)

**Current Dependency Chain**:
```
✅ P1, P1b, P1c, P2b, P2b Integration + P5 complete
   ↓
→ P2c (Agent-Based Narrative Extraction) — design phase, next priority
   ↓
→ P8 (Pre-Generation Story Facts Review) — blocked until P2c foundation exists
```

---

## Next Steps: Remaining Proposals

See `story-comprehension-improvements.md` for:
- Proposal 2C: Agent-Based Narrative Extraction (HIGH PRIORITY - blocks Proposal 8)
- Proposal 3: Safety Fallbacks
- Proposal 4: Character Field Writing Guide
- Proposal 7: Story-to-Lorebook Output Strategy
- Proposal 8: Pre-Generation Story Facts Review (BLOCKED on P2c)

Priority order and dependencies documented in main roadmap.

---

## Proposal 5: Source-First Field Proposal Protocol (✅ IMPLEMENTED)

**Status**: ✅ FULLY IMPLEMENTED AND MERGED (PR #23, commit a84e40a)

**What Was Implemented**

Added comprehensive citation requirements to the sequel-world command to ground all field proposals in extraction data evidence.

**How It Works**

1. **Pre-Citation Validation** — Verify extraction_dir exists and contains required files (manifest.json, metadata.json, turn_index.json) before allowing citations
2. **Citation Pattern** — Every field proposal must include: `Evidence: From query_story_data(extraction_dir, 'category', [params]): [supporting text]`
3. **Four Citation Sources**:
   - `metadata` — For story background and objective
   - `turn_detail` — For character descriptions and turn-specific details
   - `turn_index` — For story arc and turn summaries
   - `tracked_state` — For tracked item state evolution
4. **Gap-Check Rule** — Non-negotiable: No extraction evidence = no field proposal
5. **Evidence Tag Integration** — Evidence appears in both internal reasoning and user-facing draft for transparency

**Files Modified**

- `skills/sequel-world/SKILL.md` — Added 200+ lines:
  - Pre-Citation Validation section
  - Field Proposal Citation Requirements section (with 4 citation templates and examples)
  - Gap-Check Rule (explicit, non-negotiable)
  - Integration with Field-Level Verification Checklist

**Design Choices**

1. **Validation is active, not passive**: Agents must verify extraction data before citing it
2. **Citations are precise**: Every example shows exact query signature with extraction_dir parameter
3. **Gap handling is explicit**: Agents cannot propose without evidence; must mark gaps
4. **Evidence is transparent**: User can see exactly which story turn supports each field

**Implementation Complexity**

- Added ~200 lines of documentation
- No MCP tool changes needed
- Uses existing query_story_data and extract_story_data tools
- No code changes; pure documentation/guidance

**PR Details**

- Branch: `feature/proposal-5-source-first-citations`
- Initial implementation: Commits dfd789c, 3614825 (review fixes), a84e40a (API fix)
- Review findings: 1 CRITICAL + 4 HIGH issues fixed before merge
- Final assessment: READY TO MERGE

**Token Impact**

- Upfront cost: +50-100 tokens per field for citation evidence
- Net savings: Because citations reference structured data, not raw story re-reading
- Break-even on medium stories, savings on large stories

**Next Phase**

Proposal 5 enables Proposal 2C (Agent-Based Narrative Extraction) by establishing the citation pattern that narrative agents should follow. Also complements Proposal 4 (Character Field Writing Guide) by providing the source-first discipline.

---

## Proposal 7: Story Context Distribution Strategy (✅ IMPLEMENTED)

**Status**: ✅ FULLY IMPLEMENTED AND MERGED (PR #35, commit 3a48f58)

**What Was Implemented**

Added a comprehensive reference document defining a tier-based strategy for distributing extracted story state (from 2B) efficiently across the various world fields.

**How It Works**

Created the `story_context_distribution.md` reference guide that establishes 6 structured tiers for context distribution logic:
1. **Tier 1**: Always-On (Metadata & Objectives)
2. **Tier 2**: Dynamic Narrative (Tracked Items via `tracked_state`)
3. **Tier 3**: Conditional Lore (Important characters and locations)
4. **Tier 4**: Pure Lore (Secondary details)
5. **Tier 5**: Ephemeral (Turn summaries not strictly required moving forward)
6. **Tier 6**: Mechanics & Instructions (Event and condition triggers)

It includes specific mappings connecting extracted JSON schemas from `2B` directly to sequel-play world templates, and established new anti-patterns (e.g., stopping agents from cramming lore into instructions or background logic fields).

**Files Modified**

- `skills/world-architect/references/story_context_distribution.md` — Core reference document (New).
- `skills/sequel-world/SKILL.md` (and spinoffs) — Updated prompts to refer to this distribution strategy if relevant context blocks need to be formulated.

**Design Choices**

1. **Strategic Placement**: Avoids stuffing everything into `instructions` or `background`. Instead, uses flexible "keyword blocks" or targeted states where applicable.
2. **Selective Execution**: Guides agents to stop reading `turn_index` previews for context, forcing reliance on the highly targeted `tracked_state` snapshot data.
3. **Cost Savings**: Significant reduction in generated token context during sequels by ensuring 2B data is only requested and stored organically where it belongs.
