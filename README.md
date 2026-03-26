# Infinite Worlds Architect Plugin (Claude Code)

A [Claude Code](https://claude.com/claude-code) plugin for designing, compiling, and iterating on worlds for the [Infinite Worlds](https://infiniteworlds.app) interactive storytelling platform.

The plugin uses a human-readable Markdown draft as an intermediate format, so you can review and refine every field before compiling to the platform's JSON format. It covers the full Infinite Worlds schema — characters, NPCs, skills, tracked items, trigger events (all 9 condition types and 17 effect types), keyword blocks, image styles, victory/defeat conditions, player permissions, and more.

## How It Works

```
Your idea  -->  Markdown draft (draft_world.md)  -->  world.json (upload to Infinite Worlds)
```

The plugin walks you through each field interactively, suggests content, and waits for your approval before moving on. Complex fields (characters, triggers, tracked items) are written in readable Markdown with `##` and `###` headers — never raw JSON. When you're done, the compiler handles all the schema details behind the scenes.

## Commands

| Command | Description |
|---------|-------------|
| `/infinite-worlds-architect:draft-world` | Build a new world step-by-step using an interactive Markdown draft workflow. |
| `/infinite-worlds-architect:modify-world` | Modify specific fields of an existing world — decompiles to draft, lets you pick fields to change, then recompiles. |
| `/infinite-worlds-architect:scaffold-world` | Quick-start a world from a single prompt with token-efficient defaults. |
| `/infinite-worlds-architect:spinoff-world` | Branch a new world from an existing one with a different concept or angle. |
| `/infinite-worlds-architect:sequel-world` | Create a sequel world informed by both the original world and a full story export. |
| `/infinite-worlds-architect:inject-logic` | Inject pre-built mechanics (time-tracking, dice-roll evaluation, etc.) into an existing world. |

## MCP Tools

The plugin runs an MCP server (`iw-json-tools`) that provides these tools:

| Tool | Description |
|------|-------------|
| `scaffold_world` | Initialize a new world JSON with token-efficient defaults. |
| `compile_draft` | Compile a Markdown draft into a valid world JSON, merging with an optional original file. |
| `decompile_json` | Convert a world JSON into a human-readable Markdown draft. |
| `read_draft_section` | Read a specific section from a draft file by header name. |
| `update_draft_section` | Surgically update a specific section in a draft file. |
| `get_diff_summary` | Compare an original world JSON against the current draft and list changes. |
| `compare_worlds` | Compare two world JSON files and return a structured diff of all changes. |
| `add_instruction_block` | Append an Extra Instruction Block or Keyword Block to a world file. |
| `add_trigger` | Append a Trigger Event with multiple conditions/effects, meta-fields (repeatable, prerequisites, blockers), type validation, and auto-coercion. |
| `confirm_path` | Resolve and confirm a file or directory path. |

## Agent Skill

The `world-architect` skill provides the AI with deep knowledge of Infinite Worlds mechanics, including:

- **JSON and draft schemas** — every field, type, and default value
- **Trigger system** — all condition types (turn, event, tracked item, random chance, prerequisites, blockers, etc.) and effect types (modify instructions, change objectives, set tracked items, end game, etc.)
- **Token efficiency strategies** — how to minimize per-turn credit costs by structuring instructions, keyword blocks, and tracked items
- **AI mechanics** — how the Storyteller AI evaluates actions, generates images, and manages memory
- **Design patterns** — best practices for world architecture, NPC design, and skill balancing

Reference materials are in `skills/world-architect/references/`.

## Installation

### Prerequisites

- [Claude Code](https://claude.com/claude-code) CLI installed
- Node.js 18+

### Steps

1. Clone the repository and install dependencies:
   ```bash
   git clone <repo-url> infinite-worlds-architect-plugin
   cd infinite-worlds-architect-plugin
   npm install
   ```

2. Register the plugin as a marketplace source:
   ```bash
   claude plugin marketplace add /path/to/infinite-worlds-architect-plugin
   ```

3. Install the plugin:
   ```bash
   claude plugin install infinite-worlds-architect
   ```

4. Restart your Claude Code session.

### Verify Installation

After restarting, type `/infinite-worlds-architect:` and you should see the available commands in autocomplete. You can also check MCP server status with `/mcp`.

## Quick Start

**Create a new world from scratch:**
```
/infinite-worlds-architect:draft-world
```
The plugin will ask where to save the file, then walk you through every field one by one.

**Modify an existing world:**
```
/infinite-worlds-architect:modify-world
```
Point it at your `world.json` and pick which fields to change.

**Quick scaffold for prototyping:**
```
/infinite-worlds-architect:scaffold-world
```
Give it a title, genre, and premise — get a working world JSON in seconds.

## Project Structure

```
infinite-worlds-architect-plugin/
  .claude-plugin/
    plugin.json              # Plugin manifest
  .mcp.json                  # MCP server configuration
  index.js                   # MCP server (compile, decompile, tools)
  package.json
  skills/
    draft-world/
      SKILL.md               # Interactive drafting command
    modify-world/
      SKILL.md               # Interactive modification command
    scaffold-world/
      SKILL.md               # Quick scaffold command
    spinoff-world/
      SKILL.md               # World branching command
    sequel-world/
      SKILL.md               # Story sequel command
    inject-logic/
      SKILL.md               # Mechanic injection command
    world-architect/
      SKILL.md               # Core skill definition
      references/
        schema.md            # Full world.json schema reference
        draft_schema.md      # Markdown draft format reference
        design_guide.md      # World design overview
        ai_mechanics.md      # AI mechanics and trigger system reference
        efficiency_guide.md  # Token cost optimization guide
        story_data_structure.md  # Story export format reference
      scripts/
        extract_spinoff.cjs  # Story export parser
        generate_world.cjs   # World compilation utility
```

## License

MIT
