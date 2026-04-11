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

**Before calling `extract_story_data`, prompt the user for the character list to index.**

If the original world JSON path is available, call the `get_character_list` MCP tool with that path to automatically retrieve the NPC list. This avoids manually reading and parsing the world JSON.

Ask the user the following (word it naturally), substituting in the names returned by `get_character_list` (or noting that no world JSON was provided):

> "Before I extract the story data, I'd like to build a character index so I can look up each character's story appearances by name during the character-writing step — this prevents me from having to scan the entire story and significantly reduces the chance of errors. It's optional, but strongly recommended for any story with named NPCs.
>
> I've found the following NPCs in the original world JSON: [list the `name` values from the `character_list` returned by `get_character_list`, or note 'no world JSON available' if the tool was not called]. You don't need to include every minor NPC — just the ones who matter to the story. Feel free to add, remove, or correct any names, and provide any aliases a character goes by in the story (e.g. nicknames or titles used in the dialogue).
>
> Reply with the confirmed list, or say 'skip' to proceed without character indexing."

Wait for the user's response before proceeding.

Pass only the user-confirmed list as `character_list` to `extract_story_data`. Do not include any names the user did not explicitly confirm or leave unchanged. If the user said "skip" or "none", omit `character_list` entirely.

Call the `extract_story_data` MCP tool to parse the story export(s) into structured JSON. This replaces manually reading the entire raw file and prevents hallucination from working with thousands of lines of unstructured text.
- Specify an extraction directory (e.g., `extracted_story/` relative to your output directory). Ensure the extraction directory exists before calling the tool, or use an absolute path.
- The tool will return success/failure status and create output files (manifest.json, metadata.json, turn_index.json, tracked_state.json)
- If extraction succeeds, continue with the next step. If it fails, warn the user and fall back to reading the raw export file directly.

## Understand Story Context via Query Tools

Instead of reading the entire export file, you will use `query_story_data` to load structured extraction data. 

⚠️ **CRITICAL INSTRUCTION**: To prevent context bloat and hallucination, you MUST follow the exact 6-step "Loading Sequence Reference" found in `references/story_context_distribution.md` when querying this data. Do not query `turn_detail` or `tracked_state` without following the filtering conditionals in that guide.

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

## Tracked Items — Sequel Defaults

When you reach the **Tracked Items** field during the field-by-field review, apply the following behaviour automatically:

**If the original world JSON has tracked items** (non-empty `trackedItems` array):

1. **Default to proposing all of them.** Present the full list of tracked items from the original world as the starting point for the sequel. Flag any items that appear tied to resolved plot threads or mechanics that no longer apply to the sequel premise — but do not drop any item automatically. The author makes the final call on what to keep, modify, or remove.
2. **Import final story values as starting values.** For each tracked item, set `initialValue` to the value from the last snapshot in `tracked_state.json` (the snapshot with the highest `to_turn` value). Each snapshot contains a `tracked_items` object mapping item names to their current string values — use those values directly. For `xml` dataType items, note to the author that the imported value should be checked for validity before accepting it.
3. **Preserve all metadata from the original world JSON.** Carry forward each item's `dataType`, `visibility`, `description`, `updateInstructions`, `autoUpdate`, and `initialValueBasedOnPC` unchanged as defaults. The author can modify any of these during review.
4. **Handle hidden tracked items separately.** Only propose hidden tracked items if `has_hidden_tracked_items` is true in the manifest. If so, import their final values from the `hidden_tracked_items` object in the last snapshot and recommend `ai_only` or `nobody` visibility. If `has_hidden_tracked_items` is false or the field is null/absent, do not carry forward any hidden tracked items.
5. **Ask the author to confirm, modify, or drop each item.** Present the full list (regular and hidden, where applicable) with their imported values and any relevance flags, then ask the author which items to keep, which to modify, and which to drop.

**If the original world JSON is unavailable** (only `tracked_state.json` is available): present the tracked item names and their final values from the last snapshot. Recommend `"everyone"` or `"player_only"` as the default visibility for regular tracked items. Note that `dataType`, `description`, `updateInstructions`, `autoUpdate`, and `initialValueBasedOnPC` will need to be specified manually. Follow the same hidden tracked items handling above.

**If the original world JSON has no tracked items** (empty or absent `trackedItems` array): propose no tracked items by default. You may suggest adding some if the sequel premise warrants it, but do not invent items based on story content alone.

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

**Character Writing Guide:** Before generating the `possibleCharacters` (Possible Characters) or `NPCs` (Other Characters) sections, read `references/character_writing_guide.md`. This guide establishes the required just-in-time extraction method — query `character_index` and `tracked_state` first, then call `turn_detail` only for the targeted first-occurrence and pivotal turns. It acts as a firewall against token-expensive over-querying and enforces the no-hallucination rules from `story-accuracy-guardrails.md`.

When the draft is completely finished and approved, use the `compile_draft` MCP tool to generate the final sequel world JSON file using the requested name in the target directory. For the complex fields, construct the proper, valid JSON arrays behind the scenes based on the draft and pass them directly as arguments to the `compile_draft` tool.

After the world JSON file is generated, use `compare_worlds` to compare the original world JSON with the sequel and present a summary of what evolved from the source material. Then run `validate_world` on the output file. Present any errors or warnings before considering the command complete.
