---
name: inject-logic
description: "Inject pre-written mechanics (like time-tracking or dice-roll evaluation) into an existing world. Trigger phrases: 'I want to add mechanics to my world', 'Inject a pre-built system into my world', 'Add time-tracking or dice-roll mechanics to my world', 'Install a mechanic into my existing world', 'I want to use a special mechanic in my world'."
---

I want to inject a new mechanic into my world JSON file.

Before we begin, ask me for the path to the world JSON file I want to modify.

**Path Confirmation**: For any file or directory path provided, use the `confirm_path` MCP tool to resolve and confirm the absolute path with the user before proceeding.

Once the path is confirmed, please list the available mechanics (like Time-Tracking integration or Dice-Roll Evaluation overrides). Ask me which one I want, then use the add_instruction_block MCP tool to safely append it to that world file.

After the mechanic has been injected, run `validate_world` on the modified world file. Present any errors or warnings to the user before considering the command complete.
