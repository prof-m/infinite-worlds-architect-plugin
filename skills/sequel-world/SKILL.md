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

**Do NOT sanitize morally complex events.** If the story contains manipulation, betrayal, coercion, exploitation, or other dark elements, represent them accurately in the world description. Do not soften language or omit uncomfortable truths in an attempt to make the world more "wholesome."

**For appearance fields, prefer copying the story's own descriptions verbatim.** When the story explicitly describes how a character looks, dresses, or moves, use those exact descriptions rather than paraphrasing or embellishing them.

**For tracked items, preserve the exact state and descriptions from the story.** When extracting tracked item values, character motivations, secret projects, or hidden information, use only what appears explicitly in the story export. Do not invent "secret projects" a character might be working on, fabricate hidden motivations, or create mysterious "hidden tracked item" entries. If the story doesn't describe an item's state or a character's secret, leave it empty or mark it as "not described in story."

## Story Facts Review

After `extract_story_data` completes successfully, assemble a "Story Facts Brief" from the extracted data and present it to the user for review and correction. This step ensures accuracy and establishes a persistent record of verified facts that will guide the field-by-field walkthrough.

### Step 1: Assemble Story Facts Brief

Query the extraction data to gather key story information:

1. Call `query_story_data(extraction_dir, 'metadata')` to retrieve story background, character background, and objective
2. Call `query_story_data(extraction_dir, 'turn_index')` to retrieve turn summaries showing the story arc and key developments
3. Call `query_story_data(extraction_dir, 'turn_detail', [turn_numbers])` for the first 5-10 turns to capture initial character appearances, settings, and key events
4. If `manifest.json` indicates tracked items were found, call `query_story_data(extraction_dir, 'tracked_state')` to understand how tracked items evolved

Format this data into a readable "Story Facts Brief" with these sections:
- **Background**: Story setting, premise, and initial conditions (from metadata)
- **Objective**: The player character's goal and motivation (from metadata)
- **Characters**: For each character mentioned, list: name, first appearance turn, physical description (if provided in story), personality traits or behaviors observed, and last known location/status
- **Key Events**: Major plot points, turning points, and story developments (from turn_index summaries and turn_detail)
- **Current Status**: Where the story ended, unresolved threads, and character relationships at story conclusion

### Step 2: Present Brief to User for Corrections

Display the assembled Story Facts Brief to the user with this request:

> "I've assembled a Story Facts Brief from the extraction. Please review it for accuracy and provide any corrections or clarifications on:
> - Character appearances and physical descriptions
> - Character personalities, motivations, and relationships
> - Major events and plot developments
> - Terminology or proper nouns used in the story
> - Current status of characters and unresolved story threads
>
> Provide corrections in any format you prefer, and I'll merge them into a verified facts document."

Wait for the user to provide corrections, clarifications, or confirmation that the brief is accurate.

### Step 3: Write verified_story_facts.md

Based on the user's review, write a `verified_story_facts.md` file to the extraction directory (alongside `manifest.json`, `metadata.json`, etc.). This file serves as the persistent ground truth for this extraction.

Structure the file as follows:

```markdown
# Verified Story Facts

**Story**: [title from metadata]
**Extraction Date**: [timestamp]
**Source**: [extracted from N turns across M source file(s)]

## Original Facts (from Extraction)

[Assembled brief as presented to user]

## User Corrections & Clarifications

[Summarize user's corrections, or note "No corrections provided"]

## Resolved Facts

[Merged version with user corrections applied. This is the authoritative version to reference during field proposals]

### Characters

- **[Name]**: [Corrected description], appears in turn(s) [N, N+1, ...], last known [location/status]
- [Additional characters...]

### Key Events

- Turn [N]: [Event description with corrections]
- [Additional events...]

### Terminology & Proper Nouns

- [Term]: [Definition as used in story]
- [Additional terms...]

### Unresolved Threads

- [Open question or plot thread]
- [Additional threads...]
```

If the user provided no corrections, write the file with a note: "No corrections provided — original facts verified as accurate."

### Step 4: Load and Reference During Field-by-Field Walkthrough

When proceeding to field-by-field refinement, load the `verified_story_facts.md` file before proposing field values. When proposing any field that relates to characters, events, appearance, relationships, motivations, or story elements:

- Reference the verified facts: "From verified_story_facts.md: [character/event/detail]"
- Use verified facts to ensure consistency across multiple fields (e.g., character appearance field, character relationship fields, tracked item state fields)
- If a field proposal could contradict verified facts, note the contradiction and ask the user for clarification
- This prevents downstream errors where one field correction cascades across multiple unrelated fields

**Example**: If verified facts note "Alice was betrayed by Bob in turn 7," when proposing the "Possible Characters" field for Bob, reference this fact to ensure any character description or relationship aligns with the verified betrayal narrative.

## Field-Level Verification Checklist

Before proposing any field value, verify:
- Is this detail explicitly stated in the story, or am I inferring/inventing?
- Am I substituting a genre stereotype for missing information?
- Am I inventing proper nouns, ability names, or terminology not in the story?
- Does my proposal accurately reflect the tone (literal vs sarcasm)?
- Am I softening dark/complex elements that should be preserved?

Refer back to the Story Accuracy Requirements section above if you're uncertain about any field proposal.

Then, guide me strictly FIELD-BY-FIELD through refining this draft.
**Optional Diagnostic Insight**: If you need to understand the extraction metadata (source files processed, total turns extracted, tracked items flags, deduplication notes), optionally query `query_story_data(extraction_dir, 'manifest')` to get extraction diagnostics without reading raw files. This helps ground your understanding of what the extraction discovered.

Start with the Title. Present the proposed data for that field (incorporating developments from the story from your extracted data) and ask me how I'd like to modify it. Once I answer, update the markdown file using `update_draft_section`, and wait for my approval before moving to the next field. Do not group fields together unless I explicitly ask you to.

For complex fields (like Skills, Possible Characters, Other Characters, Instruction Blocks, Tracked Items, and Trigger Events), write them in the markdown draft using clear, human-readable formatting (like lists and sub-headings). Do NOT write raw JSON in the markdown file. Keep the draft entirely human-readable.

**Reference Guide for Field Proposals**
When proposing field values, cite your extraction data sources:
- For Background, Objective, and general story context: Reference `query_story_data(extraction_dir, 'metadata')`
- For character details (appearance, status, relationships): Reference specific turn numbers from `query_story_data(extraction_dir, 'turn_detail', [turn_numbers])`
- For tracked item state and evolution: Reference `query_story_data(extraction_dir, 'tracked_state')`
- For turn summaries and high-level story arc: Reference `query_story_data(extraction_dir, 'turn_index')`

This keeps your field proposals grounded in structured, verified data rather than synthesized interpretations.

When the draft is completely finished and approved, use the `compile_draft` MCP tool to generate the final sequel world JSON file using the requested name in the target directory. For the complex fields, construct the proper, valid JSON arrays behind the scenes based on the draft and pass them directly as arguments to the `compile_draft` tool.

After the world JSON file is generated, use `compare_worlds` to compare the original world JSON with the sequel and present a summary of what evolved from the source material. Then run `validate_world` on the output file. Present any errors or warnings to the user before considering the command complete.
