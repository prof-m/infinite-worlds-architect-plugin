---
name: modify-world
description: Interactively modify specific fields of an existing world JSON file
---

I want to modify an existing world JSON file.

Before we begin, ask me for:
1. The path to the existing world JSON file I want to modify.

**Path Confirmation**: For any file or directory path provided, use the `confirm_path` MCP tool to resolve and confirm the absolute path with the user before proceeding.

Once the path is confirmed:
1. Check if a `draft_world.md` file already exists in the same directory. If it does, ask me if I want to overwrite it or write to a new file name. If I say a new file name, prompt me for it.
2. Once settled, use the `decompile_json` MCP tool to read the existing world JSON file and automatically generate a human-readable draft markdown file at the chosen path. The generated markdown file will contain the headers:
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

Then, enter an interactive modification loop:
1. Ask me: "How would you like to modify the world?" with the following options:
   - Select specific fields
   - Give a generic instruction
   - Present a summary of changes
   - Finalize Changes

2. If I choose "Present a summary of changes":
   - Use the `get_diff_summary` MCP tool (passing the path to the original world JSON and the current `draft_world.md`) to find and present a summary of all changes made so far.
   - After presenting the summary, return to the Main Menu (Step 1).

3. If I choose "Give a generic instruction":
   - Ask me for the instruction.
   - For entity-level changes (adding/modifying characters, NPCs, or tracked items), always use the dedicated MCP tools (`add_character`, `add_npc`, `add_tracked_item`, `modify_character`, `modify_npc`, `modify_tracked_item`) whenever one exists to apply changes directly to the world JSON instead of modifying the draft. This is faster and avoids a recompile step.
   - For other changes, analyze the current `draft_world.md`, identify all relevant sections that need changing based on my instruction, and propose the updates.
   - Present the proposed changes to me clearly.
   - Ask: "Would you like to approve these changes, or make additional modifications?"
   - Once I approve, ask: "What would you like to do next?" with options: "Give another generic instruction", "Select specific fields", "Present a summary of changes", or "Finalize Changes".

4. If I choose "Select specific fields":
   - Present the fields grouped into logical categories:
      - Core Content (Title, Description, Background, Objective...)
      - Instructions & Visuals (Main Instructions, Image Style, Author Style...)
      - Mechanics & Characters (Skills, Characters, Triggers, Items...)
      - Back to Main Menu
   - When I select a category, present the fields in that category until I select a specific field.
   - If I select a field, read the current values of that field from the markdown draft using `read_draft_section`, present them, and ask me what I want to change.
   - Wait for my answer. Suggest modifications based on my input, update the specific section in the markdown file using `update_draft_section`, and wait for my approval.
   - Once I say the field looks good and approve it, ask: "What would you like to do next?" with options: "Modify another specific field", "Give a generic instruction", "Present a summary of changes", or "Finalize Changes".

If I choose "Finalize Changes":
1. Ask me if I want to overwrite the original world JSON file, or save the changes to a new world JSON file (and if new, ask for the new file path/name).
2. Once I answer, use the `compile_draft` MCP tool to generate the final world JSON file at the chosen location. For the complex fields (Skills, Characters, Triggers, Items, Instruction Blocks), construct the proper, valid JSON arrays behind the scenes based on the draft and pass them directly as arguments to the `compile_draft` tool.
3. After the world JSON file is generated, use `compare_worlds` to compare the original world JSON with the newly compiled version and present a summary of all changes to the user.
4. Run `validate_world` on the output file. Present any errors or warnings to the user before considering the command complete.
