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

## Extract Story Data

Call the `extract_story_data` MCP tool to parse the story export(s) into structured JSON. This replaces manually reading the entire raw file and prevents hallucination from working with thousands of lines of unstructured text.
- Specify an extraction directory (e.g., `extracted_story/` relative to your output directory). Ensure the extraction directory exists before calling the tool, or use an absolute path.
- The tool will return success/failure status and create output files (manifest.json, metadata.json, turn_index.json, tracked_state.json)
- If extraction succeeds, continue with the next step. If it fails, warn the user and fall back to reading the raw export file directly.

## Understand Story Context via Query Tools

Instead of reading the entire export file, use `query_story_data` to load structured extraction data. First, save the result from `extract_story_data` — it contains `hasTrackedItems` (gates tracked_state queries) and `filesWritten` (check for `character_index.json` to know if character indexing succeeded).

Then query in this order:

1. Call `query_story_data(extraction_dir, 'manifest')` to read extraction provenance (source files, total turns, `has_tracked_items` flag).
2. Call `query_story_data(extraction_dir, 'metadata')` to load `story_background`, character details, and `objective`. This gives you the high-level context.
3. Call `query_story_data(extraction_dir, 'turn_index')` to get a listing of all turns with their turn numbers, 100-character action/outcome previews, and source file references. Note: these previews are truncated (100 chars from turns that can be 500–1000+ chars) — they show which turns exist and their line ranges, but are NOT sufficient to understand turn content or identify narrative turning points. Use `turn_detail` queries for actual content.
4. If `has_tracked_items` is true, call `query_story_data(extraction_dir, 'tracked_state')` to load tracked item state history. Use the final snapshot and turn deltas to identify high-value turns for step 6.
5. If `character_index.json` was in `filesWritten` (from the extract result), read the character index to identify which turns introduce each character. Use those turn numbers to inform your turn_detail queries in step 6.
6. For specific narrative deep-dives, call `query_story_data(extraction_dir, 'turn_detail', turns: ["1", ...])` passing turn numbers (as strings) you want to examine — target 3–7 turns maximum. The response contains raw turn text — parse Outcome and Secret Information sections for narrative content.

These queries give you structured data with far better context efficiency than reading raw story text.

Check if a `draft_world.md` file already exists in the target directory. If it does, ask me if I want to overwrite it or write to a new file name. If I say a new file name, prompt me for it.

Once settled, use the `decompile_json` MCP tool to read the original world JSON file and generate the draft markdown file at the chosen path.

## Update Draft Markdown

Before filling in fields, you MUST read `references/story_context_distribution.md` to decide which extraction data belongs in which world field type. Do not distribute extracted data into fields until you have read and understood the distribution strategy document.

Update the newly generated draft markdown file (using the `update_draft_section` tool) to combine the original world's settings with the rich narrative background derived from the story extraction. The markdown file contains the headers:
- Title
- Description
- Background
- First Action
- Objective
- Main Instructions
- Author Style
- NSFW
- Content Warnings
- Description Request
- Summary Request
- Image Model
- Image Style
- Image Style Character Pre
- Image Style Character Post
- Image Style Non Character Pre
- Image Style Non Character Post
- Victory Condition
- Victory Text
- Defeat Condition
- Defeat Text
- Design Notes
- Player Permissions
- Enable AI Specific Instruction Blocks
- Skills
- Possible Characters
- Other Characters
- Extra Instruction Blocks
- Keyword Instruction Blocks
- Tracked Items
- Trigger Events

## Field-Level Verification Checklist

Before proposing any field value, verify:
- Is this detail explicitly stated in the story, or am I inferring/inventing?
- Am I substituting a genre stereotype for missing information?
- Am I inventing proper nouns, ability names, or terminology not in the story?
- Does my proposal accurately reflect the tone (literal vs sarcasm)?
- Am I softening dark/complex elements that should be preserved?
- **Can I cite this from extraction data?** (metadata, turn_detail, turn_index, or tracked_state)
- **If no citation exists, should I propose this field at all?**

Then, guide strictly FIELD-BY-FIELD through refining this draft.
Start with the Title. Present the proposed data for that field (incorporating developments from the story from your extracted data) and ask how to modify it. Once answered, update the markdown file using `update_draft_section`, and wait for approval before moving to the next field. Do not group fields together unless explicitly asked.

For complex fields (like Skills, Possible Characters, Other Characters, Instruction Blocks, Tracked Items, and Trigger Events), write them in the markdown draft using clear, human-readable formatting (like lists and sub-headings). Do NOT write raw JSON in the markdown file. Keep the draft entirely human-readable.

## Reference Materials

**Story Accuracy & Guardrails:** Before refining fields, consult `references/story-accuracy-guardrails.md` for non-negotiable accuracy principles:
- Only include details explicitly stated in the story
- Never substitute genre stereotypes for missing information
- Never invent proper nouns or terminology not in the story
- Preserve dark/complex content accurately
- For appearance fields, use the story's own descriptions verbatim

**Citation Methodology:** For detailed guidance on citing evidence and validating extraction data, see `references/citation-methodology.md`:
- Pre-citation validation checklist
- Citation pattern and formats
- Examples of correctly and incorrectly cited proposals
- No-Citation Rule: if extraction data doesn't support it, don't propose it

**Context Distribution Strategy:** For guidance on distributing extracted story state across world field types, see `references/story_context_distribution.md`:
- Tier strategy: which data belongs in always-on fields vs. keyword blocks vs. tracked items
- Loading sequence: when to query manifest, turn_index, tracked_state, and turn_detail
- Field assignment quick reference table
- Anti-patterns: what NOT to put in `background` and `instructions`

When the draft is completely finished and approved, use the `compile_draft` MCP tool to generate the final sequel world JSON file using the requested name in the target directory. For the complex fields, construct the proper, valid JSON arrays behind the scenes based on the draft and pass them directly as arguments to the `compile_draft` tool.

After the world JSON file is generated, use `compare_worlds` to compare the original world JSON with the sequel and present a summary of what evolved from the source material. Then run `validate_world` on the output file. Present any errors or warnings before considering the command complete.
