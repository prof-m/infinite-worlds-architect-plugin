# Infinite Worlds Architect Plugin — Improvement Roadmap

Generated: 2026-03-25
Plugin Version: 1.3.0
Analysis by: Claude Opus 4.6 (Principal Plugin Developer review)

## Executive Summary

After thorough analysis of the plugin code, example worlds/story exports (in `~/personal_project/infinite_worlds_stories`), and the [Infinite Worlds wiki](https://infiniteworlds.mywikis.wiki/wiki/Main_Page), this document captures all identified improvements prioritized by impact and effort. P0 items have been completed. P1a, P1b, and P1d have been completed. P2b, P2d, and P3a have been completed. P1c, P2c, P3b, and P3c remain.

---

## Status Tracker

| ID | Priority | Status | Description |
|----|----------|--------|-------------|
| P0a | P0 | DONE | Complete trigger system docs (all 9 conditions, 17 effects) |
| P0b | P0 | DONE | Add missing world fields to compiler/decompiler/schema |
| P1a | P1 | DONE | `validate_world` MCP tool |
| P1b | P1 | DONE | `audit_world` MCP tool |
| P1c | P1 | PENDING | Pre-built mechanic templates |
| P1d | P1 | DONE | Enhance `add_trigger` for multi-condition/multi-effect |
| P2a | P2 | DONE | Dedicated `add_npc`, `add_character`, `add_tracked_item` tools |
| P2b | P2 | DONE | Fix duplicated parseDraft logic |
| P2c | P2 | DEFERRED | Improve story export parsing |
| P2d | P2 | DONE | `compare_worlds` MCP tool |
| P3a | P3 | DONE | Migrate commands/ to skills/ format |
| P3b | P3 | PENDING | Add Chub AI Lorebook import tool |
| P3c | P3 | DONE | Refactor index.js into multi-file module structure |

---

## P0: Critical — Schema Completeness (DONE)

### P0a: Complete Trigger System Documentation

**Branch:** `p0/complete-trigger-docs`
**Files:** `schema.md`, `ai_mechanics.md`

The wiki documents **9 condition types** and **15 effect types**. The plugin's reference docs only cover ~4 conditions and ~5 effects. This is the highest-leverage fix because the AI assistant literally cannot help users build triggers it doesn't know about.

**All 9 Condition Types:**
1. `triggerOnEvent` (string) — AI-evaluated free-form situation
2. `triggerOnTurn` (integer) — Fires when turn >= value
3. `triggerOnStartOfGame` (boolean) — Fires before turn 0
4. `triggerOnCharacter` (string[]) — Restricts to specific player characters
5. `triggerOnTrackedItem` (object) — Operators: at_least, is_exactly, at_most, contains; and/or logic
6. `triggerOnRandomChance` (integer 1-100) — Percentage chance per turn
7. `prerequisites` (string[]) — Trigger IDs that must have fired first
8. `blockers` (string[]) — Trigger IDs that must NOT have fired
9. `canTriggerMoreThanOnce` (boolean) — Repeat firing control

**All 15 Effect Types:**
1. `scriptedText` — Appends to outcomeDescription
2. `giveGuidance` — AI instruction for next turn
3. `addSecretInfo` — Adds to secretInfo
4. `changeAdventureBackground` — Modifies background
5. `changeInstructions` — Replaces main instructions
6. `changeInstructionBlock` — Modifies specific EIB {id, content}
7. `changeAuthorStyle` — Replaces writing style
8. `changeDescriptionInstructions` — Modifies description guidelines
9. `changeObjective` — Replaces objective
10. `changeVictoryCondition` — {condition, text, alreadyFired}
11. `changeDefeatCondition` — {condition, text, alreadyFired}
12. `changeFirstAction` — Modifies initial action
13. `changeName`/`changeDescription`/`changeSkill` — Player character mods
14. `setTrackedItemsValue` — Batch item updates (set/add/subtract/replace)
15. `randomTriggers` — Fires random trigger from list
16. `changeLorebook` — Modifies keyword block {id, keywords[], content}
17. `endsGame` — Terminates session

### P0b: Add Missing World Fields

**Branch:** `p0/add-missing-world-fields`
**Files:** `index.js`, `schema.md`, `draft_schema.md`, `SKILL.md`

Missing fields:
- Victory/defeat: `victoryCondition`, `victoryText`, `defeatCondition`, `defeatText`
- `designNotes` — Author notes, not sent to AI
- Player permissions: 6 boolean toggles (name, description, skills, portraits, tracked items)
- `enableAISpecificInstructionBlocks` — Restrict EIBs to specific AI models
- NPC `img_appearance` / `img_clothing` — In decompiler but not schema docs

---

## P1: High Impact — New Tools & Templates

### P1a: `validate_world` MCP Tool (DONE)

Implemented in PR #1. Validates world JSON files with 6 error checks, 6 warning checks, and 6 info checks. Integrated as a post-compile step in all 6 command files and all SKILL.md workflows.

### P1b: `audit_world` MCP Tool (DONE)

Implemented in PR #3. Performs 8 analysis types: token cost estimation, instruction density, keyword block coverage, tracked item analysis, trigger chain visualization with cycle detection, NPC redundancy detection, image instruction efficiency, and concrete optimization suggestions.

### P1c: Pre-Built Mechanic Templates

**Rationale:** The inject-logic command is a stub. The wiki documents 12+ community-proven patterns.

**Templates to build (from wiki community patterns):**

1. **Time Tracking System**
   - Tracked item: `current_time` (text, ai_only)
   - Update instructions: "Update with ISO 8601 timestamp each turn"
   - Description request addition: "Always write whereWhen at start of outcomeDescription"

2. **Skill Leveling (XP) System**
   - Per-skill tracked items: `xp_[skill_name]` (number, ai_only, 0-100)
   - Update instructions for XP gain based on usage/difficulty/success
   - Trigger per skill: fires when XP >= 100, resets XP by 100, `changeSkill` +1
   - Instruction block explaining the leveling mechanic

3. **Every-N-Turns Trigger Pattern**
   - Formula: `trunc((N - ((turn_number - 1) % N)) / N) * 100` with random chance field
   - Parameterized: user specifies N and the effect

4. **Delay Timer / Cooldown System**
   - Number tracked item incrementing each turn
   - Trigger gates on value > threshold; resets on fire

5. **Location Tracker**
   - Text tracked item auto-updated with current location
   - Triggers that fire on specific location matches

6. **NPC Thinking Instructions**
   - secretInfo blocks with character-limited NPC internal monologues
   - Instruction for AI to write NPC plans/thoughts each turn

7. **Secret Scheme Record (from wiki user Ridgtof)**
   - Structured NPC plot tracking
   - Discovery levels: Hidden → Detected → Suspicious → Alerted
   - Status: New → Planning → Progressing → Executing → Complete/Foiled

8. **Storytelling Style Shift**
   - Trigger-based switching between Author Styles
   - E.g., "Slice of Life" ↔ "Action" based on tracked item or situation

9. **Random Event Selection**
   - Numbered lists in keyword/instruction blocks
   - Combined with `<<1dX>>` dice notation in trigger text

10. **Event Framework (from wiki user Sheena-Tiger)**
    - Three parallel event layers: Story, Random, Continuous
    - EIBs, tracked items, and trigger chains per layer

### P1d: Enhanced `add_trigger` MCP Tool (DONE)

Implemented in PR #2. Rewrote add_trigger to accept arrays of conditions/effects, support all 9 condition types and 17 effect types, validate types against known enums, auto-coerce data types, and support meta-fields (canTriggerMoreThanOnce, prerequisites, blockers). Backwards compatible with legacy single-condition/effect parameters. Also updated draft_schema.md with trigger meta-field sub-fields.

---

## P2: Quality of Life

### P2a: Dedicated Entity MCP Tools (DONE)

Implemented in PR #5. Added 7 new MCP tools: `add_character`, `add_npc`, `add_tracked_item` for creating entities, and `modify_character`, `modify_npc`, `modify_tracked_item`, `modify_trigger_event` for updating existing entities by name. All tools preserve existing IDs, validate enums and skill values, and share extracted validation helpers.

### P2b: Fix Duplicated parseDraft Logic (DONE)

Implemented in PR #6. Consolidated the `parseDraft` helper and the inline parser in `compile_draft` into a single shared function. `compile_draft` now calls `parseDraft` directly, eliminating ~159 lines of duplicated code. Updated `parseDraft` to use `crypto.randomUUID()` for real IDs.

### P2c: Improved Story Export Parsing

The `extract_spinoff.cjs` script only extracts the last turn. Enhance to:
- Parse ALL turns with structured data extraction
- Track character arc progression (skill changes, personality evolution)
- Track tracked item value evolution over time
- Identify key narrative events (trigger activations, objective changes)
- Generate a "story state snapshot" for any turn range
- Output structured JSON suitable for sequel-world synthesis

### P2d: `compare_worlds` MCP Tool (DONE)

Implemented in PR #4. Compares two world JSON files with structured diff output: root field changes with content snippets, entity-level adds/removes/modifications across all 6 array types, and summary counts. Integrated into SKILL.md workflows (Version/Update, Spinoff, Sequel, Modify) and command skill files.

---

## P3: Nice to Have

### P3a: Migrate commands/ to skills/ Format (DONE)

Implemented in PR #7. Migrated all 6 command files to `skills/<name>/SKILL.md` format. Git detected 100% renames (content byte-for-byte identical). Deleted the `commands/` directory. Updated CLAUDE.md and README.md to reflect new paths.

### P3b: Chub AI Lorebook Import (PENDING)

The wiki mentions Infinite Worlds supports Chub AI Lorebook JSON format for keyword blocks. Add an `import_lorebook` MCP tool that:
- Reads a Chub AI Lorebook JSON file
- Converts entries to Infinite Worlds `loreBookEntries` format
- Appends to existing world JSON

### P3c: Refactor index.js into Multi-File Module Structure (DONE)

Merged on branch `p3c/refactor-index`. Split 1,620-line monolith into 7 files:

- `index.js` (37 lines) — Server setup, dispatch map, transport
- `lib/helpers.js` (131 lines) — Shared utilities, constants (ROOT_FIELDS, VALID_*_TYPES, ENTITY_ARRAYS), successResponse(), loadWorld(), stripIds()
- `lib/tools.js` (192 lines) — Tool definitions array
- `lib/handlers/draft.js` (510 lines) — parseDraft, compile_draft, decompile_json, read_draft_section, update_draft_section, get_diff_summary
- `lib/handlers/entities.js` (114 lines) — add_instruction_block, add_trigger
- `lib/handlers/validation.js` (498 lines) — validate_world, audit_world
- `lib/handlers/utility.js` (178 lines) — scaffold_world, confirm_path, compare_worlds

Verified with 23-test parity harness (`test-parity.mjs`) comparing all 12 tools against original monolith — all passing.

---

## Research Sources

### Example Worlds Analyzed (from ~/personal_project/infinite_worlds_stories)
- **How The Turns Table (HTTT)** — 5 variants, complex psychological drama with obedience mechanics, 5 tracked items, elaborate instruction blocks, 250+ turn story exports
- **HTTT Melanie The Recruiter** — 13 version variants, advanced hypnosis mechanics, multi-target management, specialized skills
- **The World is a Stage** — Supervillain/magician world, explicit victory condition (hypnotize 10 guardians), gadget system, structured heist narrative

### Wiki Research
- Full platform feature documentation across 89 pages
- 17 active AI models documented (from Wildcat to Massivecat)
- Complete trigger system (9 conditions, 15 effects)
- Community patterns and advanced techniques
- Image generation system (Flux.1, Manticore, Wyvern + LoRAs)
- Memory system architecture (STM, LTM, Summary AI)
- Credit/token cost model

### Key Observations from World Analysis
1. Worlds undergo extensive iteration (13 versions for Melanie)
2. Instruction blocks commonly used as override mechanisms ("NO ROBOTIC ANALYSIS TALK")
3. Complex tracked items use XML dataType for structured state
4. Image generation instructions are major token consumers
5. Description Request is "extremely powerful" — used for POV, tense, naming, secretInfo enforcement
6. All examined worlds use 5 skills on a 0-5 scale
7. `whereWhen` time tracking is a common concern across worlds
