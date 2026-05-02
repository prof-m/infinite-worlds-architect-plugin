---
name: spinoff-world
description: "Create a new world branched from an existing world JSON file. Trigger phrases: 'Create a new world based on an existing one but with a different angle', 'Branch off a variation of my world', 'I want to explore an alternative version of this world', 'Create a spinoff world from my existing world', 'Build a new world inspired by this one with a different concept'."
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

## Story Accuracy Requirements

Before proceeding with field-by-field refinement, establish these non-negotiable accuracy guardrails:

**ONLY include details explicitly stated in the original world or requested by the user.** When updating any field—character appearances, relationships, abilities, motivations, terminology, or events—source your proposals directly from the original world JSON or the user's spinoff concept. Mark new elements (character redesigns, relationships, locations) as creative divergences from the source, not as "facts" derived from the original.

**NEVER substitute genre stereotypes for missing details.** If a character's appearance isn't described, do not invent "typical" descriptions based on their role or background. Leave the field empty, uncertain, or explicitly note "appearance not described."

**NEVER invent proper nouns, named abilities, or coined terminology.** Do not create official-sounding ability names, secret project titles, or world-specific terms that don't appear in the source material. If a concept is mentioned without naming it, use the source's own language rather than creating a name.

**Distinguish literal statements from sarcasm, jokes, and figurative language.** When parsing character dialogue and description text, be alert to tone. A character's sarcastic comment about their abilities is not a literal statement of fact. Self-deprecating humor should not be taken as character truth.

**Do NOT sanitize morally complex elements.** If the world or characters contain manipulation, betrayal, coercion, exploitation, or other dark elements, represent them accurately. Do not soften language or omit uncomfortable truths in an attempt to make the spinoff more "wholesome."

**For appearance and personality fields, prefer the source material's own descriptions verbatim.** When source text explicitly describes how a character looks, dresses, or behaves, use those exact descriptions rather than paraphrasing or embellishing them.

**Field Reference Lookup**: Before proposing content for any field, load the corresponding reference file from `skills/world-architect/references/sections/` using the Read tool. Do not propose content for a field until you have read its reference file.

| Fields | Reference file |
|---|---|
| Title, Description, Background, First Action, Objective | `skills/world-architect/references/sections/introducing-the-story.md` |
| Main Instructions, Extra Instruction Blocks, Author Style, Design Notes, NSFW, Content Warnings | `skills/world-architect/references/sections/main-instructions.md` |
| Image Model, Image Style, all Image Style wrapper fields | `skills/world-architect/references/sections/image-style.md` |
| Skills, Possible Characters, Player Permissions | `skills/world-architect/references/sections/player-characters.md` |
| Victory Condition, Victory Text, Defeat Condition, Defeat Text | `skills/world-architect/references/sections/victory-defeat.md` |
| Other Characters (NPCs) | `skills/world-architect/references/sections/other-characters.md` |
| Keyword Instruction Blocks | `skills/world-architect/references/sections/keyword-instruction-blocks.md` |
| Tracked Items | `skills/world-architect/references/sections/tracked-items.md` |
| Trigger Events | `skills/world-architect/references/sections/trigger-events.md` |
| Description Request, Summary Request | `skills/world-architect/references/sections/misc-advanced-features.md` |

Then, guide me strictly FIELD-BY-FIELD through refining this draft.
Start with the Title. Present the original/proposed data for that field and ask me how I'd like to modify it. Once I answer, update the markdown file using `update_draft_section`, and wait for my approval before moving to the next field. Do not group fields together unless I explicitly ask you to.

For complex fields (like Skills, Possible Characters, Other Characters, Instruction Blocks, Tracked Items, and Trigger Events), write them in the markdown draft using clear, human-readable formatting (like lists and sub-headings). Do NOT write raw JSON in the markdown file. Keep the draft entirely human-readable.

**Character fields (Possible Characters / Other Characters):** Source all character details — appearance, relationships, abilities, motivations — exclusively from the original world JSON already loaded. Do not invent traits not present in the source. If a detail is absent, leave the field empty or note it as undescribed. See the Story Accuracy Requirements section above.

When the draft is completely finished and approved, use the `compile_draft` MCP tool to generate the final spinoff world JSON file using the requested name in the target directory. For the complex fields, construct the proper, valid JSON arrays behind the scenes based on the draft and pass them directly as arguments to the `compile_draft` tool.

After the world JSON file is generated, use `compare_worlds` to compare the original world JSON with the new spinoff and present a summary of what diverged from the source world. Then run `validate_world` on the output file. Present any errors or warnings to the user before considering the command complete.
