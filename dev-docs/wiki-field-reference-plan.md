# Wiki Field Reference Documentation Plan

**Branch:** `docs/wiki-field-reference`
**Worktree:** `.worktrees/wiki-field-reference`
**Status:** Ready for implementation

## Problem

When the `/scaffold-world` and `/draft-world` commands run, the agent generating content for each field has no platform-specific guidance. The current `design_guide.md` gives 1–2 line descriptions of each field. The richer reference files (`schema.md`, `efficiency_guide.md`, `ai_mechanics.md`) exist but no skill prompt tells the agent to load them when working on a specific field. The result is generated worlds that don't reflect how the platform actually behaves — e.g., writing victory/defeat conditions as if the AI can see them during play (it cannot), or writing NPCs without understanding that Brief Summary is the ONLY field visible to the AI until the character appears.

## Chosen Approach: Section Files + On-Demand Loading (Approach B)

Create one reference file per wiki section (10 total) under `skills/world-architect/references/sections/`. Update all skill prompts that interact with world fields to include a lookup table that tells the agent which file to load before drafting content for a given field.

**Why this over alternatives:**
- Maps exactly to the wiki's organization — easy to extend and maintain
- Each file is focused (60–120 lines) so loading one doesn't waste context on irrelevant fields
- On-demand loading keeps scaffold-world and draft-world token-efficient
- Clear ownership: one section = one file = one update point

---

## Wiki Research Summary

The following was scraped from https://infiniteworlds.mywikis.wiki/wiki/World_editing and all linked section pages on 2026-05-02. This is the raw platform knowledge each section file must encode.

### Section 1: Introducing the Story
Fields: `title`, `description`, `background`, `firstInput`, `objective`

- **Title/Description/Cover Image** are user-facing only — they do NOT influence the storyteller AI
- **Background**: shown to players before turn 1. The storyteller AI receives it *until the first Summary event* (turn 8), after which the Summary AI incorporates it into game summaries and Background is no longer directly sent
- **First Action** (`firstInput`): single-use AI prompt resembling a player action; sets the opening scene. Can be modified via trigger effects (`changeFirstAction`)
- **Objective**: displayed to players at end of turn 1 as a message. The AI receives it every turn with explicit instructions that it is the player's goal — described as "a very powerful tool in the hands of a world author." Modifiable via `changeObjective` trigger effect. Changing the objective mid-game is described as "exceptionally helpful for silently modifying the objective to convince the AI to carry out elements that might be contrary to the desires of the player character"

### Section 2: Main Instructions
Fields: `instructions`, `instructionBlocks`, `authorStyle`, `designNotes`, `nsfw`, `contentWarnings`

- **Main Instructions**: the primary block on which all other decision-making is built. Length directly impacts token cost
- **Author Style**: the AI "adopts the role and approach that the instructions appear to use/assign them." A notable technique: explicitly stating AI capabilities (e.g. "you excel at mathematical operations") actually improves AI performance at those tasks
- **Extra Instruction Blocks (EIBs)**: separated and appended after main instructions; can be modified via `changeInstructionBlock` trigger effects for complex game states; AI-specific EIBs allow model-specific instruction variants
- **Design Notes**: completely excluded from AI processing — personal author notes only
- **Mature Content Flag** (`nsfw`): addresses thematic sorting for the platform's world browser, NOT controlling AI behavior during play
- **Content Warnings**: comma-separated themes users must acknowledge before gameplay begins

### Section 3: Image Style
Fields: `imageModel`, `imageStyle`, `imageStyleCharacterPre`, `imageStyleCharacterPost`, `imageStyleNonCharacterPre`, `imageStyleNonCharacterPost`

- Two model type categories: **Natural Language Models** (Flux.1 Schnell, Manticore, Wyvern) vs **Tag-based models**
- Natural language models use wrapper fields: "Prompt Beginning" (Pre) and "Prompt Ending" (Post)
- Word limits: **Flux ~300 words**, **Manticore ~400 words** before prompt elements are dropped
- Style fusion technique: e.g. "mixture of Vincent van Gogh and Banksy"
- Layered descriptions: "layer 1 (foreground), layer 2 (midground), layer 3 (background)"
- **Flux-specific LoRA keywords**: `IWDefault`, `IWClassic`, `IWAnime`, `IWRemoveNudityWordsWhenNoNudity`
- **Manticore-specific keywords**: `IWUpsaleFace`, `IWUpsaleFaceSmooth`, `IWBeautiful`, `IWBeautiful2`
- Image style settings do NOT influence how the storyteller AI generates image instructions

### Section 4: Player Character Options
Fields: `skills`, `possibleCharacters`, player permission booleans

- **Skills**: rated 0–5; used by the storyteller AI to evaluate whether player actions succeed/fail. Typical worlds have 3–5 skills. **There is no way to describe skills beyond their name in Player Character Options** — if skill descriptions are needed, put them in Main Instructions
- **Skill scale**: 0=Incapable, 1=Incompetent, 2=Unskilled, 3=Competent, 4=Highly Skilled, 5=Exceptional
- At least 1 player character and 1 skill are required to run a world
- The AI uses the character name to avoid naming other characters the same thing
- Character description "is passed to the AI every turn, so it always influences the AI's decisions and processing"
- Portrait: built-in generation prompts are NOT saved and do NOT affect in-game illustrations. For consistent appearance in gameplay images, describe the character in the Description field or use an Other Characters entry
- **Only the selected character's information passes to the AI**; unselected characters don't appear as NPCs unless also listed in Other Characters
- Player permission defaults: canChangeName=true, canChangeDescription=true, canChangeSkills=true, canSelectOtherPortraits=**false**, canCreateNewPortrait=true, canChangeTrackedItemsStartingValues=**false**
- "It is impossible for a player to distribute more than the original total skill value"

### Section 5: Victory and Defeat
Fields: `victoryCondition`, `victoryText`, `defeatCondition`, `defeatText`

- **CRITICAL**: "The storyteller AI does not receive these triggers with any special context, and therefore is not influenced by their contents in any way while writing outputs." The AI cannot see victory/defeat conditions during play — only the platform's game engine evaluates them
- Victory ends the game but allows continuation or restart; Defeat terminates with no continuation (restart only)
- Default victory condition: "The player character has succeeded in their initial goals"
- Default defeat condition: "The player character has died"
- Users frequently disable both because the defaults are "overly aggressive" — many worlds use no victory/defeat conditions
- When these conditions are needed, authors often use all-caps emphasis (e.g. "ACTUALLY") or multiple rephrased restatements because the engine evaluation can be unreliable
- Both can be disabled via checkbox in the UI; additional end conditions can be implemented via trigger effects (`endsGame`)

### Section 6: Other Characters (NPCs)
Fields: `NPCs` array — each entry: `name`, `one_liner`, `detail`, `appearance`, `location`, `secret_info`, `names`, `img_appearance`, `img_clothing`

- **Brief Summary** (`one_liner`): **the ONLY NPC field visible to the AI until the turn after the character (or their location) is first mentioned.** All other fields are invisible until then. This must be concise but high-signal: personality, defining physical features, role
- **Character Detail** (`detail`): the primary section for comprehensive character development — only loaded after first mention
- **Appearance**: the storytelling AI "frequently ignores" these specifications — do not rely on this field for narrative consistency; put critical appearance details in the character description or instructions instead
- **Secret Information** (`secret_info`): carries "less influence on the AI than the other sections" — may be left blank; good for the Summary AI but not a strong enforcement mechanism
- **Full List of Names** (`names`): comma-separated aliases prevent the AI treating different name forms as separate characters. Example: "Dr. Sharon Stone, Dr. Stone, Sharon Stone, Sharon"
- **Image AI fields** (`img_appearance`, `img_clothing`): the image AI operates independently from the narrative AI — explicit appearance details in these fields prevent visual-narrative disconnects
- The character database is populated at game start and never modified mid-game from the Other Characters section; it updates every 6 turns (starting turn 8) when the Summary AI runs

### Section 7: Keyword Instruction Blocks
Fields: `loreBookEntries` — each entry: `name`, `keywords`, `content`

- **Keyword matching is substring, case-insensitive**: the keyword "hat" will match "whatever" — partial matches count. This is a common footgun; keep keywords specific
- Keywords must appear in player input OR AI output to trigger — a keyword only in Main Instructions will NOT trigger the block
- When player input contains a keyword: block activates for that turn's response. When AI output contains a keyword: block activates the FOLLOWING turn
- **3-turn injection window**: once triggered, the KIB content remains active for the next 3 turns
- **CRITICAL**: "Until triggered, the AI will have no awareness of its existence, let alone its content." This creates a design paradox: if a topic is never mentioned, its KIB never fires. Authors may need brief Main Instructions references to ensure topics surface organically
- KIBs accept multiple keywords per block (keyword arrays); the first key becomes the block's display name
- Best used for: deep world lore, location descriptions, faction details, niche mechanical rules — content players may never encounter

### Section 8: Tracked Items
Fields: `trackedItems` — each entry: `name`, `dataType`, `visibility`, `description`, `updateInstructions`, `initialValue`, `initialValueBasedOnPC`, `autoUpdate`

- **Data types**: `text` (words, comma-separated lists), `number` (quantities, scores), `xml` (advanced, complex structures)
- **Visibility options**: `everyone`, `ai_only`, `player_only`, `nobody`
- **CRITICAL**: Items invisible to the AI (`player_only`, `nobody`) cannot auto-update — only trigger events can modify them
- **10,000-character output limit** per tracked item
- **Reference syntax**: `<<item_name>>` — spaces become underscores, text is lowercase. Example: an item named "Gold Coins" is referenced as `<<gold_coins>>`
- `autoUpdate` can be disabled to give full control to trigger events
- **Initial value options**: fixed value, character-dependent (set in Player Character Options), or player-selectable from a menu during character creation
- Authors can simulate tracked items using `secretInfo` variables for greater control, particularly for triggering events or managing complex data structures

### Section 9: Trigger Events
Fields: `triggerEvents` — conditions + effects using `{ type, data }` structure

**JSON structure**: Each trigger effect and condition uses `{ "id": "...", "type": "...", "data": ... }` format. The `type` string identifies the operation; `data` contains the payload.

**All condition types (from `lib/helpers.js` VALID_CONDITION_TYPES):**
- `triggerOnEvent` — AI-evaluated free-form situation string. Max 10 custom event conditions per world. Most flexible but can produce false positives/negatives
- `triggerOnTurn` — fires when turn number >= specified integer
- `triggerOnStartOfGame` — fires before turn 0; some effects are locked/unlocked compared to normal triggers
- `triggerOnCharacter` — restricts to specific player characters by `characterId` (not name)
- `triggerOnTrackedItem` — operators for numbers: `at_least`, `is_exactly`, `at_most`; for text/xml: `contains`. Supports `and`/`or` compound logic
- `triggerOnRandomChance` — integer 1–100, percentage chance per eligible turn

**All effect types (from `lib/helpers.js` VALID_EFFECT_TYPES):**
- `scriptedText` — appends message to `outcomeDescription` after turn resolution
- `effectTellAIWhatToDo` — one-turn AI guidance; most reliable effect for directing narrative
- `effectGiveInfo` — writes to `secretInfo`; suggestive, not directive; Summary AI weights it heavily
- `changeAdventureBackground` — replaces displayed background text
- `changeInstructions` — fully replaces main instructions (use with caution — no revert without another trigger)
- `changeInstructionBlock` — replaces a specific EIB by id; surgical alternative to `changeInstructions`
- `changeAuthorStyle` — fully replaces author style
- `changeDescriptionInstructions` — fully replaces description request
- `changeObjective` — replaces player objective; AI prioritizes this field strongly
- `changeVictoryCondition` — `{ condition, text, alreadyFired }` object
- `changeDefeatCondition` — `{ condition, text, alreadyFired }` object
- `changeFirstAction` — modifies the opening turn prompt; pairs with `changeAdventureBackground`
- `changeName` — replaces player character name
- `changeDescription` — replaces player character description
- `effectChangePCSkill` — `{ name, amount, minmax, increase }` object; adjusts one skill level per trigger
- `setTrackedItemsValue` — batch update tracked items; numbers: set/add/subtract; text/xml: set/add/subtract/replace
- `randomTriggers` — randomly fires one trigger from a list of IDs; ignores conditions except `canTriggerMoreThanOnce`. Used to work around the single-effect-per-trigger limit via chaining
- `changeLorebook` — replaces a KIB's keywords and content by id; one-turn delay before replacement
- `endsGame` — terminates the session; `canContinueEndedGame` companion field allows post-end continuation

**Key constraints:**
- ALL conditions on a single trigger use AND logic — every condition must be met simultaneously
- Triggers without `canTriggerMoreThanOnce: true` fire exactly once per playthrough (the default)
- `prerequisites` and `blockers` reference trigger `id` values (not names); only recognize triggers that fired earlier in the same evaluation pass
- Pre-game (`triggerOnStartOfGame`) triggers have different available effects than normal triggers
- Variable replacement syntax `<<item_name>>` works in all effect data string fields

**Wiki vs codebase discrepancy note:** The wiki listed `giveGuidance` and `addSecretInfo` as field names — these are INCORRECT. The authoritative names from `lib/helpers.js` are `effectTellAIWhatToDo` and `effectGiveInfo`. The wiki also listed `effectPresentChoice`, `effectRequestInput`, and `effectModifyTrackedItemDetails` as effect types — these do NOT appear in `lib/helpers.js` VALID_EFFECT_TYPES or anywhere in the plugin codebase. Do not add them to `schema.md`; they may be platform features not yet supported by this plugin.

### Section 10: Misc Advanced Features
Fields: `descriptionRequest`, `summaryRequest`

- **Description Request** (`descriptionRequest`): described as "one of the most powerful and therefore important fields available to a world author." Controls how the storyteller AI writes `outcomeDescription`, `secretInfo`, and potentially tracked items
- **Default text** (applied when field is empty): "Briefly describe the immediate results of my action, without any preamble or reminding me of who my character is. Describe any dialogue in full. Describe the physical appearance of any newly introduced characters in detail. Remember that things may go well - or very badly - for my character. Please write your description over several paragraphs." Any custom text **completely overwrites** this default
- Can enforce: point-of-view ("Always write in first-person present tense"), tense, naming conventions, placement of information into specific fields like `secretInfo`
- The AI interprets instructions literally — even unusual ones work
- Can force information into `secretInfo` via explicit instruction
- **Summary Request** (`summaryRequest`): directs the Summary AI (runs every 6 turns starting turn 8) on focus areas, character record handling, plot thread tracking, detail levels
- First summary at turn 8; at that point the storyteller AI cannot see Background (only 2–6 turns of recent history)
- Main summary has **1,500-word maximum** before condensation is required
- **The Summary AI cannot access Tracked Items** — important limitation for world authors
- Useful pattern: "Ensure character appearance matches illustrAppearance and illustrClothes" keeps Summary AI's character records aligned with image generation data
- Duplicate character names cause collisions in Summary AI character records

---

## Implementation Plan

### Files to Create (10 section reference files)

All files go in `skills/world-architect/references/sections/`:

1. `introducing-the-story.md` — covers `title`, `description`, `background`, `firstInput`, `objective`
2. `main-instructions.md` — covers `instructions`, `instructionBlocks`, `authorStyle`, `designNotes`, `nsfw`, `contentWarnings`
3. `image-style.md` — covers `imageModel`, `imageStyle`, all four image wrapper fields
4. `player-characters.md` — covers `skills`, `possibleCharacters`, all permission booleans
5. `victory-defeat.md` — covers `victoryCondition`, `victoryText`, `defeatCondition`, `defeatText`
6. `other-characters.md` — covers `NPCs` array and all NPC sub-fields
7. `keyword-instruction-blocks.md` — covers `loreBookEntries` and keyword mechanics
8. `tracked-items.md` — covers `trackedItems` array and all tracked item sub-fields
9. `trigger-events.md` — covers `triggerEvents`, all condition types, all effect types, constraint rules
10. `misc-advanced-features.md` — covers `descriptionRequest`, `summaryRequest`

**Content per file:** Each section file should contain:
- What the field does from the platform's perspective (not just what it is)
- How the platform engine uses it (when, how often, by which subsystem)
- What good content looks like vs. what to avoid
- Key constraints and limits (character limits, count limits, etc.)
- Relationships with other fields (e.g. Brief Summary is the only NPC field visible until first mention)
- Common pitfalls (e.g. victory/defeat AI blindness, KIB substring matching)

### Files to Update

#### 1. `skills/world-architect/references/design_guide.md`
Convert from standalone overview to a table-of-contents document. Keep the existing section summaries (they're useful at a glance) but append a "Detailed Field References" section pointing to each section file. The file should still be useful on its own — don't gut it entirely.

#### 2. `skills/world-architect/SKILL.md`
In the "Reference Materials" section (lines 82–86), add the sections directory:
```
- **[sections/](references/sections/)**: Per-section field guides with platform-specific mechanics and constraints. Load the relevant section file when working on fields in that group.
```
Also add the field-to-file lookup table (see below).

#### 3. `skills/scaffold-world/SKILL.md`
Add a "Field Reference Lookup" section after the initial setup instructions. When the agent begins generating content for each group of fields, it should load the relevant section file first.

#### 4. `skills/draft-world/SKILL.md`
Same lookup table addition as scaffold-world. The field-by-field iteration loop should instruct the agent to load the section file for the current field before drafting content or making suggestions.

#### 5. `skills/modify-world/SKILL.md`
Add the lookup table. When the user selects a specific field to modify, the agent should load the relevant section file before presenting current value and asking for changes.

#### 6. `skills/sequel-world/SKILL.md`
Add the lookup table to the "Update Draft Markdown" section. The agent should load the relevant section file before proposing content for each field during the field-by-field walkthrough.

#### 7. `skills/spinoff-world/SKILL.md`
Add the lookup table to the field-by-field refinement section. Same pattern as sequel-world.

#### 8. `commands/infinite-worlds-architect/scaffold-world.toml`
Update the prompt to include the field reference lookup instruction (mirrors SKILL.md update).

#### 9. `commands/infinite-worlds-architect/draft-world.toml`
Same update as scaffold-world.toml.

### The Field-to-File Lookup Table

This standard block should be added to all skill prompts and command prompts that do field-by-field work:

```
## Field Reference Lookup

Before drafting or modifying content for any field, load the corresponding reference file:

| Fields | Load before working |
|---|---|
| Title, Description, Background, First Action, Objective | `references/sections/introducing-the-story.md` |
| Main Instructions, Extra Instruction Blocks, Author Style, Design Notes, NSFW, Content Warnings | `references/sections/main-instructions.md` |
| Image Model, Image Style, Image Style (all wrapper fields) | `references/sections/image-style.md` |
| Skills, Possible Characters, Player Permissions | `references/sections/player-characters.md` |
| Victory Condition, Victory Text, Defeat Condition, Defeat Text | `references/sections/victory-defeat.md` |
| Other Characters (NPCs) | `references/sections/other-characters.md` |
| Keyword Instruction Blocks | `references/sections/keyword-instruction-blocks.md` |
| Tracked Items | `references/sections/tracked-items.md` |
| Trigger Events | `references/sections/trigger-events.md` |
| Description Request, Summary Request | `references/sections/misc-advanced-features.md` |

Load the file using the Read tool. Do not proceed to draft or propose content for a field until you have read its reference file.
```

Note: For scaffold-world specifically (which generates all fields in one pass from a single prompt), the agent should load all relevant section files upfront before generating any content, since it doesn't do field-by-field iteration.

---

## Out of Scope

- **Schema.md field name corrections**: The current `schema.md` field names are already correct. The wiki had wrong names (`giveGuidance`, `addSecretInfo`) — do not change `schema.md` based on wiki alone
- **Adding unverified wiki effect types**: `effectPresentChoice`, `effectRequestInput`, `effectModifyTrackedItemDetails` are not in `VALID_EFFECT_TYPES` — do not add to docs without verifying against real world JSON exports
- **inject-logic skill**: Not a field-authoring skill; doesn't need the lookup table
- **Fixing `effectShowMessage`/`effectSetTrackedItemValue` in test files**: Pre-existing schema drift in older test files; out of scope

---

## Context for Implementing Agent

The plugin is a Claude Code MCP server (`index.js`) serving several custom commands for authoring Infinite Worlds world JSON files. The reference documentation lives in `skills/world-architect/references/` and is read by agents via the Claude Code `Read` tool (not automatically loaded — agents must be explicitly told which files to read).

All skill files are in `skills/<name>/SKILL.md`. Command files are in `commands/infinite-worlds-architect/<name>.toml` — their `prompt` field contains the text injected into the agent when the command is invoked. The TOML command prompts and the SKILL.md files often overlap in content (the commands are generated from the skills via `scripts/build-commands.js`).

**Check `scripts/build-commands.js`** before editing `.toml` files directly — if commands are auto-generated from skill files, edit the skill files only and regenerate the commands.

The worktree is at `.worktrees/wiki-field-reference` on branch `docs/wiki-field-reference`. All implementation should happen in that worktree. When done, open a PR from `docs/wiki-field-reference` to `master`.

See `dev-docs/subagent-prompt-requirements.md` for required prompt block if spawning subagents.
See `dev-docs/pr-review-protocol.md` for PR review protocol.
