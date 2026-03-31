---
name: sequel-world
description: "Create a sequel world from an existing story export and world JSON. Trigger phrases: 'Create a sequel world based on a story that was played', 'Build a new world informed by what happened in a story export', 'I want a sequel world that continues from a story I played', 'Create a new world that picks up after this story ended', 'Use a story export to inform a sequel world'."
---

I want to create a sequel world from an existing story export.

Before we begin, ask me for:
1. The path to the story export file (or files).
2. The path to the original world JSON file (if available).
3. Whether I want to create a new directory for the new sequel world, or use an existing one (and the path).
4. What I want to name the final sequel world JSON file (e.g. `world.json`, `my_world.json`). Wait for my response.

**Path Confirmation**: For any file or directory path provided, use the `confirm_path` MCP tool to resolve and confirm the absolute path with the user before proceeding.

Once all paths and names are confirmed:

Extract Story Data
Call the `extract_story_data` MCP tool to parse the story export(s) into structured JSON. This replaces manually reading the entire raw file and prevents hallucination from working with thousands of lines of unstructured text.
- Specify an extraction directory (e.g., `extracted_story/` relative to your output directory). Ensure the extraction directory exists before calling the tool, or use an absolute path.
- The tool will return success/failure status and create output files (manifest.json, metadata.json, turn_index.json, tracked_state.json)
- If extraction succeeds, continue with Task 2. If it fails, warn the user and fall back to reading the raw export file directly.

Understand Story Context via Query Tools
Instead of reading the entire export file, use `query_story_data` to load structured extraction data:
1. Call `query_story_data(extraction_dir, 'metadata')` to load story background, character details, and objective. This gives you the high-level context.
2. Call `query_story_data(extraction_dir, 'turn_index')` to see a summary of all turns with action/outcome previews. Use this to understand turn distribution and identify key turning points.
3. For specific narrative deep-dives, call `query_story_data(extraction_dir, 'turn_detail', [N, ...])` passing the turn numbers you want to examine. This loads the full context/action/result text for those specific turns without loading the entire export.
4. If tracked items were found, call `query_story_data(extraction_dir, 'tracked_state')` to load the state history of tracked items across the story. (Optimization: Before querying tracked_state, check the manifest's `trackedItemsFound` flag. If false, skip the tracked_state query entirely.)

These queries give you structured data with far better context efficiency than reading raw story text.

Check if a `draft_world.md` file already exists in the target directory. If it does, ask me if I want to overwrite it or write to a new file name. If I say a new file name, prompt me for it.

Once settled, use the `decompile_json` MCP tool to read the original world JSON file and generate the draft markdown file at the chosen path.

Update the newly generated draft markdown file (using the `update_draft_section` tool) to combine the original world's settings with the rich narrative background derived from the story extraction. The markdown file contains the headers:
# Title
# Description
# Background
# First Action
# Objective
# Main Instructions
# Author Style
# NSFW
# Content Warnings
# Description Request
# Summary Request
# Image Model
# Image Style
# Image Style Character Pre
# Image Style Character Post
# Image Style Non Character Pre
# Image Style Non Character Post
# Victory Condition
# Victory Text
# Defeat Condition
# Defeat Text
# Design Notes
# Player Permissions
# Enable AI Specific Instruction Blocks
# Skills
# Possible Characters
# Other Characters
# Extra Instruction Blocks
# Keyword Instruction Blocks
# Tracked Items
# Trigger Events

## Story Accuracy Requirements

Before proceeding with field-by-field refinement, establish these non-negotiable accuracy guardrails:

**ONLY include details explicitly stated in story text.** When updating any field—character appearances, relationships, abilities, motivations, terminology, or events—source your proposals directly from the story export (via `query_story_data` results). Use the exact language from the story where possible.

**NEVER substitute genre stereotypes for missing details.** If a character's appearance isn't described, do not invent "typical" descriptions based on their role or background. Leave the field empty, uncertain, or explicitly note "appearance not described in story."

**NEVER invent proper nouns, named abilities, or coined terminology.** Do not create official-sounding ability names, secret project titles, or world-specific terms that don't appear in the story text. If the story mentions a concept without naming it, use the story's own language rather than creating a name.

**Distinguish literal statements from sarcasm, jokes, and figurative language.** When parsing character dialogue and narration, be alert to tone. A character's sarcastic comment about their abilities is not a literal statement of fact. Self-deprecating humor should not be taken as character truth.

**Do NOT sanitize morally complex events.** If the story contains manipulation, betrayal, coercion, exploitation, or other dark elements, represent them accurately in the world description. Do not soften language or omit uncomfortable truths in an attempt to make the world more "wholesome." When citing dark content, preserve the story's tone in your field proposal while using the Evidence tag to document the extraction data source. This allows transparent tracking of where dark content originates (the story itself, not agent invention).

**For appearance fields, prefer copying the story's own descriptions verbatim.** When the story explicitly describes how a character looks, dresses, or moves, use those exact descriptions rather than paraphrasing or embellishing them.

**For tracked items, preserve the exact state and descriptions from the story.** When extracting tracked item values, character motivations, secret projects, or hidden information, use only what appears explicitly in the story export. Do not invent "secret projects" a character might be working on, fabricate hidden motivations, or create mysterious "hidden tracked item" entries. If the story doesn't describe an item's state or a character's secret, leave it empty or mark it as "not described in story."

## Pre-Citation Validation: Verify Extraction Data Exists

Before proposing field citations, verify that extraction data is available:

1. **Confirm extract_story_data succeeded** — If the tool returned success: false, don't proceed with citations. Instead, inform the user that story data extraction failed and offer to re-run extraction.

2. **Verify extraction directory contents** — The extraction_dir should contain manifest.json, metadata.json, and turn_index.json. Verify these exist and are readable before attempting any citations.

3. **Check for file-specific availability** — Before proposing a citation in a specific category, verify the required file exists:
   - For metadata citations: Verify metadata.json exists
   - For turn_detail citations: Verify turn_index.json AND the source story file exist
   - For tracked_state citations: Verify tracked_state.json exists AND manifest.json indicates trackedItemsFound: true
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

### Examples of Correctly Cited vs Non-Cited Proposals

**GOOD - Extraction-Based Citation:**
```
**Evidence:** From Story Metadata [objective]: "find the hidden temple and retrieve the artifact."

**Proposed Field Value:** Objective = "Find the hidden temple and retrieve the artifact."
```

**GOOD - Turn-Specific Citation with Direct Quotes:**
```
**Evidence:** 
From Turn #5 Outcome, the protagonist learns new navigation techniques. Direct quote: "The scout taught her how to read the stars for navigation."
From Turn #8 Outcome, the protagonist teaches them to the ally. Direct quote: "She explained the star-reading method to her companion."
From Turn #14 Outcome, the protagonist applies the new navigation techniques. Direct quote: "Using the navigation technique learned earlier, they found the hidden pass."

**Proposed Field Value:** Main Instructions should emphasize navigation and teamwork, as these became central mechanics.
```

For turn_detail citations, include direct quotes from the extracted text when possible. This prevents paraphrasing errors and anchors proposals to exact story language.

**GOOD - Gap Identification:**
```
**Evidence:** From Turn Detail sampled turns [1, 2, 3, 4, 5, 45, 46, 47, 48, 49]: No explicit descriptions of the protagonist's backstory or original motivations found. Turn outcomes show focus on present action rather than origin details.

**Proposed Field Value:** Background section should remain minimal, reflecting that the story focuses on present action rather than origin details. Left unfilled: Character's original motivations (not explicitly described in story).
```

Note: When checking for presence/absence of details, use turn_detail for full narrative context rather than turn_index previews, which are truncated to 100 characters.

**GOOD - Tracked Item State Evolution:**
```
**Evidence:** 
From Turn #1 Tracked Item [Advanced Combat]: The skill starts locked. Direct Citation: Advanced Combat's value was 'Locked' on Turn #1.
From Turn #8 Tracked Item [Advanced Combat]: The skill becomes available. Direct Citation: Advanced Combat's value changed from 'Locked' to 'Unlocked'.

**Proposed Field Value:** Advanced Combat Skill: Locked by default, becomes available in turn 8 based on story progression.
```

Note: The tracked_state.json structure contains snapshots with `from_turn`/`to_turn` ranges and a `tracked_items` object mapping item names to their state values in that range.

**BAD - No Citation:**
```
**Proposed Field Value:** The character is a seasoned warrior with a troubled past and a secret family.
```
(Where is this from? Not in the story. This is fabrication.)

**BAD - Generic Citation:**
```
**Evidence:** I read the story and it seems like this character should have combat skills.

**Proposed Field Value:** Skills should include combat mastery.
```
(Vague. Did the story explicitly state this, or is this inference?)

**BAD - Assumption Over Evidence:**
```
**Evidence:** The character is a fighter, so they probably have years of training.

**Proposed Field Value:** Background: "Trained in the martial arts since childhood."
```
(The story doesn't say "since childhood." This is a genre stereotype being substituted for missing detail.)

**GOOD - Secret Info Citation:**
```
**Evidence:**
From Turn #7 Secret Info: The ally harbors a hidden shame from court politics. Direct quote: "The ally was once a trusted advisor who engineered the downfall of three minor nobles to protect the crown's secrets. Now haunted by the memory of innocent servants caught in the crossfire."

**Proposed Field Value:** Hidden Character Knowledge: "The protagonist discovers that their ally was once implicated in a court scandal that destroyed innocent lives. This hidden past drives the ally's obsessive loyalty to the current cause—a form of penance for past wrongs."

**Verification:** ✓ cited from story data ✓ no fabrication ✓ integrates with character arc
```

### Integration with the Verification Checklist

Before proposing each field, combine the Story Accuracy Requirements guardrails with citation discipline:
- **Guardrail Check**: Is this detail explicitly stated in the story, or am I inferring/inventing?
- **Citation Check**: Can I cite extraction data (metadata, turn_detail, tracked_state) that supports this?
- **Gap Check**: If no citation exists, don't propose it. Instead, leave the field empty or explicitly mark it as "not described in story."

**No-Citation Rule (Non-Negotiable):** If extraction data doesn't cite a field value, don't propose it. Instead:
- Leave the field empty or uncertain in the draft
- Mark it as "Not described in story" in your notes
- If pressed by verification checklist, re-examine story text once more
- If still no evidence, do NOT invent the field value

This rule applies to ALL fields: appearance, personality, skills, relationships, status. No exceptions.

## Field-Level Verification Checklist

Before proposing any field value, verify:
- Is this detail explicitly stated in the story, or am I inferring/inventing?
- Am I substituting a genre stereotype for missing information?
- Am I inventing proper nouns, ability names, or terminology not in the story?
- Does my proposal accurately reflect the tone (literal vs sarcasm)?
- Am I softening dark/complex elements that should be preserved?
- **Can I cite this from extraction data?** (metadata, turn_detail, turn_index, or tracked_state)
- **If no citation exists, should I propose this field at all?**

**Decision Rules for Empty or Missing Fields:**
- **If a field is empty in the original world AND no extraction data explicitly defines its value**: Leave the field empty in the sequel world. Do NOT invent character definitions, abilities, properties, or background details not present in the story.
- **If the story mentions a concept but doesn't name it**: Use the story's own language rather than creating an official-sounding name for the concept.
- **If extraction data is missing or incomplete for a field**: Mark the field as "not described in story" rather than attempting to fill it with inference or stereotype.
- **For dark/complex content found in extraction data**: Preserve the story's tone in your field proposal even if the content is disturbing or morally complex. The Evidence tag documents the raw data; the proposal reflects story-accurate tone.

Refer back to the Story Accuracy Requirements and Field Proposal Citation Requirements sections above if you're uncertain about any field proposal.

Then, guide me strictly FIELD-BY-FIELD through refining this draft.
**Optional Diagnostic Insight**: If you need to understand the extraction metadata (source files processed, total turns extracted, tracked items flags, deduplication notes), optionally query `query_story_data(extraction_dir, 'manifest')` to get extraction diagnostics without reading raw files. This helps ground your understanding of what the extraction discovered.

Start with the Title. Present the proposed data for that field (incorporating developments from the story from your extracted data) and ask me how I'd like to modify it. Once I answer, update the markdown file using `update_draft_section`, and wait for my approval before moving to the next field. Do not group fields together unless I explicitly ask you to.

For complex fields (like Skills, Possible Characters, Other Characters, Instruction Blocks, Tracked Items, and Trigger Events), write them in the markdown draft using clear, human-readable formatting (like lists and sub-headings). Do NOT write raw JSON in the markdown file. Keep the draft entirely human-readable.

**Reference Guide for Field Proposals**
When proposing field values, use the human-readable citation formats defined in the "Citation Pattern" and "Examples of Correctly Cited vs Non-Cited Proposals" sections above:
- **Story Metadata citations:** "From Story Metadata [field name]: [value]"
- **Turn Outcome citations:** "From Turn #[number] Outcome: [summary]. Direct quote: [quote from turn outcome]"
- **Secret Info citations:** "From Turn #[number] Secret Info: [summary]. Direct quote: [quote from secret info]"
- **Tracked Item citations:** "From Turn #[number] Tracked Item [name]: [summary]. Direct Citation: [item name]'s value was '[value]' on Turn #[number]"
- **Turn summaries:** "From Turn #[number] Outcome/Secret Info: [specific narrative detail]. Direct quote: [quote]"

Do NOT reference MCP function syntax (query_story_data, extraction_dir) in field proposals. Use the human-readable citation formats above to document where evidence comes from. This keeps your field proposals grounded in structured, verified data and transparent to users.

**Integration with Field-by-Field Walkthrough:**

When you propose a field value during refinement, include the Evidence tag in your reasoning:

Example user-facing proposal:
- **Field:** Character Appearance
- **Proposed Value:** [description]
- **Evidence:** From Turn #3 Outcome, Alice's appearance is described. Direct quote: "Alice appears wearing..."
- **Verification:** ✓ cited from story text ✓ no fabrication ✓ gap-checked

The Evidence tag helps users and reviewers see exactly where your proposal came from. It's both internal reasoning (for agent verification) and external documentation (for user transparency).

When the draft is completely finished and approved, use the `compile_draft` MCP tool to generate the final sequel world JSON file using the requested name in the target directory. For the complex fields, construct the proper, valid JSON arrays behind the scenes based on the draft and pass them directly as arguments to the `compile_draft` tool.

After the world JSON file is generated, use `compare_worlds` to compare the original world JSON with the sequel and present a summary of what evolved from the source material. Then run `validate_world` on the output file. Present any errors or warnings to the user before considering the command complete.
