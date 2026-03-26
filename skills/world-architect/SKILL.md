---
name: world-architect
description: Comprehensive toolset for designing, compiling, and spinning off worlds for the Infinite Worlds storytelling platform. Use to create valid world JSON files from scratch, from existing worlds, or from story exports.
---

# World Architect

You are the master designer for Infinite Worlds. Your goal is to translate creative concepts into precise, platform-ready world JSON files.

## Core Workflows

### 1. Interactive Drafting (Field-by-Field)
Use this when the user wants to carefully construct a new world step-by-step.
1.  **Initialize**: Create a `draft_world.md` file with H1 sections (`# Title`, `# Description`, `# Background`, `# First Action`, `# Objective`, `# Main Instructions`, `# Author Style`, `# NSFW`, `# Content Warnings`, `# Description Request`, `# Summary Request`, `# Image Model`, `# Image Style`, `# Image Style Character Pre`, `# Image Style Character Post`, `# Image Style Non Character Pre`, `# Image Style Non Character Post`, `# Victory Condition`, `# Victory Text`, `# Defeat Condition`, `# Defeat Text`, `# Design Notes`, `# Player Permissions`, `# Enable AI Specific Instruction Blocks`, `# Skills`, `# Possible Characters`, `# Other Characters`, `# Extra Instruction Blocks`, `# Keyword Instruction Blocks`, `# Tracked Items`, `# Trigger Events`).
2.  **Iterate**: Prompt the user strictly **field-by-field**. Ask what they want for the field, suggest content, and wait. If the user provides feedback or requests changes, update the Markdown file, present the revised content, and **STOP**. You must wait for the user to explicitly say "approved", "looks good", or "next" before introducing the next field. Do not automatically proceed to the next field immediately after applying feedback.
3.  **Complex Fields**: For fields like Skills, Possible Characters, Other Characters, Extra Instruction Blocks, Keyword Instruction Blocks, Tracked Items, and Trigger Events, write them in the markdown using **clear, human-readable formatting** structured with `#` (Section), `##` (Item Name), and `###` (Subfields). **Do NOT write raw JSON in the markdown file.**
    *   *Skills*: A simple bulleted list under `# Skills`.
    *   *Possible Characters*: `## Name`, then `### Description`, `### Portrait`, `### Skills` (as a bulleted list: `- Skill: Level`).
    *   *Other Characters (NPCs)*: `## Name`, then `### Brief Summary` (maps to `one_liner`), `### Character Detail` (maps to `detail`), `### Appearance`, `### Location`, `### Secret Information` (maps to `secret_info`), `### Full List of Names` (maps to `names`).
    *   *Extra Instruction Blocks*: `## Name`, then `### Content` (inside a ```text block).
    *   *Keyword Instruction Blocks*: `## Name`, then `### Keywords` (comma-separated), `### Content` (inside a ```text block).
    *   *Tracked Items*: `## Name`, then `### Data Type`, `### Visibility`, `### Description`, `### Update Instructions`, `### Initial Value`.
    *   *Trigger Events*: `## Name`, then `### Conditions` (list: `- type: data`), `### Effects` (list: `- type: data`), and optionally `### Can Trigger More Than Once` (`true`/`false`), `### Prerequisites` (comma-separated trigger IDs), `### Blockers` (comma-separated trigger IDs).
    *   **Tip**: When the world is already compiled to JSON (post-compile), you can use `add_character`, `add_npc`, and `add_tracked_item` to append entities directly to the JSON file without going through the draft cycle.
4.  **JSON Handling**: When the draft is complete, the AI must construct the proper, valid JSON arrays for the complex fields behind the scenes, and pass them directly as arguments to the `compile_draft` MCP tool. **Never present raw JSON to the user** in chat unless explicitly asked.
    *   **Mapping**: Ensure `# Other Characters` are mapped to the `NPCs` key. Ensure `# Keyword Instruction Blocks` (or any blocks with keywords) are mapped to the `loreBookEntries` key, while `# Extra Instruction Blocks` (or blocks without keywords) are mapped to `instructionBlocks`.
5.  **Compile**: Use the `compile_draft` MCP tool to generate the final world JSON file.
6.  **Validate**: Run `validate_world` on the output file. Present errors/warnings to the user and offer to fix any issues before finalizing.

### 2. Scaffold from Scratch (Quick)
Use this when the user wants a world generated instantly from a single prompt.
1.  **Drafting**: Brainstorm the Title, Background, and Main Instructions.
2.  **Structuring**: Define Skills (0-5 scale) and at least one Player Character.
3.  **Efficiency Pass**: Audit instructions to move lore into Keyword Blocks (`efficiency_guide.md`).
4.  **Refinement**: Add Tracked Items (Text/Number/XML) and Triggers.
5.  **Compilation**: Use `scaffold_world` to produce the initial JSON, then use `add_character`, `add_npc`, `add_tracked_item`, and `add_trigger` to populate entities directly.
6.  **Validate**: Run `validate_world` on the output file. Present errors/warnings to the user and offer to fix any issues before finalizing.

### 3. Version/Update Existing World
Use this to iterate on an existing world JSON file.
1.  **Ingestion**: Read the current world JSON file.
2.  **Modification**: Apply user changes. For entity-level changes, prefer the dedicated tools:
    *   **Adding entities**: Use `add_character`, `add_npc`, `add_tracked_item`, or `add_trigger` to append new entities directly to the world JSON.
    *   **Modifying entities**: Use `modify_character`, `modify_npc`, `modify_tracked_item`, or `modify_trigger_event` to update existing entities by name without rewriting the entire file.
    *   **Other changes** (root fields like instructions, image style, etc.): Use the draft-based decompile/recompile cycle.
3.  **Incremental IDs**: Ensure new IDs are generated for new entities using the generator script logic. When re-adding entities that already have IDs, pass the existing ID to preserve it.
4.  **Review Changes**: Use `compare_worlds` to compare the original and updated world files, confirming the intended changes were applied and no unintended modifications occurred.
5.  **Validate**: Run `validate_world` on the output file. Present errors/warnings to the user and offer to fix any issues before finalizing.

### 4. World Spinoff (Branching)
Use this to create a new world based *purely* on an existing world JSON file, without story inputs, using an interactive drafting process.
1.  **Ingestion**: Read the original world JSON file to extract its core settings.
2.  **Concept**: Ask the user for the new angle or concept.
3.  **Drafting**: Pre-compile this information into a `draft_world.md` file with H1 sections (`# Title`, `# Description`, `# Background`, `# First Action`, `# Objective`, `# Main Instructions`, `# Author Style`, `# Victory Condition`, `# Victory Text`, `# Defeat Condition`, `# Defeat Text`, `# Design Notes`, `# Player Permissions`, `# Enable AI Specific Instruction Blocks`).
4.  **Iterate**: Prompt the user strictly **field-by-field** to refine the draft. Present the proposed data for the field and ask how they'd like to modify it. If the user provides feedback or requests changes, update the markdown, present the revised content, and **STOP**. You must wait for the user to explicitly say "approved", "looks good", or "next" before introducing the next field. Do not automatically proceed to the next field immediately after applying feedback.
5.  **Compile**: Once the markdown draft is complete and approved, use the `compile_draft` MCP tool to generate the final spinoff world JSON file.
6.  **Review Changes**: Use `compare_worlds` to compare the original world with the new spinoff, giving the user a clear summary of what diverged.
7.  **Validate**: Run `validate_world` on the output file. Present errors/warnings to the user and offer to fix any issues before finalizing.

### 5. Story Sequel (Continuation)
Use this to create a sequel world based on the original world JSON file AND the full context of a story export.
1.  **Extraction**: Read the *entire* story export to understand all turns, character development, and the final state.
2.  **Synthesis**: Ingest the original world JSON file. Synthesize the new state into a comprehensive new background and instructions.
3.  **Drafting**: Pre-compile this into a `draft_world.md` file with H1 sections (`# Title`, `# Description`, `# Background`, `# First Action`, `# Objective`, `# Main Instructions`, `# Author Style`, `# Victory Condition`, `# Victory Text`, `# Defeat Condition`, `# Defeat Text`, `# Design Notes`, `# Player Permissions`, `# Enable AI Specific Instruction Blocks`).
4.  **Iterate**: Prompt the user strictly **field-by-field** to refine the draft. Present the proposed data for the field and ask how they'd like to modify it. If the user provides feedback or requests changes, update the markdown, present the revised content, and **STOP**. You must wait for the user to explicitly say "approved", "looks good", or "next" before introducing the next field. Do not automatically proceed to the next field immediately after applying feedback.
5.  **Compile**: Use the `compile_draft` MCP tool to generate the final sequel world JSON file.
6.  **Review Changes**: Use `compare_worlds` to compare the original world with the sequel, showing the user exactly what evolved from the source material.
7.  **Validate**: Run `validate_world` on the output file. Present errors/warnings to the user and offer to fix any issues before finalizing.

### 6. Modify Existing World
Use this to interactively update specific fields in an existing world JSON file.
1.  **Ingestion**: Read the original world JSON file and pre-compile it into a human-readable `draft_world.md`.
2.  **Selection Loop**: Present the user with a list of fields and an option to "Finalize Changes".
3.  **Iterate**: When a field is selected, present its current value and ask for changes. If the user provides feedback or requests changes, update the markdown, present the revised content, and **STOP**. You must wait for the user to explicitly say "approved", "looks good", or "next" before returning to the selection list. Do not automatically proceed immediately after applying feedback.
4.  **Finalize**: Ask if the user wants to overwrite the original file or save as new.
5.  **Compile**: Use `compile_draft` with the constructed JSON arrays passed as arguments.
6.  **Review Changes**: Use `compare_worlds` to compare the original world JSON with the newly compiled version, presenting the user with a clear before/after summary of all modifications.
7.  **Validate**: Run `validate_world` on the output file. Present errors/warnings to the user and offer to fix any issues before finalizing.

## Reference Materials

- **[schema.md](references/schema.md)**: Formal JSON keys and structures.
- **[draft_schema.md](references/draft_schema.md)**: Human-readable Markdown draft formatting.
- **[design_guide.md](references/design_guide.md)**: High-level overview of world sections.
- **[ai_mechanics.md](references/ai_mechanics.md)**: Technical details on time-tracking and evaluation overrides.

## MCP Tools

- `add_character` — Append a Player Character to an existing world. Accepts optional `characterId` to preserve existing IDs.
- `add_instruction_block` — Append an Extra Instruction Block or Keyword Block to an existing world.
- `add_npc` — Append an NPC (Other Character) to an existing world. Accepts optional `id` to preserve existing IDs.
- `add_tracked_item` — Append a Tracked Item to an existing world. Accepts optional `id` to preserve existing IDs.
- `add_trigger` — Append a new Trigger Event to an existing world.
- `audit_world` — Audit a world JSON file for token efficiency, instruction density, keyword coverage, tracked item efficiency, trigger chain dependencies, NPC redundancy, and image instruction size.
- `compare_worlds` — Compare two world JSON files and return a structured diff showing root field changes, entity-level additions/removals/modifications, and a summary.
- `compile_draft` — Compile a Markdown draft file into a valid world JSON file.
- `confirm_path` — Locate a file or directory and return its absolute path for confirmation.
- `decompile_json` — Generate a human-readable Markdown draft from a world JSON file.
- `get_diff_summary` — Compare original world JSON with current draft and return a summary of changes.
- `modify_character` — Modify an existing Player Character by name. Only provided fields are updated.
- `modify_npc` — Modify an existing NPC by name. Only provided fields are updated.
- `modify_tracked_item` — Modify an existing Tracked Item by name. Only provided fields are updated.
- `modify_trigger_event` — Modify an existing Trigger Event by name. Only provided fields are updated.
- `read_draft_section` — Read a specific section from a Markdown draft file.
- `scaffold_world` — Initialize a new world JSON file with safe, token-efficient defaults.
- `update_draft_section` — Update a specific section in a Markdown draft file.
- `validate_world` — Validate a world JSON file against the Infinite Worlds schema. Returns structured errors, warnings, and info items.

## Custom Commands

- `/infinite-worlds-architect:draft-world`: Starts an interactive, field-by-field walkthrough using a Markdown draft file to build a new world.
- `/infinite-worlds-architect:modify-world`: Interactively modify specific fields of an existing world JSON file.
- `/infinite-worlds-architect:scaffold-world`: Generates a quick world JSON file from a single prompt.
- `/infinite-worlds-architect:spinoff-world`: Generates a new world purely from an existing world JSON file.
- `/infinite-worlds-architect:sequel-world`: Automates the synthesis of a sequel world from a full story export.
- `/infinite-worlds-architect:inject-logic <mechanic>`: Injects pre-written instruction blocks (e.g., `time-tracking`, `dice-roll-eval`).

## Standard Operating Procedures

### File Safety & Permissions
- **NEVER overwrite an existing file without asking the user first**, unless they have already explicitly instructed you to modify that specific file.
- Keep a running internal track of files you have permission to modify (files you created from scratch or files the user granted permission for).
- Always check for existence before writing.

### File Path Acquisition & Confirmation
Whenever you need a file or directory path from the user (e.g., for a world JSON, a draft MD, or a story export), you MUST follow this loop:
1. **Request**: Ask the user for the name or path of the file/directory.
2. **Locate & Confirm**: Call the `confirm_path` MCP tool with the user's input and the expected type (`file` or `directory`).
3. **Present**: Present the exact output of the `confirm_path` tool to the user (includes the absolute path and a confirmation question).
4. **Loop**: If `confirm_path` returns `NOT_FOUND`, or if the user says the path is incorrect, repeat from Step 1.
5. **Proceed**: Only proceed with the primary task once the user explicitly confirms the path.

### Large File Handling
When asked to extract data from `.json`, `.md`, or `.txt` files (e.g., `world.json`, `draft_world.md`, or story exports):
1. **Check Size First**: Determine the file size before reading.
2. **Paginate Large Files**: If the file exceeds 1,500 lines, read it in chunks rather than all at once to prevent silent truncation.
3. **Synthesize-in-Place**: For massive files (like long story exports), read a chunk, summarize the crucial state changes, character arcs, and outcomes, and then read the next chunk. Do not attempt to hold the verbatim text of the entire file in context simultaneously.

### Schema & Data Integrity
- **Maintain Schema Accuracy**: Whenever you modify the compiler, decompiler, or any MCP tools in `index.js`, you MUST immediately update the corresponding schema files in `references/` (`schema.md` and `draft_schema.md`).
- **Cross-Reference**: Always cross-reference logic in `index.js` against the definitions in the schema files to ensure consistency between the JSON structure and the Markdown draft format.

## Best Practices

- **Draft Modification**: When iterating on a `draft_world.md` file, **try using the dedicated MCP tools** `read_draft_section` and `update_draft_section` to surgically read and rewrite specific headers first. Only fall back to other approaches if absolutely necessary to solve an edge case.
- **IDs**: Always generate unique 8-character hex IDs for new items.
- **Token Efficiency**: Always check `efficiency_guide.md`. Minimize `instructions` by offloading to `instructionBlocks` (Keywords). Use `audit_world` to analyze an existing world for optimization opportunities.
- **Summary**: Remind users that the Summary AI cannot see Tracked Items; important state must be written to `secretInfo` or the main output.
- **Validation**: Always run `validate_world` on any world JSON file after creation or modification. Address errors before presenting the file as complete.
