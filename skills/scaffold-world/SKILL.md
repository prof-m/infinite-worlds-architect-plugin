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

Once the target directory and file name are confirmed, ask me for the Title, Genre, and Core Premise. Once I answer, use the scaffold_world MCP tool to create the world JSON file with the requested name in that directory with token-efficient defaults. Then use `add_character`, `add_npc`, `add_tracked_item`, and `add_trigger` to populate entities directly into the scaffolded world JSON.

After the world JSON file is generated, run `validate_world` on the output file. Present any errors or warnings to the user before considering the command complete.
