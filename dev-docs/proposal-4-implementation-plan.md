# Proposal 4 (Character Field Writing Guide) Implementation Plan

**Status: Implemented in PR #37** (branch `feature/sequel-tracked-items-starting-values`, merged 2026-04-06)

## Objective
Implement Proposal 4 to create a cost-conscious, "just-in-time" narrative extraction process for character fields. Instead of executing an expensive blanket extraction of all characters across the entire story (Proposal 2C), this implementation will instruct the agent to leverage deterministic 2B extraction data to query narrative details only when necessary and specifically for the characters being processed.

## Scope of Work

The implementing agent must perform three primary tasks:

1. **Expose `character_index` to the MCP Tool Interface** (Code Change)
2. **Create the Character Writing Guide Reference Document** (Documentation)
3. **Integrate the Guide into the Core Commands** (Prompt Update)

---

### Step 1: Expose `character_index` to the MCP Tool

**Critical Context:** The 2B extraction already generates `character_index.json`, but currently, `query_story_data` does not allow querying it. The agent cannot follow the cost-conscious strategy without it.

**Required Changes:**
- Update `lib/validation.js` to add `'character_index'` to `VALID_CATEGORIES`.
- Update `lib/handlers/query.js` `queryStoryData` function to handle the `character_index` case. It should read `character_index.json` from the extraction directory and return its parsed data. Catch `ENOENT` and return a clean failure/warning if the index isn't present in legacy extractions.
- Update `lib/tools.js` to add `character_index` to the enum list of accepted categories for the `query_story_data` tool definition.

---

### Step 2: Create `skills/world-architect/references/character_writing_guide.md`

Create a new reference document that teaches the agent how to populate character-related fields efficiently. 

The guide MUST emphasize the following cost-conscious workflow:
- **Identification:** Start with 2B's `query_story_data(..., 'character_index')` to see precisely which turns the character appears in the story.
- **State History:** Consult `tracked_state.json` to extract any mechanical changes, objective shifts, or secret information tied to that character.
- **Selective Narrative Extraction (turn_detail):** DO NOT query every turn where the character is mentioned. Agents must pinpoint the *first occurrence* (for physical description and introduction) and *key pivotal turns* (where `tracked_state` shows major status shifts). Use `query_story_data(extraction_dir, 'turn_detail', [T1, T2])` to extract deep narrative text (relationships, appearance, tone) ONLY from these high-signal turns.

**Content Sections Required in the Guide:**
1. **Cost-Conscious Extraction Policy:** Explain the selective `turn_detail` parsing rule to minimize token usage.
2. **Identity & Appearance:** Must only be derived from actual story text via `turn_detail`. Do not hallucinate or use genre-stereotypes (referencing Proposal 1 guardrails).
3. **Relationships & Factions:** Track how these evolve by reading targeted sections in `turn_detail` where major interactions occur.
4. **Arc Progression & Status:** Rely entirely on `tracked_state` for quantitative/mechanical progression, supplemented by targeted `turn_detail` reads to translate data changes into narrative rationale.

---

### Step 3: Integrate into Core Commands

Update the primary templates to ensure agents read and follow the new guide.

**Target Files:**
- `skills/sequel-world/SKILL.md`
- `skills/spinoff-world/SKILL.md`

**Required Changes:**
- In the "Field-by-Field Walkthrough" instructions or the "Reference Material" section, add explicit instructions to read `skills/world-architect/references/character_writing_guide.md` before generating the `possibleCharacters` or `NPCs` sections.
- Remind the agent that this guide establishes the required "just-in-time" extraction method and acts as a firewall against token-expensive over-querying.

---

## Verification Plan

To verify implementation, the agent should:
1. Run `npm test` to ensure that adding `character_index` to the query module does not break existing `query_story_data` validation tests.
2. Ensure the `character_index` query correctly fetches data or returns a graceful error when the file doesn't exist.
3. Observe an agent's query pattern in a real test: It should query the `character_index` and `tracked_state` first, and then explicitly use `query_story_data(..., 'turn_detail', [...])` with a very small, selective list of turn numbers when writing character profiles.
4. Validate that character descriptions still adhere to Proposal 1 guardrails (no fabricated appearances).
