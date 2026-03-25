# Infinite Worlds Architect Plugin (Claude Code)

This plugin provides a comprehensive toolset for designing, compiling, and spinning off worlds for the [Infinite Worlds](https://infiniteworlds.app) storytelling platform.

## Features

- **MCP Server**: Provides programmatic, schema-safe tools to create and edit world JSON files.
- **Agent Skill (`world-architect`)**: Imbues the AI with deep knowledge of Infinite Worlds mechanics, token efficiency strategies, and exact JSON schemas.
- **Custom Commands**:
  - `/infinite-worlds-architect:draft-world`: Interactively build a world step-by-step using a readable Markdown draft before compiling to JSON.
  - `/infinite-worlds-architect:modify-world`: Interactively modifies an existing world step-by-step, allowing you to select and update specific fields before recompiling.
  - `/infinite-worlds-architect:scaffold-world`: Generates a quick world JSON file from a single prompt.
  - `/infinite-worlds-architect:spinoff-world`: Generates a new world purely from an existing world JSON file using the interactive step-by-step markdown draft workflow.
  - `/infinite-worlds-architect:sequel-world`: Generates a new world informed by both the original world JSON file and a full story export, using the interactive step-by-step markdown draft workflow.
  - `/infinite-worlds-architect:inject-logic`: Prompts you to select pre-written mechanics (like time-tracking) to inject into an existing world.

## How to Install

1. Navigate to the directory of this plugin and install dependencies:
   ```bash
   cd {directory_you_cloned_to}/infinite-worlds-architect-plugin
   npm install
   ```

2. Link the plugin to Claude Code:
   ```bash
   claude plugin link .
   ```

3. Restart your Claude Code session.
