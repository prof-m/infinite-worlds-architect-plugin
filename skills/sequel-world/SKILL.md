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

**Integration Task 1: Extract Story Data**
Call the `extract_story_data` MCP tool to parse the story export(s) into structured JSON. This replaces manually reading the entire raw file and prevents hallucination from working with thousands of lines of unstructured text.
- Specify an extraction directory (e.g., `extracted_story/` relative to your output directory)
- The tool will return success/failure status and create output files (manifest.json, metadata.json, turn_index.json, tracked_state.json)
- If extraction succeeds, continue with Task 2. If it fails, warn the user and fall back to reading the raw export file directly.

**Integration Task 2: Understand Story Context via Query Tools**
Instead of reading the entire export file, use `query_story_data` to load structured extraction data:
1. Call `query_story_data(extraction_dir, 'metadata')` to load story background, character details, and objective. This gives you the high-level context.
2. Call `query_story_data(extraction_dir, 'turn_index')` to see a summary of all turns with action/outcome previews. Use this to understand turn distribution and identify key turning points.
3. For specific narrative deep-dives, call `query_story_data(extraction_dir, 'turn_detail', [N, ...])` passing the turn numbers you want to examine. This loads the full context/action/result text for those specific turns without loading the entire export.
4. If tracked items were found, call `query_story_data(extraction_dir, 'tracked_state')` to load the state history of tracked items across the story.

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

**Story Accuracy Requirements** (Proposal 1: Anti-Fabrication Guard Rails)
When proposing field values based on the story:
- ONLY include details explicitly stated in the story text (via query_story_data results)
- NEVER substitute genre stereotypes or assumptions for missing details
- NEVER invent proper nouns, named abilities, or made-up terminology
- Distinguish between literal statements and sarcasm, jokes, or figurative language
- Do NOT sanitize morally complex or dark events — preserve them as they occurred
- For appearance fields: prefer copying the story's own descriptions directly from query_story_data(turn_detail) results
- When a detail is uncertain or absent from the story, explicitly say "not mentioned in the story" rather than fabricating

Then, guide me strictly FIELD-BY-FIELD through refining this draft.
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
