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
1. Read the ENTIRE export file(s) to understand the full context, character arcs, world state changes, and the final outcome of the story across ALL turns. Do not just look at the last turn.
2. Check if a `draft_world.md` file already exists in the target directory. If it does, ask me if I want to overwrite it or write to a new file name. If I say a new file name, prompt me for it.
3. Once settled, use the `decompile_json` MCP tool to read the original world JSON file and generate the draft markdown file at the chosen path.
4. Update the newly generated draft markdown file (using the `update_draft_section` tool) to combine the original world's settings with the rich narrative background derived from the full story export. The markdown file contains the headers:
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

Then, guide me strictly FIELD-BY-FIELD through refining this draft.
Start with the Title. Present the proposed data for that field (incorporating developments from the story) and ask me how I'd like to modify it. Once I answer, update the markdown file using `update_draft_section`, and wait for my approval before moving to the next field. Do not group fields together unless I explicitly ask you to.

For complex fields (like Skills, Possible Characters, Other Characters, Instruction Blocks, Tracked Items, and Trigger Events), write them in the markdown draft using clear, human-readable formatting (like lists and sub-headings). Do NOT write raw JSON in the markdown file. Keep the draft entirely human-readable.

When the draft is completely finished and approved, use the `compile_draft` MCP tool to generate the final sequel world JSON file using the requested name in the target directory. For the complex fields, construct the proper, valid JSON arrays behind the scenes based on the draft and pass them directly as arguments to the `compile_draft` tool.

After the world JSON file is generated, use `compare_worlds` to compare the original world JSON with the sequel and present a summary of what evolved from the source material. Then run `validate_world` on the output file. Present any errors or warnings to the user before considering the command complete.
