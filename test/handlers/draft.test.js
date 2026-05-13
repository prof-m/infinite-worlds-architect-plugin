/**
 * Tests for lib/handlers/draft.js
 * Covers parseDraft (via compile_draft), compile_draft, decompile_json,
 * read_draft_section, update_draft_section, and get_diff_summary.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  compile_draft,
  create_sub_field,
  delete_draft_sub_field,
  decompile_json,
  enable_story_grounded_mode,
  read_draft_section,
  rename_sub_field,
  splitSubFields,
  update_draft_section,
  get_diff_summary,
} from '../../lib/handlers/draft.js';
import { writeWorld } from '../../lib/helpers.js';

let tmpDir, draftPath, worldPath;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-draft-'));
  draftPath = path.join(tmpDir, 'draft.md');
  worldPath = path.join(tmpDir, 'world.json');
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const simpleDraft = () => `# Title
My World

# Description
A test description

# Background
A rich background

# Main Instructions
Do the right thing

# Author Style
Terse and punchy

# Objective
Save the world

# First Action
You wake up in a tavern.

# NSFW
false

# Content Warnings
None

# Skills
- Combat
- Stealth

# Player Permissions
Can Change Name: true
Can Change Description: false
Can Change Skills: true
Can Select Other Portraits: false
Can Create New Portrait: true
Can Change Tracked Items Starting Values: false

# Enable AI Specific Instruction Blocks
false
`;

const simpleDraftGrounded = () => '<!-- draft_mode: story_grounded -->\n' + simpleDraft();

const minimalWorld = (overrides = {}) => ({
  title: 'Base World',
  description: 'Base description',
  background: 'Base background',
  instructions: 'Base instructions',
  authorStyle: 'Neutral',
  possibleCharacters: [],
  NPCs: [],
  instructionBlocks: [],
  loreBookEntries: [],
  trackedItems: [],
  triggerEvents: [],
  ...overrides,
});

// ---------------------------------------------------------------------------
// compile_draft — basic round-trip
// ---------------------------------------------------------------------------

describe('compile_draft', () => {
  it('compiles a minimal draft and writes valid JSON', async () => {
    await fs.writeFile(draftPath, simpleDraft());
    const result = await compile_draft({ draftPath, outputPath: worldPath });

    expect(result.content[0].text).toContain('compiled successfully');
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.title).toBe('My World');
    expect(world.description).toBe('A test description');
    expect(world.background).toBe('A rich background');
    expect(world.instructions).toBe('Do the right thing');
    expect(world.authorStyle).toBe('Terse and punchy');
    expect(world.objective).toBe('Save the world');
    expect(world.firstInput).toBe('You wake up in a tavern.');
    expect(world.nsfw).toBe(false);
  });

  it('parses skills array', async () => {
    const draft = `# Title\nWorld\n# Background\nBg\n# Main Instructions\nInst\n# Skills\n- Combat\n- Stealth\n- Persuasion\n`;
    await fs.writeFile(draftPath, draft);
    await compile_draft({ draftPath, outputPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.skills).toEqual(['Combat', 'Stealth', 'Persuasion']);
  });

  it('parses player permissions booleans', async () => {
    await fs.writeFile(draftPath, simpleDraft());
    await compile_draft({ draftPath, outputPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.canChangeCharacterName).toBe(true);
    expect(world.canChangeCharacterDescription).toBe(false);
    expect(world.canChangeCharacterSkills).toBe(true);
    expect(world.canSelectOtherPortraits).toBe(false);
    expect(world.canCreateNewPortrait).toBe(true);
    expect(world.canChangeTrackedItemsStartingValues).toBe(false);
  });

  it('parses NSFW true', async () => {
    const draft = `# Title\nWorld\n# Background\nBg\n# Main Instructions\nInst\n# NSFW\ntrue\n`;
    await fs.writeFile(draftPath, draft);
    await compile_draft({ draftPath, outputPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.nsfw).toBe(true);
  });

  it('parses Enable AI Specific Instruction Blocks true', async () => {
    const draft = `# Title\nW\n# Background\nB\n# Main Instructions\nI\n# Enable AI Specific Instruction Blocks\ntrue\n`;
    await fs.writeFile(draftPath, draft);
    await compile_draft({ draftPath, outputPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.enableAISpecificInstructionBlocks).toBe(true);
  });

  it('parses Possible Characters section', async () => {
    const draft = `# Title\nW\n# Background\nB\n# Main Instructions\nI\n# Possible Characters\n## Hero\nDescription: A brave hero\nPortrait: hero.png\nSkills:\n- Combat: 4\n- Stealth: 2\n`;
    await fs.writeFile(draftPath, draft);
    await compile_draft({ draftPath, outputPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.possibleCharacters.length).toBe(1);
    expect(world.possibleCharacters[0].name).toBe('Hero');
    expect(world.possibleCharacters[0].description).toBe('A brave hero');
    expect(world.possibleCharacters[0].skills.Combat).toBe(4);
  });

  it('parses Other Characters section', async () => {
    const draft = `# Title\nW\n# Background\nB\n# Main Instructions\nI\n# Other Characters\n## Bob\nBrief Summary: A friendly innkeeper\nCharacter Detail: Runs the local inn\nAppearance: Stout and bearded\nLocation: The Inn\nSecret Information: Knows where the treasure is\nFull List of Names: Robert, Bob\n`;
    await fs.writeFile(draftPath, draft);
    await compile_draft({ draftPath, outputPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.NPCs.length).toBe(1);
    expect(world.NPCs[0].name).toBe('Bob');
    expect(world.NPCs[0].one_liner).toBe('A friendly innkeeper');
    expect(world.NPCs[0].names).toEqual(['Robert', 'Bob']);
  });

  it('parses Extra Instruction Blocks section', async () => {
    const draft = `# Title\nW\n# Background\nB\n# Main Instructions\nI\n# Extra Instruction Blocks\n## Combat Rules\nContent: Strike fast, strike true.\n`;
    await fs.writeFile(draftPath, draft);
    await compile_draft({ draftPath, outputPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.instructionBlocks.length).toBe(1);
    expect(world.instructionBlocks[0].name).toBe('Combat Rules');
  });

  it('parses Keyword Instruction Blocks section', async () => {
    const draft = `# Title\nW\n# Background\nB\n# Main Instructions\nI\n# Keyword Instruction Blocks\n## Dragon Lore\nKeywords: dragon, wyrm, serpent\nContent: Dragons are ancient beings.\n`;
    await fs.writeFile(draftPath, draft);
    await compile_draft({ draftPath, outputPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.loreBookEntries.length).toBe(1);
    expect(world.loreBookEntries[0].keywords).toContain('dragon');
  });

  it('parses Tracked Items section', async () => {
    const draft = `# Title\nW\n# Background\nB\n# Main Instructions\nI\n# Tracked Items\n## Health\nData Type: number\nVisibility: everyone\nDescription: Player health points\nUpdate Instructions: Decrease when hit\nInitial Value: 100\n`;
    await fs.writeFile(draftPath, draft);
    await compile_draft({ draftPath, outputPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.trackedItems.length).toBe(1);
    expect(world.trackedItems[0].name).toBe('Health');
    expect(world.trackedItems[0].dataType).toBe('number');
    expect(world.trackedItems[0].initialValue).toBe('100');
  });

  it('injects autoUpdate and initialValueBasedOnPC defaults on tracked items', async () => {
    const draft = `# Title\nW\n# Background\nB\n# Main Instructions\nI\n# Tracked Items\n## Gold\nData Type: number\nInitial Value: 0\n`;
    await fs.writeFile(draftPath, draft);
    await compile_draft({ draftPath, outputPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.trackedItems[0].autoUpdate).toBe(true);
    expect(world.trackedItems[0].initialValueBasedOnPC).toBe('same');
  });

  it('preserves autoUpdate from original when re-compiling', async () => {
    const original = minimalWorld({
      trackedItems: [{ id: 'ti1', name: 'Gold', dataType: 'number', autoUpdate: false, initialValueBasedOnPC: 'same', initialValue: '0' }],
    });
    await writeWorld(worldPath, original);
    const draft = `# Title\nW\n# Background\nB\n# Main Instructions\nI\n# Tracked Items\n## Gold\nData Type: number\nInitial Value: 0\n`;
    await fs.writeFile(draftPath, draft);
    await compile_draft({ draftPath, outputPath: worldPath, originalPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.trackedItems[0].autoUpdate).toBe(false);
  });

  it('injects positionInList on tracked items from array index', async () => {
    const draft = `# Title\nW\n# Background\nB\n# Main Instructions\nI\n# Tracked Items\n## Alpha\nData Type: text\nInitial Value: a\n## Beta\nData Type: text\nInitial Value: b\n`;
    await fs.writeFile(draftPath, draft);
    await compile_draft({ draftPath, outputPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.trackedItems[0].positionInList).toBe(0);
    expect(world.trackedItems[1].positionInList).toBe(1);
  });

  it('preserves positionInList from original tracked items when present', async () => {
    const original = minimalWorld({
      trackedItems: [{ id: 'ti1', name: 'Gold', dataType: 'number', positionInList: 5, initialValue: '0' }],
    });
    await writeWorld(worldPath, original);
    const draft = `# Title\nW\n# Background\nB\n# Main Instructions\nI\n# Tracked Items\n## Gold\nData Type: number\nInitial Value: 0\n`;
    await fs.writeFile(draftPath, draft);
    await compile_draft({ draftPath, outputPath: worldPath, originalPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.trackedItems[0].positionInList).toBe(5);
  });

  it('injects positionInList on NPCs from array index', async () => {
    const draft = `# Title\nW\n# Background\nB\n# Main Instructions\nI\n# Other Characters\n## Alice\n### Brief Summary\nFirst NPC\n## Bob\n### Brief Summary\nSecond NPC\n`;
    await fs.writeFile(draftPath, draft);
    await compile_draft({ draftPath, outputPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.NPCs[0].positionInList).toBe(0);
    expect(world.NPCs[1].positionInList).toBe(1);
  });

  it('parses canTriggerMoreThanOnce: true from trigger event draft', async () => {
    const draft = `# Title\nW\n# Background\nB\n# Main Instructions\nI\n# Trigger Events\n## Daily Tick\n### Conditions\n- triggerOnTurn:\n\`\`\`\n1\n\`\`\`\n### Effects\n- scriptedText:\n\`\`\`\nA day passes.\n\`\`\`\n### Can Trigger More Than Once\ntrue\n`;
    await fs.writeFile(draftPath, draft);
    await compile_draft({ draftPath, outputPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.triggerEvents[0].canTriggerMoreThanOnce).toBe(true);
  });

  it('sets canTriggerMoreThanOnce false when explicitly false in draft; leaves undefined when absent', async () => {
    const draftFalse = `# Title\nW\n# Background\nB\n# Main Instructions\nI\n# Trigger Events\n## Once Only\n### Conditions\n- triggerOnTurn:\n\`\`\`\n1\n\`\`\`\n### Effects\n- scriptedText:\n\`\`\`\nDone.\n\`\`\`\n### Can Trigger More Than Once\nfalse\n`;
    await fs.writeFile(draftPath, draftFalse);
    await compile_draft({ draftPath, outputPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    // Explicit false in draft must set the field so re-compile can clear an inherited true
    expect(world.triggerEvents[0].canTriggerMoreThanOnce).toBe(false);

    const draftAbsent = `# Title\nW\n# Background\nB\n# Main Instructions\nI\n# Trigger Events\n## Once Only\n### Conditions\n- triggerOnTurn:\n\`\`\`\n1\n\`\`\`\n### Effects\n- scriptedText:\n\`\`\`\nDone.\n\`\`\`\n`;
    await fs.writeFile(draftPath, draftAbsent);
    await compile_draft({ draftPath, outputPath: worldPath });
    const world2 = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    // Absent header leaves field unset so mergeArray can preserve the value from originalPath
    expect(world2.triggerEvents[0].canTriggerMoreThanOnce).toBeUndefined();
  });

  it('clears canTriggerMoreThanOnce when re-compiling with explicit false over an existing true', async () => {
    const original = minimalWorld({
      triggerEvents: [{
        id: 't1', name: 'Was Repeatable', canTriggerMoreThanOnce: true,
        triggerConditions: [{ id: 'c1', type: 'triggerOnStartOfGame', data: true, category: 'condition' }],
        triggerEffects: [{ id: 'e1', type: 'scriptedText', data: 'Again!' }],
      }],
    });
    await writeWorld(worldPath, original);
    // Decompile produces ### Can Trigger More Than Once\ntrue; author changes to false
    await decompile_json({ inputPath: worldPath, outputPath: draftPath });
    let md = await fs.readFile(draftPath, 'utf-8');
    md = md.replace('### Can Trigger More Than Once\ntrue', '### Can Trigger More Than Once\nfalse');
    await fs.writeFile(draftPath, md);
    const recompiledPath = path.join(tmpDir, 'recompiled.json');
    await compile_draft({ draftPath, outputPath: recompiledPath, originalPath: worldPath });
    const recompiled = JSON.parse(await fs.readFile(recompiledPath, 'utf-8'));
    expect(recompiled.triggerEvents[0].canTriggerMoreThanOnce).toBe(false);
  });

  it('clears prerequisites when re-compiling with an empty Prerequisites section', async () => {
    const original = minimalWorld({
      triggerEvents: [{
        id: 't1', name: 'Gated',
        prerequisites: ['trigger-a'],
        triggerConditions: [],
        triggerEffects: [],
      }],
    });
    await writeWorld(worldPath, original);
    const draftWithEmptyPrereqs = `# Title\nW\n# Background\nB\n# Main Instructions\nI\n# Trigger Events\n## Gated\n### Conditions\n### Effects\n### Prerequisites\n\n`;
    await fs.writeFile(draftPath, draftWithEmptyPrereqs);
    const recompiledPath = path.join(tmpDir, 'recompiled.json');
    await compile_draft({ draftPath, outputPath: recompiledPath, originalPath: worldPath });
    const recompiled = JSON.parse(await fs.readFile(recompiledPath, 'utf-8'));
    expect(recompiled.triggerEvents[0].prerequisites).toEqual([]);
  });

  it('preserves positionInList from original NPCs when present', async () => {
    const original = minimalWorld({
      NPCs: [{ id: 'n1', name: 'Alice', one_liner: 'First NPC', positionInList: 7 }],
    });
    await writeWorld(worldPath, original);
    const draft = `# Title\nW\n# Background\nB\n# Main Instructions\nI\n# Other Characters\n## Alice\n### Brief Summary\nFirst NPC\n`;
    await fs.writeFile(draftPath, draft);
    await compile_draft({ draftPath, outputPath: worldPath, originalPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.NPCs[0].positionInList).toBe(7);
  });

  it('parses prerequisites and blockers from trigger event draft', async () => {
    const draft = `# Title\nW\n# Background\nB\n# Main Instructions\nI\n# Trigger Events\n## Gated Event\n### Conditions\n- triggerOnTurn:\n\`\`\`\n5\n\`\`\`\n### Effects\n- scriptedText:\n\`\`\`\nGated.\n\`\`\`\n### Prerequisites\ntrigger-a, trigger-b\n### Blockers\ntrigger-c\n`;
    await fs.writeFile(draftPath, draft);
    await compile_draft({ draftPath, outputPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.triggerEvents[0].prerequisites).toEqual(['trigger-a', 'trigger-b']);
    expect(world.triggerEvents[0].blockers).toEqual(['trigger-c']);
  });

  it('merges with existing world JSON when originalPath is provided', async () => {
    const original = minimalWorld({ title: 'Original Title', designNotes: 'Keep this' });
    await writeWorld(worldPath, original);

    const draft = `# Title\nNew Title\n# Background\nNew background\n# Main Instructions\nNew instructions\n`;
    await fs.writeFile(draftPath, draft);

    await compile_draft({ draftPath, outputPath: worldPath, originalPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.title).toBe('New Title');
    // Non-overridden original field should be preserved
    expect(world.designNotes).toBe('Keep this');
  });

  it('merges possibleCharacters preserving characterId', async () => {
    const original = minimalWorld({
      possibleCharacters: [{ characterId: 'existing-id-123', name: 'Hero', description: 'old' }],
    });
    await writeWorld(worldPath, original);

    const draft = `# Title\nW\n# Background\nB\n# Main Instructions\nI\n# Possible Characters\n## Hero\nDescription: Updated description\n`;
    await fs.writeFile(draftPath, draft);

    await compile_draft({ draftPath, outputPath: worldPath, originalPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.possibleCharacters[0].characterId).toBe('existing-id-123');
    expect(world.possibleCharacters[0].description).toBe('Updated description');
  });

  it('applies default values for missing optional fields', async () => {
    const draft = `# Title\nW\n# Background\nB\n# Main Instructions\nI\n`;
    await fs.writeFile(draftPath, draft);
    await compile_draft({ draftPath, outputPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.imageModel).toBe('manticore');
    expect(world.defeatCondition.text).toBe('Your adventure ends here. Game over.');
    expect(world).not.toHaveProperty('defeatText');
  });

  it('throws for non-existent draft path', async () => {
    await expect(
      compile_draft({ draftPath: path.join(tmpDir, 'missing.md'), outputPath: worldPath })
    ).rejects.toThrow();
  });

  it('parses image style fields', async () => {
    const draft = `# Title\nW\n# Background\nB\n# Main Instructions\nI\n# Image Model\nflux-pro\n# Image Style\npainting\n# Image Style Character Pre\nportrait of\n# Image Style Character Post\nhigh detail\n`;
    await fs.writeFile(draftPath, draft);
    await compile_draft({ draftPath, outputPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.imageModel).toBe('flux-pro');
    expect(world.imageStyle).toBe('painting');
    expect(world.imageStyleCharacterPre).toBe('portrait of');
    expect(world.imageStyleCharacterPost).toBe('high detail');
  });

  it('parses victory and defeat conditions', async () => {
    const draft = `# Title\nW\n# Background\nB\n# Main Instructions\nI\n# Victory Condition\nDefeat the dragon\n# Victory Text\nYou win!\n# Defeat Condition\nHP reaches zero\n# Defeat Text\nYou lose!\n`;
    await fs.writeFile(draftPath, draft);
    await compile_draft({ draftPath, outputPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.victoryCondition).toEqual({ condition: 'Defeat the dragon', text: 'You win!', alreadyFired: false });
    expect(world.defeatCondition).toEqual({ condition: 'HP reaches zero', text: 'You lose!', alreadyFired: false });
    expect(world).not.toHaveProperty('victoryText');
    expect(world).not.toHaveProperty('defeatText');
  });

  it('preserves alreadyFired from original world on round-trip', async () => {
    const original = minimalWorld({
      victoryCondition: { condition: 'Score >= 100', text: 'You win!', alreadyFired: true },
      defeatCondition: { condition: 'Lives <= 0', text: 'You lose.', alreadyFired: false },
    });
    await writeWorld(worldPath, original);

    const draftResult = await decompile_json({ inputPath: worldPath, outputPath: draftPath });
    expect(draftResult.content[0].text).toContain('decompiled');

    const recompiledPath = path.join(tmpDir, 'recompiled.json');
    await compile_draft({ draftPath, outputPath: recompiledPath, originalPath: worldPath });
    const recompiled = JSON.parse(await fs.readFile(recompiledPath, 'utf-8'));

    expect(recompiled.victoryCondition.alreadyFired).toBe(true);
    expect(recompiled.defeatCondition.alreadyFired).toBe(false);
    expect(recompiled.victoryCondition.condition).toBe('Score >= 100');
    expect(recompiled.victoryCondition.text).toBe('You win!');
  });
});

// ---------------------------------------------------------------------------
// decompile_json
// ---------------------------------------------------------------------------

describe('decompile_json', () => {
  it('generates a markdown file from a world JSON', async () => {
    const world = minimalWorld({ title: 'Test World', description: 'Desc', background: 'BG' });
    await writeWorld(worldPath, world);

    const result = await decompile_json({ inputPath: worldPath, outputPath: draftPath });
    expect(result.content[0].text).toContain('decompiled');

    const md = await fs.readFile(draftPath, 'utf-8');
    expect(md).toContain('# Title');
    expect(md).toContain('Test World');
    expect(md).toContain('# Background');
    expect(md).toContain('BG');
  });

  it('includes table of contents', async () => {
    await writeWorld(worldPath, minimalWorld());
    await decompile_json({ inputPath: worldPath, outputPath: draftPath });
    const md = await fs.readFile(draftPath, 'utf-8');
    expect(md).toContain('# Table of Contents');
    expect(md).toContain('[Title]');
    expect(md).toContain('[Background]');
  });

  it('includes skills in output', async () => {
    const world = minimalWorld({ skills: ['Combat', 'Stealth', 'Persuasion'] });
    await writeWorld(worldPath, world);
    await decompile_json({ inputPath: worldPath, outputPath: draftPath });
    const md = await fs.readFile(draftPath, 'utf-8');
    expect(md).toContain('- Combat');
    expect(md).toContain('- Stealth');
  });

  it('includes NPCs in output', async () => {
    const world = minimalWorld({
      NPCs: [{
        id: 'npc1', name: 'Gandalf', one_liner: 'A wizard', detail: 'Very powerful',
        appearance: 'Long beard', location: 'Shire', secret_info: 'Knows all',
        names: ['Gandalf', 'Mithrandir'], img_appearance: 'old man', img_clothing: 'grey robes'
      }],
    });
    await writeWorld(worldPath, world);
    await decompile_json({ inputPath: worldPath, outputPath: draftPath });
    const md = await fs.readFile(draftPath, 'utf-8');
    expect(md).toContain('## Gandalf');
    expect(md).toContain('A wizard');
    expect(md).toContain('Mithrandir');
  });

  it('includes possible characters with skills', async () => {
    const world = minimalWorld({
      possibleCharacters: [{
        characterId: 'c1', name: 'Warrior',
        description: 'A strong fighter', portrait: 'warrior.png',
        skills: { Combat: 5, Strength: 4 }
      }],
    });
    await writeWorld(worldPath, world);
    await decompile_json({ inputPath: worldPath, outputPath: draftPath });
    const md = await fs.readFile(draftPath, 'utf-8');
    expect(md).toContain('## Warrior');
    expect(md).toContain('Combat: 5');
  });

  it('includes tracked items', async () => {
    const world = minimalWorld({
      trackedItems: [{
        id: 'ti1', name: 'Health', dataType: 'number', visibility: 'everyone',
        description: 'HP', updateInstructions: 'Decrease on hit', initialValue: '100'
      }],
    });
    await writeWorld(worldPath, world);
    await decompile_json({ inputPath: worldPath, outputPath: draftPath });
    const md = await fs.readFile(draftPath, 'utf-8');
    expect(md).toContain('## Health');
    expect(md).toContain('Data Type');
    expect(md).toContain('number');
  });

  it('includes trigger events with conditions and effects', async () => {
    const world = minimalWorld({
      triggerEvents: [{
        id: 't1', name: 'Game Start',
        triggerConditions: [{ id: 'c1', type: 'triggerOnStartOfGame', data: true, category: 'condition' }],
        triggerEffects: [{ id: 'e1', type: 'scriptedText', data: 'Welcome!' }],
      }],
    });
    await writeWorld(worldPath, world);
    await decompile_json({ inputPath: worldPath, outputPath: draftPath });
    const md = await fs.readFile(draftPath, 'utf-8');
    expect(md).toContain('## Game Start');
    expect(md).toContain('triggerOnStartOfGame');
    expect(md).toContain('scriptedText');
  });

  it('emits Can Trigger More Than Once when true in decompile', async () => {
    const world = minimalWorld({
      triggerEvents: [{
        id: 't1', name: 'Repeatable', canTriggerMoreThanOnce: true,
        triggerConditions: [{ id: 'c1', type: 'triggerOnStartOfGame', data: true, category: 'condition' }],
        triggerEffects: [{ id: 'e1', type: 'scriptedText', data: 'Again!' }],
      }],
    });
    await writeWorld(worldPath, world);
    await decompile_json({ inputPath: worldPath, outputPath: draftPath });
    const md = await fs.readFile(draftPath, 'utf-8');
    expect(md).toContain('### Can Trigger More Than Once');
    expect(md).toContain('true');
  });

  it('does not emit Can Trigger More Than Once when false or absent in decompile', async () => {
    const world = minimalWorld({
      triggerEvents: [
        {
          id: 't1', name: 'Once Only', canTriggerMoreThanOnce: false,
          triggerConditions: [], triggerEffects: [],
        },
        {
          id: 't2', name: 'Default',
          triggerConditions: [], triggerEffects: [],
        },
      ],
    });
    await writeWorld(worldPath, world);
    await decompile_json({ inputPath: worldPath, outputPath: draftPath });
    const md = await fs.readFile(draftPath, 'utf-8');
    expect(md).not.toContain('Can Trigger More Than Once');
  });

  it('emits Prerequisites and Blockers in decompile', async () => {
    const world = minimalWorld({
      triggerEvents: [{
        id: 't1', name: 'Gated',
        prerequisites: ['trigger-a', 'trigger-b'],
        blockers: ['trigger-c'],
        triggerConditions: [],
        triggerEffects: [],
      }],
    });
    await writeWorld(worldPath, world);
    await decompile_json({ inputPath: worldPath, outputPath: draftPath });
    const md = await fs.readFile(draftPath, 'utf-8');
    expect(md).toContain('### Prerequisites');
    expect(md).toContain('trigger-a, trigger-b');
    expect(md).toContain('### Blockers');
    expect(md).toContain('trigger-c');
  });

  it('round-trips canTriggerMoreThanOnce through decompile → compile', async () => {
    const original = minimalWorld({
      triggerEvents: [{
        id: 't1', name: 'Recurring', canTriggerMoreThanOnce: true,
        triggerConditions: [{ id: 'c1', type: 'triggerOnStartOfGame', data: true, category: 'condition' }],
        triggerEffects: [{ id: 'e1', type: 'scriptedText', data: 'Repeating!' }],
      }],
    });
    await writeWorld(worldPath, original);
    await decompile_json({ inputPath: worldPath, outputPath: draftPath });
    const recompiledPath = path.join(tmpDir, 'recompiled.json');
    await compile_draft({ draftPath, outputPath: recompiledPath });
    const recompiled = JSON.parse(await fs.readFile(recompiledPath, 'utf-8'));
    expect(recompiled.triggerEvents[0].canTriggerMoreThanOnce).toBe(true);
  });

  it('round-trips prerequisites and blockers through decompile → compile', async () => {
    const original = minimalWorld({
      triggerEvents: [{
        id: 't1', name: 'Gated',
        prerequisites: ['trigger-a'],
        blockers: ['trigger-b'],
        triggerConditions: [],
        triggerEffects: [],
      }],
    });
    await writeWorld(worldPath, original);
    await decompile_json({ inputPath: worldPath, outputPath: draftPath });
    const recompiledPath = path.join(tmpDir, 'recompiled.json');
    await compile_draft({ draftPath, outputPath: recompiledPath });
    const recompiled = JSON.parse(await fs.readFile(recompiledPath, 'utf-8'));
    expect(recompiled.triggerEvents[0].prerequisites).toEqual(['trigger-a']);
    expect(recompiled.triggerEvents[0].blockers).toEqual(['trigger-b']);
  });

  it('includes instruction blocks and keyword blocks', async () => {
    const world = minimalWorld({
      instructionBlocks: [{ id: 'ib1', name: 'Combat Rules', content: 'Fight fairly.' }],
      loreBookEntries: [{ id: 'lb1', name: 'Dragon Lore', keywords: ['dragon'], content: 'Dragons breathe fire.' }],
    });
    await writeWorld(worldPath, world);
    await decompile_json({ inputPath: worldPath, outputPath: draftPath });
    const md = await fs.readFile(draftPath, 'utf-8');
    expect(md).toContain('## Combat Rules');
    expect(md).toContain('## Dragon Lore');
    expect(md).toContain('dragon');
  });

  it('includes player permissions', async () => {
    const world = minimalWorld({
      canChangeCharacterName: false,
      canSelectOtherPortraits: true,
    });
    await writeWorld(worldPath, world);
    await decompile_json({ inputPath: worldPath, outputPath: draftPath });
    const md = await fs.readFile(draftPath, 'utf-8');
    expect(md).toContain('Can Change Name: false');
    expect(md).toContain('Can Select Other Portraits: true');
  });

  it('throws for non-existent world file', async () => {
    await expect(
      decompile_json({ inputPath: path.join(tmpDir, 'missing.json'), outputPath: draftPath })
    ).rejects.toThrow();
  });

  it('round-trips: compile → decompile → compile preserves title', async () => {
    await fs.writeFile(draftPath, simpleDraft());
    const compiledPath = path.join(tmpDir, 'compiled.json');
    await compile_draft({ draftPath, outputPath: compiledPath });

    const decompiledPath = path.join(tmpDir, 'decompiled.md');
    await decompile_json({ inputPath: compiledPath, outputPath: decompiledPath });

    const recompiledPath = path.join(tmpDir, 'recompiled.json');
    await compile_draft({ draftPath: decompiledPath, outputPath: recompiledPath });

    const recompiled = JSON.parse(await fs.readFile(recompiledPath, 'utf-8'));
    expect(recompiled.title).toBe('My World');
    expect(recompiled.background).toBe('A rich background');
  });
});

// ---------------------------------------------------------------------------
// read_draft_section
// ---------------------------------------------------------------------------

describe('read_draft_section', () => {
  it('reads an existing section by name', async () => {
    await fs.writeFile(draftPath, simpleDraft());
    const result = await read_draft_section({ draftPath, sectionName: 'Title' });
    expect(result.content[0].text).toBe('My World');
  });

  it('reads case-insensitively', async () => {
    await fs.writeFile(draftPath, simpleDraft());
    const result = await read_draft_section({ draftPath, sectionName: 'background' });
    expect(result.content[0].text).toBe('A rich background');
  });

  it('returns not-found message for missing section', async () => {
    await fs.writeFile(draftPath, simpleDraft());
    const result = await read_draft_section({ draftPath, sectionName: 'Nonexistent Section' });
    expect(result.content[0].text).toContain('not found');
  });

  it('reads multi-line section content', async () => {
    const draft = `# Title\nLine 1\nLine 2\nLine 3\n\n# Background\nBG\n`;
    await fs.writeFile(draftPath, draft);
    const result = await read_draft_section({ draftPath, sectionName: 'Title' });
    expect(result.content[0].text).toContain('Line 1');
    expect(result.content[0].text).toContain('Line 2');
    expect(result.content[0].text).toContain('Line 3');
  });

  it('throws for non-existent draft file', async () => {
    await expect(
      read_draft_section({ draftPath: path.join(tmpDir, 'missing.md'), sectionName: 'Title' })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// update_draft_section
// ---------------------------------------------------------------------------

describe('update_draft_section', () => {
  const validEvidence = 'CARRY_FORWARD: test fixture placeholder evidence';

  it('updates an existing section', async () => {
    await fs.writeFile(draftPath, simpleDraft());
    await update_draft_section({ draftPath, sectionName: 'Title', newContent: 'Updated Title' });

    const result = await read_draft_section({ draftPath, sectionName: 'Title' });
    expect(result.content[0].text).toBe('Updated Title');
  });

  it('adds a new section if it does not exist', async () => {
    await fs.writeFile(draftPath, simpleDraft());
    await update_draft_section({ draftPath, sectionName: 'Design Notes', newContent: 'Some design notes' });

    const result = await read_draft_section({ draftPath, sectionName: 'Design Notes' });
    expect(result.content[0].text).toBe('Some design notes');
  });

  it('preserves other sections when updating one', async () => {
    await fs.writeFile(draftPath, simpleDraft());
    await update_draft_section({ draftPath, sectionName: 'Title', newContent: 'New Title' });

    const bgResult = await read_draft_section({ draftPath, sectionName: 'Background' });
    expect(bgResult.content[0].text).toBe('A rich background');
  });

  it('returns success confirmation', async () => {
    await fs.writeFile(draftPath, simpleDraft());
    const result = await update_draft_section({ draftPath, sectionName: 'Title', newContent: 'X' });
    expect(result.content[0].text).toContain('Successfully updated');
  });

  it('throws for non-existent draft file', async () => {
    await expect(
      update_draft_section({
        draftPath: path.join(tmpDir, 'missing.md'),
        sectionName: 'Title',
        newContent: 'X',
      })
    ).rejects.toThrow();
  });

  it('updating then reading gives correct new content', async () => {
    await fs.writeFile(draftPath, simpleDraft());
    const newContent = 'Completely new background text here.';
    await update_draft_section({ draftPath, sectionName: 'Background', newContent });
    const result = await read_draft_section({ draftPath, sectionName: 'Background' });
    expect(result.content[0].text).toBe(newContent);
  });

  describe('update_draft_section (story_grounded mode)', () => {
  // Case 1: missing evidence throws
  it('case 1: throws when evidence is missing (undefined)', async () => {
    await fs.writeFile(draftPath, simpleDraftGrounded());
    await expect(
      update_draft_section({ draftPath, sectionName: 'Title', newContent: 'X' })
    ).rejects.toThrow(/requires an 'evidence' parameter/);
  });

  // Case 2: empty / whitespace-only evidence throws
  it('case 2: throws when evidence is empty string', async () => {
    await fs.writeFile(draftPath, simpleDraftGrounded());
    await expect(
      update_draft_section({ draftPath, sectionName: 'Title', newContent: 'X', evidence: '' })
    ).rejects.toThrow(/requires an 'evidence' parameter/);
  });

  it('case 2b: throws when evidence is whitespace-only', async () => {
    await fs.writeFile(draftPath, simpleDraftGrounded());
    await expect(
      update_draft_section({ draftPath, sectionName: 'Title', newContent: 'X', evidence: '   ' })
    ).rejects.toThrow(/requires an 'evidence' parameter/);
  });

  // Case 3: unknown prefix throws, message lists valid prefixes
  it('case 3: throws on unknown prefix, message names valid kinds', async () => {
    await fs.writeFile(draftPath, simpleDraftGrounded());
    await expect(
      update_draft_section({ draftPath, sectionName: 'Title', newContent: 'X', evidence: 'because I said so' })
    ).rejects.toThrow(/From Turn #/);
  });

  // Case 4: short prefixed evidence (< 10 non-ws chars after prefix) throws
  it('case 4: throws when USER_DIRECTED value is too short', async () => {
    await fs.writeFile(draftPath, simpleDraftGrounded());
    await expect(
      update_draft_section({ draftPath, sectionName: 'Title', newContent: 'X', evidence: 'USER_DIRECTED: x' })
    ).rejects.toThrow(/requires an 'evidence' parameter/);
  });

  it('case 4b: throws when CARRY_FORWARD value is too short', async () => {
    await fs.writeFile(draftPath, simpleDraftGrounded());
    await expect(
      update_draft_section({ draftPath, sectionName: 'Title', newContent: 'X', evidence: 'CARRY_FORWARD: abc' })
    ).rejects.toThrow(/requires an 'evidence' parameter/);
  });

  // Case 5: story citation accepted; file contains evidence comment
  it("case 5: story citation 'From Turn #' is accepted; draft file contains evidence comment", async () => {
    await fs.writeFile(draftPath, simpleDraftGrounded());
    const ev = "From Turn #5 Outcome: 'The hero defeats the dragon'";
    await update_draft_section({ draftPath, sectionName: 'Title', newContent: 'Dragon Story', evidence: ev });

    const raw = await fs.readFile(draftPath, 'utf-8');
    expect(raw).toContain(`<!-- evidence: ${ev} -->`);
    expect(raw).toMatch(/# Title\n<!-- evidence: From Turn #5/);
  });

  it('case 5b: From Story Metadata prefix is accepted', async () => {
    await fs.writeFile(draftPath, simpleDraftGrounded());
    const ev = 'From Story Metadata [title]: "A Great Adventure"';
    await update_draft_section({ draftPath, sectionName: 'Title', newContent: 'A Great Adventure', evidence: ev });
    const raw = await fs.readFile(draftPath, 'utf-8');
    expect(raw).toContain(`<!-- evidence: ${ev} -->`);
  });

  it('case 5c: From Turn Detail prefix is accepted', async () => {
    await fs.writeFile(draftPath, simpleDraftGrounded());
    const ev = 'From Turn Detail turns [1, 2, 3]: opening scene described';
    await update_draft_section({ draftPath, sectionName: 'Title', newContent: 'X', evidence: ev });
    const raw = await fs.readFile(draftPath, 'utf-8');
    expect(raw).toContain(`<!-- evidence: ${ev} -->`);
  });

  // Case 6: multi-line evidence is persisted on a single line
  it('case 6: multi-line evidence is encoded to single line in the comment', async () => {
    await fs.writeFile(draftPath, simpleDraftGrounded());
    const ev = 'From Turn #1 Outcome: line one\nsecond line';
    await update_draft_section({ draftPath, sectionName: 'Title', newContent: 'X', evidence: ev });
    const raw = await fs.readFile(draftPath, 'utf-8');
    expect(raw).toContain('<!-- evidence: From Turn #1 Outcome: line one\\nsecond line -->');
  });

  // Case 7: --> in evidence is escaped on write
  it('case 7: --> in evidence is escaped on write and parseDraft decodes it', async () => {
    await fs.writeFile(draftPath, simpleDraftGrounded());
    const ev = 'From Turn #2 Outcome: "see diagram --> box"';
    await update_draft_section({ draftPath, sectionName: 'Title', newContent: 'X', evidence: ev });
    const raw = await fs.readFile(draftPath, 'utf-8');
    expect(raw).not.toContain('see diagram --> box');
    expect(raw).toContain('see diagram --&gt; box');
  });

  // Case 8: replacement — updating a section that already has an evidence comment replaces it
  it('case 8: updating a section with an existing evidence comment replaces it (no duplicate)', async () => {
    await fs.writeFile(draftPath, simpleDraftGrounded());
    const ev1 = 'From Turn #1 Outcome: first citation';
    const ev2 = 'From Turn #2 Outcome: second updated citation';

    await update_draft_section({ draftPath, sectionName: 'Title', newContent: 'First', evidence: ev1 });
    await update_draft_section({ draftPath, sectionName: 'Title', newContent: 'Second', evidence: ev2 });

    const raw = await fs.readFile(draftPath, 'utf-8');
    const titleEvidenceCount = (raw.match(/# Title\n<!-- evidence:/g) || []).length;
    expect(titleEvidenceCount).toBe(1);
    expect(raw).toContain(ev2);
    expect(raw).not.toContain(ev1);
  });

  // Case 9: new section gets evidence comment
  it('case 9: appending a net-new section writes the evidence comment', async () => {
    await fs.writeFile(draftPath, simpleDraftGrounded());
    const ev = 'NO_STORY_EVIDENCE: sampled turns [1-5], no design notes found';
    await update_draft_section({ draftPath, sectionName: 'Design Notes', newContent: 'N/A', evidence: ev });

    const raw = await fs.readFile(draftPath, 'utf-8');
    expect(raw).toContain(`# Design Notes\n<!-- evidence: ${ev} -->`);
  });

  // Case 10: parseDraft parity — content parsed from a draft with evidence comments equals content from one without
  it('case 10: parseDraft content is byte-identical whether or not evidence comment present', async () => {
    const draftWithout = `# Title\nMy World\n\n# Background\nA rich background\n`;
    const draftWith = `<!-- draft_mode: story_grounded -->\n# Title\n<!-- evidence: CARRY_FORWARD: test -->\nMy World\n\n# Background\n<!-- evidence: CARRY_FORWARD: test -->\nA rich background\n`;

    const pathWithout = path.join(tmpDir, 'without.md');
    const pathWith = path.join(tmpDir, 'with.md');
    await fs.writeFile(pathWithout, draftWithout);
    await fs.writeFile(pathWith, draftWith);

    const out1 = path.join(tmpDir, 'out1.json');
    const out2 = path.join(tmpDir, 'out2.json');
    await compile_draft({ draftPath: pathWithout, outputPath: out1 });
    await compile_draft({ draftPath: pathWith, outputPath: out2 });

    const w1 = JSON.parse(await fs.readFile(out1, 'utf-8'));
    const w2 = JSON.parse(await fs.readFile(out2, 'utf-8'));
    expect(w1.title).toBe(w2.title);
    expect(w1.background).toBe(w2.background);
    expect(w1).toEqual(w2);
  });

  it('case 10b: parity holds with blank lines between header and evidence comment', async () => {
    const draftPlain = `# Title\nMy World\n\n# Background\nA rich background\n`;
    const draftBlankThenEvidence = `<!-- draft_mode: story_grounded -->\n# Title\n\n<!-- evidence: CARRY_FORWARD: tolerant parser -->\nMy World\n\n# Background\n<!-- evidence: CARRY_FORWARD: tolerant parser -->\nA rich background\n`;

    const pA = path.join(tmpDir, 'plain.md');
    const pB = path.join(tmpDir, 'blank.md');
    await fs.writeFile(pA, draftPlain);
    await fs.writeFile(pB, draftBlankThenEvidence);

    const oA = path.join(tmpDir, 'plain.json');
    const oB = path.join(tmpDir, 'blank.json');
    await compile_draft({ draftPath: pA, outputPath: oA });
    await compile_draft({ draftPath: pB, outputPath: oB });

    const wA = JSON.parse(await fs.readFile(oA, 'utf-8'));
    const wB = JSON.parse(await fs.readFile(oB, 'utf-8'));
    expect(wA).toEqual(wB);
  });

  // Case 11: compile audit reports sections missing evidence (grounded draft)
  it('case 11: compile_draft reports sections lacking evidence in response text for grounded draft', async () => {
    const draft = `<!-- draft_mode: story_grounded -->\n# Title\nMy World\n\n# Background\nA background\n\n# Main Instructions\nDo stuff\n`;
    await fs.writeFile(draftPath, draft);
    const result = await compile_draft({ draftPath, outputPath: worldPath });
    expect(result.content[0].text).toContain('Evidence audit');
    expect(result.content[0].text).toContain('Title');
    expect(result.content[0].text).toContain('Background');
  });

  it('case 11b: compile_draft does NOT warn when all sections have evidence (grounded draft)', async () => {
    const draft = `<!-- draft_mode: story_grounded -->\n# Title\n<!-- evidence: CARRY_FORWARD: everything fine -->\nMy World\n\n# Background\n<!-- evidence: CARRY_FORWARD: brought forward -->\nA background\n`;
    await fs.writeFile(draftPath, draft);
    const result = await compile_draft({ draftPath, outputPath: worldPath });
    expect(result.content[0].text).not.toContain('Evidence audit');
  });

  // Regression: bare story-citation prefixes must be rejected
  it('regression: bare "From Turn #" with no content is rejected', async () => {
    await fs.writeFile(draftPath, simpleDraftGrounded());
    await expect(
      update_draft_section({ draftPath, sectionName: 'Title', newContent: 'X', evidence: 'From Turn #' })
    ).rejects.toThrow(/requires an 'evidence' parameter/);
  });

  it('regression: bare "From Story Metadata" with no content is rejected', async () => {
    await fs.writeFile(draftPath, simpleDraftGrounded());
    await expect(
      update_draft_section({ draftPath, sectionName: 'Title', newContent: 'X', evidence: 'From Story Metadata' })
    ).rejects.toThrow(/requires an 'evidence' parameter/);
  });

  it('regression: bare "From Turn Detail" with short content is rejected', async () => {
    await fs.writeFile(draftPath, simpleDraftGrounded());
    await expect(
      update_draft_section({ draftPath, sectionName: 'Title', newContent: 'X', evidence: 'From Turn Detail: x' })
    ).rejects.toThrow(/requires an 'evidence' parameter/);
  });

  it('case-sensitivity: lowercase "carry_forward:" prefix is rejected', async () => {
    await fs.writeFile(draftPath, simpleDraftGrounded());
    await expect(
      update_draft_section({ draftPath, sectionName: 'Title', newContent: 'X', evidence: 'carry_forward: this is a long enough explanation' })
    ).rejects.toThrow(/requires an 'evidence' parameter/);
  });

  it('case-sensitivity: lowercase "from turn #" prefix is rejected', async () => {
    await fs.writeFile(draftPath, simpleDraftGrounded());
    await expect(
      update_draft_section({ draftPath, sectionName: 'Title', newContent: 'X', evidence: 'from turn #5: hero defeats dragon' })
    ).rejects.toThrow(/requires an 'evidence' parameter/);
  });

  it('round-trip: evidence with both newline and --> is encoded on disk and decoded by parseDraft', async () => {
    await fs.writeFile(draftPath, simpleDraftGrounded());
    const ev = 'From Turn #3 Outcome: line one --> arrow\nline two';
    await update_draft_section({ draftPath, sectionName: 'Title', newContent: 'Arrow Title', evidence: ev });

    const raw = await fs.readFile(draftPath, 'utf-8');
    expect(raw).toContain('<!-- evidence: From Turn #3 Outcome: line one --&gt; arrow\\nline two -->');
    expect(raw).not.toContain('line one --> arrow');

    const result = await compile_draft({ draftPath, outputPath: worldPath });
    const auditMatch = result.content[0].text.match(/Evidence audit:[^\n]*/);
    if (auditMatch) {
      expect(auditMatch[0]).not.toContain('Title');
    }

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.title).toBe('Arrow Title');
    expect(world.title).not.toContain('evidence:');
    expect(world.title).not.toContain('--&gt;');
  });

  it('case 12: USER_DIRECTED prefix with sufficient chars is accepted', async () => {
    await fs.writeFile(draftPath, simpleDraftGrounded());
    const ev = 'USER_DIRECTED: rewrite the objective to use phrase "hidden temple"';
    const result = await update_draft_section({ draftPath, sectionName: 'Title', newContent: 'X', evidence: ev });
    expect(result.content[0].text).toContain('Successfully updated');
    const raw = await fs.readFile(draftPath, 'utf-8');
    expect(raw).toContain(`<!-- evidence: ${ev} -->`);
  });

  it('injection: embedded evidence comment in newContent is stripped before write', async () => {
    await fs.writeFile(draftPath, simpleDraftGrounded());
    const validEv = 'From Turn #7 Outcome: hero finds the ancient artifact';
    const injectedContent = '<!-- evidence: INJECTED: fake -->\nActual content here.';
    await update_draft_section({ draftPath, sectionName: 'Title', newContent: injectedContent, evidence: validEv });

    const raw = await fs.readFile(draftPath, 'utf-8');
    // The raw file must contain the validated evidence comment, not the injected one
    expect(raw).toContain(`<!-- evidence: ${validEv} -->`);
    expect(raw).not.toContain('<!-- evidence: INJECTED: fake -->');

    // read_draft_section must return the content without the injected comment line
    const readResult = await read_draft_section({ draftPath, sectionName: 'Title' });
    expect(readResult.content[0].text).not.toContain('<!-- evidence: INJECTED: fake -->');
    expect(readResult.content[0].text).toContain('Actual content here.');
  });
  }); // end story_grounded mode

  describe('update_draft_section (unmarked mode)', () => {
  it('succeeds without evidence — no evidence comment written', async () => {
    await fs.writeFile(draftPath, simpleDraft());
    await update_draft_section({ draftPath, sectionName: 'Title', newContent: 'Unmarked Title' });
    const raw = await fs.readFile(draftPath, 'utf-8');
    expect(raw).toContain('# Title\nUnmarked Title');
    expect(raw).not.toContain('<!-- evidence:');
  });

  it('succeeds with evidence provided — evidence comment is NOT written (silently ignored)', async () => {
    await fs.writeFile(draftPath, simpleDraft());
    await update_draft_section({ draftPath, sectionName: 'Title', newContent: 'Unmarked Title', evidence: validEvidence });
    const raw = await fs.readFile(draftPath, 'utf-8');
    expect(raw).toContain('# Title\nUnmarked Title');
    expect(raw).not.toContain('<!-- evidence:');
  });

  it('after enable_story_grounded_mode, calling without evidence throws', async () => {
    await fs.writeFile(draftPath, simpleDraft());
    await enable_story_grounded_mode({ draftPath });
    await expect(
      update_draft_section({ draftPath, sectionName: 'Title', newContent: 'X' })
    ).rejects.toThrow(/requires an 'evidence' parameter/);
  });
  }); // end unmarked mode
});

// ---------------------------------------------------------------------------
// hasStoryGroundedMarker (unit tests via enable_story_grounded_mode + direct effect)
// ---------------------------------------------------------------------------

describe('hasStoryGroundedMarker', () => {
  it('marker as first line → grounded draft requires evidence', async () => {
    await fs.writeFile(draftPath, '<!-- draft_mode: story_grounded -->\n# Title\nX\n');
    await expect(
      update_draft_section({ draftPath, sectionName: 'Title', newContent: 'Y' })
    ).rejects.toThrow(/requires an 'evidence' parameter/);
  });

  it('marker after blank leading lines → still detected as grounded', async () => {
    await fs.writeFile(draftPath, '\n\n<!-- draft_mode: story_grounded -->\n# Title\nX\n');
    await expect(
      update_draft_section({ draftPath, sectionName: 'Title', newContent: 'Y' })
    ).rejects.toThrow(/requires an 'evidence' parameter/);
  });

  it('marker after # Title (not at top) → NOT detected as grounded', async () => {
    await fs.writeFile(draftPath, '# Title\n<!-- draft_mode: story_grounded -->\nX\n');
    // Should succeed without evidence (not grounded)
    await expect(
      update_draft_section({ draftPath, sectionName: 'Title', newContent: 'Y' })
    ).resolves.toBeDefined();
  });

  it('wrong casing → NOT detected as grounded', async () => {
    await fs.writeFile(draftPath, '<!-- Draft_Mode: story_grounded -->\n# Title\nX\n');
    await expect(
      update_draft_section({ draftPath, sectionName: 'Title', newContent: 'Y' })
    ).resolves.toBeDefined();
  });

  it('marker with trailing whitespace → detected as grounded', async () => {
    await fs.writeFile(draftPath, '<!-- draft_mode: story_grounded -->   \n# Title\nX\n');
    await expect(
      update_draft_section({ draftPath, sectionName: 'Title', newContent: 'Y' })
    ).rejects.toThrow(/requires an 'evidence' parameter/);
  });

  it('empty string → not grounded', async () => {
    await fs.writeFile(draftPath, '');
    await expect(
      update_draft_section({ draftPath, sectionName: 'Title', newContent: 'Y' })
    ).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// splitSubFields — unit tests
// ---------------------------------------------------------------------------

describe('splitSubFields', () => {
  it('splits a simple body into sub-fields', () => {
    const body = '## Alice\nHello Alice\n## Bob\nHello Bob\n';
    const result = splitSubFields(body);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Alice');
    expect(result[0].body).toBe('Hello Alice');
    expect(result[1].name).toBe('Bob');
    expect(result[1].body).toBe('Hello Bob');
  });

  it('ignores ## inside a backtick fenced block', () => {
    const body = '## Main\n```\n## fake heading\n```\nActual content\n';
    const result = splitSubFields(body);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Main');
    expect(result[0].body).toContain('## fake heading');
    expect(result[0].body).toContain('Actual content');
  });

  it('ignores ## inside a tilde fenced block', () => {
    const body = '## Entry\n~~~\n## tilde fake\n~~~\nReal content\n';
    const result = splitSubFields(body);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Entry');
    expect(result[0].body).toContain('## tilde fake');
  });

  it('treats ### sub-subheadings as body content, not sub-field boundaries', () => {
    const body = '## Character\n### Appearance\nTall\n### Skills\nCombat\n';
    const result = splitSubFields(body);
    expect(result).toHaveLength(1);
    expect(result[0].body).toContain('### Appearance');
    expect(result[0].body).toContain('### Skills');
  });

  it('handles unclosed fence by treating everything remaining as fenced', () => {
    const body = '## A\n```\n## not a boundary\nstuff\n## B\nmore\n';
    const result = splitSubFields(body);
    // ## B is inside an unclosed fence — should not be a new entry
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('A');
  });

  it('preserves original heading casing in headerLine', () => {
    const body = '## Rachel McKelvey\nContent\n';
    const result = splitSubFields(body);
    expect(result[0].headerLine).toBe('## Rachel McKelvey');
    expect(result[0].name).toBe('Rachel McKelvey');
  });

  it('returns empty array for empty body', () => {
    expect(splitSubFields('')).toHaveLength(0);
    expect(splitSubFields('\n\n')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Container-section helpers for test drafts
// ---------------------------------------------------------------------------

const containerDraft = () => `# Title
My World

# Other Characters
## Rachel McKelvey
### Brief Summary
Chief of police
### Character Detail
Runs the department
### Appearance
Tall and authoritative
### Location
Police HQ
### Secret Information
She suspects the mayor
### Full List of Names
Rachel, Rach
### Image Appearance
formal uniform
### Image Clothing
navy blazer

## Priya Chakrabarti
### Brief Summary
Tech entrepreneur
### Character Detail
Runs a startup
### Appearance
Sharp and professional
### Location
Downtown office
### Secret Information
Owns the building
### Full List of Names
Priya
### Image Appearance
business casual
### Image Clothing
blazer

# Background
A rich background
`;

const containerDraftGrounded = () => '<!-- draft_mode: story_grounded -->\n' + containerDraft();

// ---------------------------------------------------------------------------
// update_draft_section — container sections
// ---------------------------------------------------------------------------

describe('update_draft_section — container sections', () => {
  const ev = 'From Turn #12: Rachel detail updated';

  it('throws when subField is missing on a container section', async () => {
    await fs.writeFile(draftPath, containerDraft());
    await expect(
      update_draft_section({ draftPath, sectionName: 'Other Characters', newContent: 'anything' })
    ).rejects.toThrow(/container field.*requires a 'subField'/);
  });

  it('throws when subField names an entry that does not exist', async () => {
    await fs.writeFile(draftPath, containerDraft());
    await expect(
      update_draft_section({ draftPath, sectionName: 'Other Characters', subField: 'Nobody Here', newContent: 'x' })
    ).rejects.toThrow(/not found.*create_sub_field/i);
  });

  it('replaces only the targeted sub-field; other sub-fields byte-identical', async () => {
    await fs.writeFile(draftPath, containerDraft());
    const newContent = '### Brief Summary\nFormer chief of police';
    await update_draft_section({ draftPath, sectionName: 'Other Characters', subField: 'Rachel McKelvey', newContent });

    // Rachel's body is updated
    const readRachel = await read_draft_section({ draftPath, sectionName: 'Other Characters', subField: 'Rachel McKelvey' });
    expect(readRachel.content[0].text).toContain('Former chief of police');

    // Priya's body is unchanged
    const readPriya = await read_draft_section({ draftPath, sectionName: 'Other Characters', subField: 'Priya Chakrabarti' });
    expect(readPriya.content[0].text).toContain('Tech entrepreneur');
  });

  it('case-insensitive subField match finds ## Rachel McKelvey when passed "rachel mckelvey" and preserves casing', async () => {
    await fs.writeFile(draftPath, containerDraft());
    await update_draft_section({ draftPath, sectionName: 'Other Characters', subField: 'rachel mckelvey', newContent: 'updated' });

    const raw = await fs.readFile(draftPath, 'utf-8');
    expect(raw).toContain('## Rachel McKelvey');   // original casing preserved
    expect(raw).not.toContain('## rachel mckelvey');
  });

  it('stores evidence beneath ## {subField} heading on grounded draft', async () => {
    await fs.writeFile(draftPath, containerDraftGrounded());
    await update_draft_section({
      draftPath, sectionName: 'Other Characters', subField: 'Rachel McKelvey',
      newContent: '### Brief Summary\nUpdated', evidence: ev
    });
    const raw = await fs.readFile(draftPath, 'utf-8');
    expect(raw).toContain(`## Rachel McKelvey\n<!-- evidence: ${ev} -->`);
    expect(raw).not.toMatch(/# Other Characters\n<!-- evidence:/);
  });

  it('round-trip: compile_draft after sub-field update produces correct JSON', async () => {
    await fs.writeFile(draftPath, containerDraft());
    await update_draft_section({
      draftPath, sectionName: 'Other Characters', subField: 'Rachel McKelvey',
      newContent: '### Brief Summary\nNew summary\n### Character Detail\nNew detail\n### Appearance\nTall\n### Location\nHQ\n### Secret Information\nNone\n### Full List of Names\nRachel\n### Image Appearance\nuniform\n### Image Clothing\nblazer'
    });
    const result = await compile_draft({ draftPath, outputPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    const rachel = world.NPCs.find(n => n.name === 'Rachel McKelvey');
    expect(rachel).toBeDefined();
    expect(rachel.one_liner).toBe('New summary');
    expect(rachel.detail).toBe('New detail');
    // Priya still intact
    const priya = world.NPCs.find(n => n.name === 'Priya Chakrabarti');
    expect(priya).toBeDefined();
    expect(priya.one_liner).toBe('Tech entrepreneur');
  });

  it('throws on container section not found in draft', async () => {
    await fs.writeFile(draftPath, '# Title\nHi\n');
    await expect(
      update_draft_section({ draftPath, sectionName: 'Other Characters', subField: 'Alice', newContent: 'x' })
    ).rejects.toThrow(/not found in draft/i);
  });

  it('non-container section update still works (whole-section overwrite)', async () => {
    await fs.writeFile(draftPath, containerDraft());
    await update_draft_section({ draftPath, sectionName: 'Background', newContent: 'New background' });
    const result = await read_draft_section({ draftPath, sectionName: 'Background' });
    expect(result.content[0].text).toBe('New background');
  });
});

// ---------------------------------------------------------------------------
// read_draft_section — subField parameter
// ---------------------------------------------------------------------------

describe('read_draft_section — subField parameter', () => {
  it('returns only the named sub-field body (without the ## heading)', async () => {
    await fs.writeFile(draftPath, containerDraft());
    const result = await read_draft_section({ draftPath, sectionName: 'Other Characters', subField: 'Rachel McKelvey' });
    expect(result.content[0].text).toContain('Chief of police');
    expect(result.content[0].text).not.toContain('## Rachel McKelvey');
  });

  it('returns not-found message when sub-field is absent', async () => {
    await fs.writeFile(draftPath, containerDraft());
    const result = await read_draft_section({ draftPath, sectionName: 'Other Characters', subField: 'Nobody' });
    expect(result.content[0].text).toContain('not found');
  });

  it('throws when subField is used on a non-container section', async () => {
    await fs.writeFile(draftPath, containerDraft());
    await expect(
      read_draft_section({ draftPath, sectionName: 'Background', subField: 'anything' })
    ).rejects.toThrow(/not a container field/i);
  });

  it('strips per-sub-field evidence comment from returned body', async () => {
    await fs.writeFile(draftPath, containerDraftGrounded());
    const ev = 'From Turn #3: Priya introduced';
    await update_draft_section({
      draftPath, sectionName: 'Other Characters', subField: 'Priya Chakrabarti',
      newContent: '### Brief Summary\nTech entrepreneur', evidence: ev
    });
    const result = await read_draft_section({ draftPath, sectionName: 'Other Characters', subField: 'Priya Chakrabarti' });
    expect(result.content[0].text).not.toContain('<!-- evidence:');
    expect(result.content[0].text).toContain('Tech entrepreneur');
  });
});

// ---------------------------------------------------------------------------
// create_sub_field
// ---------------------------------------------------------------------------

describe('create_sub_field', () => {
  it('appends a new sub-field at the end of the section', async () => {
    await fs.writeFile(draftPath, containerDraft());
    await create_sub_field({
      draftPath, sectionName: 'Other Characters', subField: 'New Character',
      newContent: '### Brief Summary\nA newcomer'
    });
    const result = await read_draft_section({ draftPath, sectionName: 'Other Characters', subField: 'New Character' });
    expect(result.content[0].text).toContain('A newcomer');
  });

  it('throws when the sub-field already exists', async () => {
    await fs.writeFile(draftPath, containerDraft());
    await expect(
      create_sub_field({ draftPath, sectionName: 'Other Characters', subField: 'Rachel McKelvey', newContent: 'x' })
    ).rejects.toThrow(/already exists.*update_draft_section/i);
  });

  it('throws when used on a non-container section', async () => {
    await fs.writeFile(draftPath, containerDraft());
    await expect(
      create_sub_field({ draftPath, sectionName: 'Background', subField: 'foo', newContent: 'bar' })
    ).rejects.toThrow(/not a container field/i);
  });

  it('writes per-sub-field evidence comment on grounded draft', async () => {
    await fs.writeFile(draftPath, containerDraftGrounded());
    const ev = 'From Turn #10: new character appears';
    await create_sub_field({
      draftPath, sectionName: 'Other Characters', subField: 'New Char',
      newContent: 'Some content', evidence: ev
    });
    const raw = await fs.readFile(draftPath, 'utf-8');
    expect(raw).toContain(`## New Char\n<!-- evidence: ${ev} -->`);
  });

  it('preserves existing sub-fields when appending', async () => {
    await fs.writeFile(draftPath, containerDraft());
    await create_sub_field({ draftPath, sectionName: 'Other Characters', subField: 'Third', newContent: 'Content' });
    const rachel = await read_draft_section({ draftPath, sectionName: 'Other Characters', subField: 'Rachel McKelvey' });
    expect(rachel.content[0].text).toContain('Chief of police');
    const priya = await read_draft_section({ draftPath, sectionName: 'Other Characters', subField: 'Priya Chakrabarti' });
    expect(priya.content[0].text).toContain('Tech entrepreneur');
  });

  it('throws when section is not found', async () => {
    await fs.writeFile(draftPath, '# Title\nHi\n');
    await expect(
      create_sub_field({ draftPath, sectionName: 'Other Characters', subField: 'X', newContent: 'y' })
    ).rejects.toThrow(/not found/i);
  });
});

// ---------------------------------------------------------------------------
// rename_sub_field
// ---------------------------------------------------------------------------

describe('rename_sub_field', () => {
  it('changes only the ## heading; body and evidence preserved verbatim', async () => {
    await fs.writeFile(draftPath, containerDraftGrounded());
    const ev = 'From Turn #5: Rachel introduced';
    await update_draft_section({
      draftPath, sectionName: 'Other Characters', subField: 'Rachel McKelvey',
      newContent: '### Brief Summary\nChief', evidence: ev
    });
    await rename_sub_field({ draftPath, sectionName: 'Other Characters', oldSubField: 'Rachel McKelvey', newSubField: 'Rachel M. McKelvey' });

    const raw = await fs.readFile(draftPath, 'utf-8');
    expect(raw).toContain('## Rachel M. McKelvey');
    expect(raw).not.toContain('## Rachel McKelvey');
    // Body and evidence are preserved
    expect(raw).toContain('Chief');
    expect(raw).toContain(`<!-- evidence: ${ev} -->`);
  });

  it('throws when oldSubField is not found', async () => {
    await fs.writeFile(draftPath, containerDraft());
    await expect(
      rename_sub_field({ draftPath, sectionName: 'Other Characters', oldSubField: 'Ghost', newSubField: 'Ghost2' })
    ).rejects.toThrow(/not found/i);
  });

  it('throws when newSubField conflicts with an existing sub-field', async () => {
    await fs.writeFile(draftPath, containerDraft());
    await expect(
      rename_sub_field({ draftPath, sectionName: 'Other Characters', oldSubField: 'Rachel McKelvey', newSubField: 'Priya Chakrabarti' })
    ).rejects.toThrow(/already exists/i);
  });

  it('throws on non-container section', async () => {
    await fs.writeFile(draftPath, containerDraft());
    await expect(
      rename_sub_field({ draftPath, sectionName: 'Background', oldSubField: 'a', newSubField: 'b' })
    ).rejects.toThrow(/not a container field/i);
  });
});

// ---------------------------------------------------------------------------
// delete_draft_sub_field
// ---------------------------------------------------------------------------

describe('delete_draft_sub_field', () => {
  it('removes only the targeted sub-field', async () => {
    await fs.writeFile(draftPath, containerDraft());
    await delete_draft_sub_field({ draftPath, sectionName: 'Other Characters', subField: 'Rachel McKelvey' });

    const result = await read_draft_section({ draftPath, sectionName: 'Other Characters', subField: 'Rachel McKelvey' });
    expect(result.content[0].text).toContain('not found');

    // Priya should still be there
    const priya = await read_draft_section({ draftPath, sectionName: 'Other Characters', subField: 'Priya Chakrabarti' });
    expect(priya.content[0].text).toContain('Tech entrepreneur');
  });

  it('is idempotent — returns informational message when sub-field not found', async () => {
    await fs.writeFile(draftPath, containerDraft());
    const result = await delete_draft_sub_field({ draftPath, sectionName: 'Other Characters', subField: 'Nobody' });
    expect(result.content[0].text).toContain('not found');
  });

  it('throws on non-container section', async () => {
    await fs.writeFile(draftPath, containerDraft());
    await expect(
      delete_draft_sub_field({ draftPath, sectionName: 'Background', subField: 'foo' })
    ).rejects.toThrow(/not a container field/i);
  });

  it('throws when section is not found', async () => {
    await fs.writeFile(draftPath, '# Title\nHi\n');
    await expect(
      delete_draft_sub_field({ draftPath, sectionName: 'Other Characters', subField: 'X' })
    ).rejects.toThrow(/not found/i);
  });
});

// ---------------------------------------------------------------------------
// parseDraft — per-sub-field evidence in _evidenceMap
// ---------------------------------------------------------------------------

describe('parseDraft — per-sub-field evidence', () => {
  it('records per-sub-field evidence under composite keys', async () => {
    const draft = `<!-- draft_mode: story_grounded -->
# Other Characters
## Rachel McKelvey
<!-- evidence: From Turn #5: Rachel introduced -->
### Brief Summary
Chief of police
## Priya Chakrabarti
<!-- evidence: From Turn #8: Priya introduced -->
### Brief Summary
Tech entrepreneur
`;
    await fs.writeFile(draftPath, draft);
    await compile_draft({ draftPath, outputPath: worldPath });
    // Compile should succeed (section-level audit won't fire because per-sub-field evidence exists)
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.NPCs.find(n => n.name === 'Rachel McKelvey')).toBeDefined();
  });

  it('section-level evidence comment on container is still stripped (pre-v2 compatibility)', async () => {
    const draft = `<!-- draft_mode: story_grounded -->
# Other Characters
<!-- evidence: CARRY_FORWARD: imported from prior session -->
## Alice
### Brief Summary
A person
`;
    await fs.writeFile(draftPath, draft);
    await compile_draft({ draftPath, outputPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.NPCs[0].name).toBe('Alice');
    expect(world.NPCs[0].one_liner).toBe('A person');
  });
});

// ---------------------------------------------------------------------------
// Fence-aware round-trip: compile_draft preserves sub-field with ## inside fence
// ---------------------------------------------------------------------------

describe('compile_draft round-trip — fence-aware sub-field parsing', () => {
  it('compile produces correct JSON when a sub-field body contains ## inside a code fence', async () => {
    const draft = `# Title
My World

# Extra Instruction Blocks
## Combat Rules
### Content

\`\`\`text
## This is inside a fence
Strike fast
\`\`\`

`;
    await fs.writeFile(draftPath, draft);
    await compile_draft({ draftPath, outputPath: worldPath });
    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.instructionBlocks).toHaveLength(1);
    expect(world.instructionBlocks[0].name).toBe('Combat Rules');
    expect(world.instructionBlocks[0].content).toContain('Strike fast');
  });
});

// ---------------------------------------------------------------------------
// enable_story_grounded_mode
// ---------------------------------------------------------------------------

describe('enable_story_grounded_mode', () => {
  it('prepends marker to unmarked draft, content otherwise unchanged', async () => {
    await fs.writeFile(draftPath, simpleDraft());
    await enable_story_grounded_mode({ draftPath });
    const content = await fs.readFile(draftPath, 'utf-8');
    expect(content.startsWith('<!-- draft_mode: story_grounded -->\n')).toBe(true);
    expect(content).toContain('# Title\nMy World');
  });

  it('is idempotent — calling twice does not duplicate marker', async () => {
    await fs.writeFile(draftPath, simpleDraft());
    await enable_story_grounded_mode({ draftPath });
    await enable_story_grounded_mode({ draftPath });
    const content = await fs.readFile(draftPath, 'utf-8');
    const count = (content.match(/<!-- draft_mode: story_grounded -->/g) || []).length;
    expect(count).toBe(1);
  });

  it('second call returns already-in-story_grounded-mode message', async () => {
    await fs.writeFile(draftPath, simpleDraftGrounded());
    const result = await enable_story_grounded_mode({ draftPath });
    expect(result.content[0].text).toContain('already in story_grounded mode');
  });

  it('after calling it, update_draft_section without evidence throws', async () => {
    await fs.writeFile(draftPath, simpleDraft());
    await enable_story_grounded_mode({ draftPath });
    await expect(
      update_draft_section({ draftPath, sectionName: 'Title', newContent: 'X' })
    ).rejects.toThrow(/requires an 'evidence' parameter/);
  });

  it('throws for non-existent file', async () => {
    await expect(
      enable_story_grounded_mode({ draftPath: path.join(tmpDir, 'missing.md') })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// compile_draft audit scope (unmarked vs grounded)
// ---------------------------------------------------------------------------

describe('compile_draft audit scope', () => {
  it('unmarked draft with missing evidence → NO Evidence audit warning', async () => {
    const draft = `# Title\nMy World\n\n# Background\nA background\n`;
    await fs.writeFile(draftPath, draft);
    const result = await compile_draft({ draftPath, outputPath: worldPath });
    expect(result.content[0].text).not.toContain('Evidence audit');
  });

  it('grounded draft with missing evidence → Evidence audit warning', async () => {
    const draft = `<!-- draft_mode: story_grounded -->\n# Title\nMy World\n\n# Background\nA background\n`;
    await fs.writeFile(draftPath, draft);
    const result = await compile_draft({ draftPath, outputPath: worldPath });
    expect(result.content[0].text).toContain('Evidence audit');
    expect(result.content[0].text).toContain('Title');
  });

  it('unmarked draft with stray evidence comments → tamper warning', async () => {
    const draft = `# Title\n<!-- evidence: CARRY_FORWARD: stray comment -->\nMy World\n`;
    await fs.writeFile(draftPath, draft);
    const result = await compile_draft({ draftPath, outputPath: worldPath });
    expect(result.content[0].text).toContain('story_grounded marker');
  });

  it('audit: Table of Contents section is not reported as missing evidence even on a grounded draft', async () => {
    // A grounded draft that includes a # Table of Contents section (as decompile_json always produces)
    // but has NO evidence comment on that section. All other sections DO have evidence comments.
    const draft = [
      '<!-- draft_mode: story_grounded -->',
      '# Table of Contents',
      '- [Title](#title)',
      '- [Background](#background)',
      '',
      '# Title',
      '<!-- evidence: CARRY_FORWARD: brought forward from original world -->',
      'My World',
      '',
      '# Background',
      '<!-- evidence: CARRY_FORWARD: brought forward from original world -->',
      'A rich background',
      '',
      '# Main Instructions',
      '<!-- evidence: CARRY_FORWARD: brought forward from original world -->',
      'Do the right thing',
      '',
    ].join('\n');

    await fs.writeFile(draftPath, draft);
    const result = await compile_draft({ draftPath, outputPath: worldPath });

    // The Table of Contents section has no evidence comment but must NOT be flagged
    expect(result.content[0].text).not.toContain('Table of Contents');
    // With only ToC lacking evidence (and ToC skipped), the audit section must be absent entirely
    expect(result.content[0].text).not.toContain('Evidence audit');
  });
});


// ---------------------------------------------------------------------------
// get_diff_summary
// ---------------------------------------------------------------------------

describe('get_diff_summary', () => {
  it('reports no changes when draft matches original', async () => {
    // Write a world whose fields exactly match what parseDraft will extract from the draft.
    // authorStyle and description must be left at their draft-parsed values (undefined → not set)
    // so we use a minimal world that only has title/background/instructions.
    const world = {
      title: 'Same Title',
      background: 'Base background',
      instructions: 'Base instructions',
      possibleCharacters: [],
      NPCs: [],
      instructionBlocks: [],
      loreBookEntries: [],
      trackedItems: [],
      triggerEvents: [],
    };
    await writeWorld(worldPath, world);

    const draft = `# Title\nSame Title\n# Background\nBase background\n# Main Instructions\nBase instructions\n`;
    await fs.writeFile(draftPath, draft);

    const result = await get_diff_summary({ originalPath: worldPath, draftPath });
    expect(result.content[0].text).toContain('No changes detected');
  });

  it('detects a changed root field', async () => {
    const world = minimalWorld({ title: 'Old Title' });
    await writeWorld(worldPath, world);

    const draft = `# Title\nNew Title\n# Background\nBase background\n# Main Instructions\nBase instructions\n`;
    await fs.writeFile(draftPath, draft);

    const result = await get_diff_summary({ originalPath: worldPath, draftPath });
    expect(result.content[0].text).toContain('[title]');
  });

  it('detects added items in possibleCharacters', async () => {
    const world = minimalWorld({ possibleCharacters: [] });
    await writeWorld(worldPath, world);

    const draft = `# Title\nBase World\n# Background\nBase background\n# Main Instructions\nBase instructions\n# Possible Characters\n## New Hero\nDescription: Brave\n`;
    await fs.writeFile(draftPath, draft);

    const result = await get_diff_summary({ originalPath: worldPath, draftPath });
    expect(result.content[0].text).toContain('Possible Characters');
  });

  it('detects modified item content', async () => {
    const world = minimalWorld({
      NPCs: [{ id: 'n1', name: 'Bob', one_liner: 'Old liner', detail: '', appearance: '', location: '', secret_info: '', names: [], img_appearance: '', img_clothing: '' }],
    });
    await writeWorld(worldPath, world);

    const draft = `# Title\nBase World\n# Background\nBase background\n# Main Instructions\nBase instructions\n# Other Characters\n## Bob\nBrief Summary: New liner\n`;
    await fs.writeFile(draftPath, draft);

    const result = await get_diff_summary({ originalPath: worldPath, draftPath });
    expect(result.content[0].text).toContain('Bob');
  });

  it('detects changed skills', async () => {
    const world = minimalWorld({ skills: ['Combat'] });
    await writeWorld(worldPath, world);

    const draft = `# Title\nBase World\n# Background\nBase background\n# Main Instructions\nBase instructions\n# Skills\n- Combat\n- Stealth\n`;
    await fs.writeFile(draftPath, draft);

    const result = await get_diff_summary({ originalPath: worldPath, draftPath });
    expect(result.content[0].text).toContain('skills');
  });

  it('detects changed victory and defeat conditions', async () => {
    const world = minimalWorld({
      victoryCondition: { condition: 'Score >= 100', text: 'You win!', alreadyFired: false },
      defeatCondition: { condition: 'Lives <= 0', text: 'You lose.', alreadyFired: false },
    });
    await writeWorld(worldPath, world);

    const draft = `# Title\nBase World\n# Background\nBase background\n# Main Instructions\nBase instructions\n# Victory Condition\nScore >= 200\n# Victory Text\nYou win!\n# Defeat Condition\nLives <= 0\n# Defeat Text\nYou lose.\n`;
    await fs.writeFile(draftPath, draft);

    const result = await get_diff_summary({ originalPath: worldPath, draftPath });
    expect(result.content[0].text).toContain('[victoryCondition.condition]');
    expect(result.content[0].text).not.toContain('[defeatCondition');
  });

  it('throws for non-existent original file', async () => {
    await fs.writeFile(draftPath, simpleDraft());
    await expect(
      get_diff_summary({ originalPath: path.join(tmpDir, 'missing.json'), draftPath })
    ).rejects.toThrow();
  });
});
