# Citation Methodology and Evidence Requirements

This guide establishes how to cite extraction data and ground field proposals in verified story content, preventing fabrication and hallucination.

## Pre-Citation Validation: Verify Extraction Data Exists

Before proposing field citations, verify that extraction data is available:

1. **Confirm extract_story_data succeeded** — If the tool returned success: false, don't proceed with citations. Instead, inform the user that story data extraction failed and offer to re-run extraction.

2. **Verify extraction directory contents** — The extraction_dir should contain manifest.json, metadata.json, and turn_index.json. Verify these exist and are readable before attempting any citations.

3. **Check for file-specific availability** — Before proposing a citation in a specific category, verify the required file exists:
   - For metadata citations: Verify metadata.json exists
   - For turn_detail citations: Verify turn_index.json AND the source story file exist
   - For tracked_state citations: Verify tracked_state.json exists AND manifest.json indicates has_tracked_items: true
   - If any required file is missing, mark that citation category as unavailable and skip proposing fields that depend on it.

4. **Check for corruption or incomplete data** — If a file exists but is not readable or appears corrupted (invalid JSON, empty, etc.), treat it as extraction failure and inform the user.

**Without validation, agents will cite fabricated or nonexistent data, defeating the guardrail entirely.**

## Field Proposal Citation Requirements

Every field proposal must be grounded in extraction data with explicit evidence citations. This prevents fabrication and anchors proposals to structured, verified story data.

### Citation Pattern

For each field proposal, follow this pattern:
1. **Cite the extraction data first** — before proposing a value, identify where it comes from.
2. **Format the citation clearly** — use one of these user-friendly citation templates:
   - `From Story Metadata [human-readable field name]: [direct extracted value]`
   - `From Turn #[turn_number] Outcome: [summary of fact]. Direct quote: [specific quote from turn outcome]`
   - `From Turn #[turn_number] Secret Info: [summary of fact]. Direct quote: [specific quote from secret info]`
   - `From Turn #[turn_number] Tracked Item [tracked item name]: [summary of fact]. Direct Citation: [item name]'s value was "[value]" on Turn #[turn_number]`
   - `From Turn #[turn_number] Tracked Item [tracked item name]: [summary of fact]. Direct Citation: [item name]'s value changed from "[previous value]" to "[current value]"`
3. **Precede every field proposal with "Evidence:" tag** — make it explicit and easy to review:
   ```
   **Evidence:** From Story Metadata [objective]: "rescue the missing diplomat"

   **Proposed Field Value:** This world's Objective should focus on the mission established in the story...
   ```

### When Extraction Data Is Available

Use specific extraction data directly with human-readable citations:
- **If metadata contains the field**: Cite it verbatim. Example: "From Story Metadata [objective]: 'stop the invasion'"
- **If turn details describe the field**: Cite specific turns with direct quotes from the narrative. Example:
  "From Turn #3 Outcome, the protagonist learns new navigation techniques. Direct quote: [direct quote of the relevant part of the turn's outcome description showing the protagonist learning new navigation techniques]
  From Turn #8 Outcome, the protagonist teaches them to the ally. Direct quote: [direct quote of the relevant part of the turn's outcome description showing the protagonist teaching the techniques to the ally]
  From Turn #14 Outcome, the protagonist applies the new navigation techniques. Direct quote: [direct quote of the relevant part of the turn's outcome description showing the protagonist using the skill]"
- **If tracked items define the field**: Cite the state evolution. Example: "From Turn #1 Tracked Item [trust_level]: The trust_level starts at 'Untrusted'. Direct Citation: trust_level's value was 'Untrusted' on Turn #1. From Turn #6 Tracked Item [trust_level]: The relationship changes. Direct Citation: trust_level's value changed from 'Untrusted' to 'Trusted'"

**Important Note on turn_detail**: turn_index provides only 100-character action/outcome PREVIEWS, not full narrative context. For thorough field checking, use turn_detail queries instead. When checking for presence/absence of details in a field (e.g., "Does the story describe the protagonist's backstory?"), query turn_detail for full narrative context rather than relying on turn_index previews alone.

### When Extraction Data Lacks the Field

If a field isn't covered in extraction data:

1. **Handle query failures first** — Before searching for missing data, verify extraction success:
   - If query_story_data returns success: false, stop and inform the user that extraction data is unavailable for this field.
   - If warnings are present (e.g., "Turn X not found in source file"), note them—the field may have incomplete evidence.
   - Do NOT cite data from queries that returned errors or warnings.

2. **Search related turn data with bounded scope** — query `query_story_data(extraction_dir, 'turn_detail', [turn_numbers])` for specific narrative evidence before proposing a value. For gap checking, start with a representative sample: first 5 turns, last 5 turns, and any explicitly story-pivotal turns identified from turn_index. If the field is still not found after sampling, it's reasonable to conclude it's not in the story without querying all turns.

3. **Cite the turn numbers examined** — even if the data is sparse, cite the exact turns you examined and their status. Example: "From Turn Detail turns [1, 2, 3, 4, 5]: These opening turns contain the only character descriptions in the story. No further mentions found in sampled closing turns."

4. **Mark gaps explicitly** — if no evidence supports the field, say so: "No evidence found in query_story_data results for this field—sampled turns 1-5 and 45-50 with no mentions."

## Examples of Correctly Cited vs Non-Cited Proposals

### GOOD - Extraction-Based Citation
```
**Evidence:** From Story Metadata [objective]: "find the hidden temple and retrieve the artifact."

**Proposed Field Value:** Objective = "Find the hidden temple and retrieve the artifact."
```

### GOOD - Turn-Specific Citation with Direct Quotes
```
**Evidence:**
From Turn #5 Outcome, the protagonist learns new navigation techniques. Direct quote: "The scout taught her how to read the stars for navigation."
From Turn #8 Outcome, the protagonist teaches them to the ally. Direct quote: "She explained the star-reading method to her companion."
From Turn #14 Outcome, the protagonist applies the new navigation techniques. Direct quote: "Using the navigation technique learned earlier, they found the hidden pass."

**Proposed Field Value:** Main Instructions should emphasize navigation and teamwork, as these became central mechanics.
```

For turn_detail citations, include direct quotes from the extracted text when possible. This prevents paraphrasing errors and anchors proposals to exact story language.

### GOOD - Gap Identification
```
**Evidence:** From Turn Detail sampled turns [1, 2, 3, 4, 5, 45, 46, 47, 48, 49]: No explicit descriptions of the protagonist's backstory or original motivations found. Turn outcomes show focus on present action rather than origin details.

**Proposed Field Value:** Background section should remain minimal, reflecting that the story focuses on present action rather than origin details. Left unfilled: Character's original motivations (not explicitly described in story).
```

Note: When checking for presence/absence of details, use turn_detail for full narrative context rather than turn_index previews, which are truncated to 100 characters.

### GOOD - Tracked Item State Evolution
```
**Evidence:**
From Turn #1 Tracked Item [Advanced Combat]: The skill starts locked. Direct Citation: Advanced Combat's value was 'Locked' on Turn #1.
From Turn #8 Tracked Item [Advanced Combat]: The skill becomes available. Direct Citation: Advanced Combat's value changed from 'Locked' to 'Unlocked'.

**Proposed Field Value:** Advanced Combat Skill: Locked by default, becomes available in turn 8 based on story progression.
```

Note: The tracked_state.json structure contains snapshots with `from_turn`/`to_turn` ranges and a `tracked_items` object mapping item names to their state values in that range.

### BAD - No Citation
```
**Proposed Field Value:** The character is a seasoned warrior with a troubled past and a secret family.
```
(Where is this from? Not in the story. This is fabrication.)

### BAD - Generic Citation
```
**Evidence:** I read the story and it seems like this character should have combat skills.

**Proposed Field Value:** Skills should include combat mastery.
```
(Vague. Did the story explicitly state this, or is this inference?)

### BAD - Assumption Over Evidence
```
**Evidence:** The character is a fighter, so they probably have years of training.

**Proposed Field Value:** Background: "Trained in the martial arts since childhood."
```
(The story doesn't say "since childhood." This is a genre stereotype being substituted for missing detail.)

### GOOD - Secret Info Citation
```
**Evidence:**
From Turn #7 Secret Info: The ally harbors a hidden shame from court politics. Direct quote: "The ally was once a trusted advisor who engineered the downfall of three minor nobles to protect the crown's secrets. Now haunted by the memory of innocent servants caught in the crossfire."

**Proposed Field Value:** Hidden Character Knowledge: "The protagonist discovers that their ally was once implicated in a court scandal that destroyed innocent lives. This hidden past drives the ally's obsessive loyalty to the current cause—a form of penance for past wrongs."

**Verification:** ✓ cited from story data ✓ no fabrication ✓ integrates with character arc
```

## Integration with Verification and Evidence

Before proposing each field, combine the accuracy guardrails with citation discipline:
- **Guardrail Check**: Is this detail explicitly stated in the story, or am I inferring/inventing?
- **Citation Check**: Can I cite extraction data (metadata, turn_detail, tracked_state) that supports this?
- **Gap Check**: If no citation exists, don't propose it. Instead, leave the field empty or explicitly mark it as "not described in story."

**No-Citation Rule (Non-Negotiable):** If extraction data doesn't cite a field value, don't propose it. Instead:
- Leave the field empty or uncertain in the draft
- Mark it as "Not described in story" in your notes
- If pressed by verification checklist, re-examine story text once more
- If still no evidence, do NOT invent the field value

This rule applies to ALL fields: appearance, personality, skills, relationships, status. No exceptions.

## Tool Enforcement: The `evidence` Parameter

The `update_draft_section` MCP tool natively enforces these rules via a required `evidence` parameter. Every time you write a section to the draft, you must provide one of the four accepted formats.

1. **Story Citation:** `From Turn #...`, `From Story Metadata...`, `From Turn Detail...`, or `From Turn #N Tracked Item...`
   - Use when populating fields derived from extraction data.
2. **User Directed:** `USER_DIRECTED: <paraphrase of instruction>`
   - Use when the author explicitly overrides story data or provides a custom value (e.g., "Make the title 'My Cool Sequel'").
3. **Carry Forward:** `CARRY_FORWARD: <reason>`
   - Use when importing data unchanged from the original world JSON (e.g., preserving player permissions).
4. **Gap Found:** `NO_STORY_EVIDENCE: sampled turns [list], nothing relevant found`
   - Use when a field is left empty or marked "not described" because no story data supported populating it. This fulfills the No-Citation Rule.

## Field Proposal Citation Formats

When proposing field values in conversation with the author, use these human-readable citation formats that match the tool requirements:
- **Story Metadata citations:** "From Story Metadata [field name]: [value]"
- **Turn Outcome citations:** "From Turn #[number] Outcome: [summary]"
- **Secret Info citations:** "From Turn #[number] Secret Info: [summary]"
- **Tracked Item citations:** "From Turn #[number] Tracked Item [name]: [summary]"

Do NOT reference MCP function syntax (query_story_data, extraction_dir) in field proposals. Use the human-readable citation formats above to document where evidence comes from. This keeps your field proposals grounded in structured, verified data and transparent to users.

## Evidence Tags During Field-by-Field Refinement

When proposing a field value during refinement, include the Evidence tag in your reasoning:

Example user-facing proposal:
- **Field:** Character Appearance
- **Proposed Value:** [description]
- **Evidence:** From Turn #3 Outcome, Alice's appearance is described. Direct quote: "Alice appears wearing..."
- **Verification:** ✓ cited from story text ✓ no fabrication ✓ gap-checked

The Evidence tag helps users and reviewers see exactly where your proposal came from. It's both internal reasoning (for agent verification) and external documentation (for user transparency).
