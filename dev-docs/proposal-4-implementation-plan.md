# Proposal 4 (Character Field Writing Guide) Implementation Plan

## Objective
Implement Proposal 4 to create a cost-conscious, "just-in-time" narrative extraction process for character fields. Instead of executing an expensive blanket extraction of all characters across the entire story (Proposal 2C), this implementation will instruct the agent to leverage deterministic 2B extraction data to query narrative details only when necessary and specifically for the characters being processed.

## Scope of Work

The implementing agent must perform two primary tasks:

1. **Create the Character Writing Guide Reference Document**
2. **Integrate the Guide into the Core Commands**

---

### Step 1: Create `skills/world-architect/references/character_writing_guide.md`

Create a new reference document that teaches the agent how to populate character-related fields efficiently. 

The guide MUST emphasize the following cost-conscious workflow:
- **Identification:** Start with 2B's `character_index.json` to see where the character appears in the story.
- **State History:** Consult `tracked_state.json` to extract any mechanical changes, objective shifts, or secret information tied to that character.
- **Selective Narrative Extraction (turn_detail):** DO NOT query every turn where the character is mentioned. Agents must pinpoint the *first occurrence* (for physical description and introduction) and *key pivotal turns* (where `tracked_state` shows major status shifts). Use `query_story_data(extraction_dir, 'turn_detail', [T1, T2])` to extract deep narrative text (relationships, appearance, tone) ONLY from these high-signal turns.

**Content Sections Required in the Guide:**
1. **Cost-Conscious Extraction Policy:** Explain the selective `turn_detail` parsing rule to minimize token usage.
2. **Identity & Appearance:** Must only be derived from actual story text via `turn_detail`. Do not hallucinate or use genre-stereotypes (referencing Proposal 1 guardrails).
3. **Relationships & Factions:** Track how these evolve by reading targeted sections in `turn_detail` where major interactions occur.
4. **Arc Progression & Status:** Rely entirely on `tracked_state` for quantitative/mechanical progression, supplemented by targeted `turn_detail` reads to translate data changes into narrative rationale.

---

### Step 2: Integrate into Core Commands

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
1. Run a test case using the `sequel-world` command on a medium-sized test export.
2. Observe the agent's query pattern: It should query the metadata and tracked_state first, and then explicitly use `query_story_data(..., 'turn_detail', [...])` with a very small, selective list of turn numbers when writing character profiles.
3. Validate that character descriptions still adhere to Proposal 1 guardrails (no fabricated appearances).
