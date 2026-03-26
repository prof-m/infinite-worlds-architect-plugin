---
name: spinoff-world
description: Create a new world branched from an existing world JSON file
---

I want to create a spinoff world from an existing world JSON file.

Before we begin, ask me for:
1. The path to the original world JSON file.
2. Whether I want to create a new directory for the new spinoff world, or use an existing one (and the path).
3. What I want to name the final spinoff world JSON file (e.g. `world.json`, `my_world.json`). Wait for my response.

**Path Confirmation**: For any file or directory path provided, use the `confirm_path` MCP tool to resolve and confirm the absolute path with the user before proceeding.

Once all paths and names are confirmed:
1. Ask me for the high-level concept or angle for this spinoff.
2. Check if a `draft_world.md` file already exists in the target directory. If it does, ask me if I want to overwrite it or write to a new file name. If I say a new file name, prompt me for it.
3. Once settled, use the `decompile_json` MCP tool to read the original world JSON file and generate the draft markdown file at the chosen path.
4. Update the newly generated draft markdown file (using the `update_draft_section` tool) to adapt the original world's settings based on my new concept. The markdown file contains the headers:
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
Start with the Title. Present the original/proposed data for that field and ask me how I'd like to modify it. Once I answer, update the markdown file using `update_draft_section`, and wait for my approval before moving to the next field. Do not group fields together unless I explicitly ask you to.

For complex fields (like Skills, Possible Characters, Other Characters, Instruction Blocks, Tracked Items, and Trigger Events), write them in the markdown draft using clear, human-readable formatting (like lists and sub-headings). Do NOT write raw JSON in the markdown file. Keep the draft entirely human-readable.

When the draft is completely finished and approved, use the `compile_draft` MCP tool to generate the final spinoff world JSON file using the requested name in the target directory. For the complex fields, construct the proper, valid JSON arrays behind the scenes based on the draft and pass them directly as arguments to the `compile_draft` tool.

After the world JSON file is generated, run `validate_world` on the output file. Present any errors or warnings to the user before considering the command complete.
