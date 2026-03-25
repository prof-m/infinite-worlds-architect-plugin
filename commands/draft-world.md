---
name: draft-world
description: Interactively build a world step-by-step using a readable Markdown draft before compiling to JSON
---

I want to interactively draft a new Infinite Worlds world.

Before we begin, ask me:
1. Whether I want to create a new directory for this world or use an existing one.
  - If I want a new one, ask for the name/path.
  - If I want an existing one, ask for the path.
2. What I want to name the final world JSON file (e.g. `world.json`, `my_world.json`). Wait for my response.

**Path Confirmation**: For any file or directory path provided, use the `confirm_path` MCP tool to resolve and confirm the absolute path with the user before proceeding.

Once the target directory and file name are confirmed, check if a `draft_world.md` file already exists in that directory.
- If it DOES exist, ask me if I want to overwrite it or write to a new file name. If I say a new file name, prompt me for it.
- Once the draft file path is settled, please start by creating it. It should contain the following headers, with empty content below each:
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

Then, guide me strictly FIELD-BY-FIELD through filling out this draft.
Start by asking me what I want for the Title. Once I answer, suggest text for the field, use the `update_draft_section` tool to surgically update the section in the markdown file, and wait for my approval. Only once I approve should you move on to ask about the Description, and so on. Do not group fields together unless I explicitly ask you to. Try using the MCP server commands/tools (`update_draft_section`) first to update the markdown draft, and only fall back to other approaches if absolutely necessary.

For complex fields (like Skills, Possible Characters, Other Characters, Instruction Blocks, Tracked Items, and Trigger Events), write them in the markdown draft using clear, human-readable formatting (like lists and sub-headings). Do NOT write raw JSON in the markdown file. Keep the draft entirely human-readable.

When the draft is completely finished and approved, use the `compile_draft` MCP tool to generate the final world JSON file using the requested name in the target directory. For the complex fields, construct the proper, valid JSON arrays behind the scenes based on the draft and pass them directly as arguments to the `compile_draft` tool.

After the world JSON file is generated, run `validate_world` on the output file. Present any errors or warnings to the user before considering the command complete.
