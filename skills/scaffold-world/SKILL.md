---
name: scaffold-world
description: "Generates a quick world JSON file from a single prompt. Trigger phrases: 'Create a quick world from a simple idea', 'I want to prototype a world fast', 'Generate a world from a title and premise', 'Quick-start a world with defaults', 'Build me a world in seconds'."
---

I want to scaffold a new Infinite Worlds world.

Before we begin, ask me:
1. Whether I want to create a new directory for this world or use an existing one.
  - If I want a new one, ask for the name/path.
  - If I want an existing one, ask for the path.
2. What I want to name the final world JSON file (e.g. `world.json`, `my_world.json`). Wait for my response.

**Path Confirmation**: For any file or directory path provided, use the `confirm_path` MCP tool to resolve and confirm the absolute path with the user before proceeding.

Once the target directory and file name are confirmed, ask me for the Title, Genre, and Core Premise.

**Before generating any world content**, read all relevant field reference files from `skills/world-architect/references/sections/` using the Read tool. Since scaffold-world generates all fields in one pass, load the reference files for all field groups you intend to populate:

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

Once I answer, use the scaffold_world MCP tool to create the world JSON file with the requested name in that directory with token-efficient defaults. Then use `add_character`, `add_npc`, `add_tracked_item`, and `add_trigger` to populate entities directly into the scaffolded world JSON. **When populating multiple entities, issue these MCP calls in parallel** — emit multiple `tool_use` blocks in a single response rather than waiting for each call's result before issuing the next. Each round-trip costs several seconds of model latency regardless of payload size, so a dozen serial `add_*` calls take minutes that parallel dispatch finishes in roughly the time of one.

After the world JSON file is generated, run `validate_world` on the output file. Present any errors or warnings to the user before considering the command complete.
