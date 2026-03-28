/**
 * Tests for lib/handlers/entities.js
 * Tests entity creation and management functions
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  add_instruction_block,
  add_character,
  add_npc,
  add_tracked_item,
  add_trigger
} from '../../lib/handlers/entities.js';
import { writeWorld } from '../../lib/helpers.js';

let tmpDir, worldPath, baseWorld;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-entities-'));
  worldPath = path.join(tmpDir, 'world.json');

  baseWorld = {
    title: 'Test World',
    description: 'Test',
    background: 'Test background',
    instructions: 'Test instructions',
    possibleCharacters: [],
    NPCs: [],
    instructionBlocks: [],
    loreBookEntries: [],
    trackedItems: [],
    triggerEvents: []
  };

  await writeWorld(worldPath, baseWorld);
});

afterEach(async () => {
  try {
    await fs.rm(tmpDir, { recursive: true });
  } catch (e) {
    // Ignore
  }
});

describe('add_instruction_block', () => {
  test('adds instruction block without keywords', async () => {
    const response = await add_instruction_block({
      path: worldPath,
      name: 'Test Block',
      content: 'Block content',
      keywords: []
    });

    assert.strictEqual(response.content[0].type, 'text');
    assert(response.content[0].text.includes('added successfully'));

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    assert.strictEqual(world.instructionBlocks.length, 1);
    assert.strictEqual(world.instructionBlocks[0].name, 'Test Block');
    assert.strictEqual(world.instructionBlocks[0].content, 'Block content');
    assert(world.instructionBlocks[0].id !== undefined);
  });

  test('adds lore book entry with keywords', async () => {
    const response = await add_instruction_block({
      path: worldPath,
      name: 'Magic System',
      content: 'How magic works',
      keywords: ['magic', 'system', 'arcane']
    });

    assert(response.content[0].text.includes('added successfully'));

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    assert.strictEqual(world.loreBookEntries.length, 1);
    assert.strictEqual(world.loreBookEntries[0].name, 'Magic System');
    assert.deepStrictEqual(world.loreBookEntries[0].keywords, ['magic', 'system', 'arcane']);
  });

  test('generates unique IDs for multiple blocks', async () => {
    await add_instruction_block({
      path: worldPath,
      name: 'Block 1',
      content: 'Content 1'
    });

    await add_instruction_block({
      path: worldPath,
      name: 'Block 2',
      content: 'Content 2'
    });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    const ids = world.instructionBlocks.map(b => b.id);
    assert.strictEqual(new Set(ids).size, 2);
  });

  test('throws error for missing world', async () => {
    await assert.rejects(async () => {
      await add_instruction_block({
        path: path.join(tmpDir, 'nonexistent.json'),
        name: 'Block',
        content: 'Content'
      });
    });
  });
});

describe('add_character', () => {
  test('adds character with minimal fields', async () => {
    const response = await add_character({
      path: worldPath,
      name: 'Hero',
      description: 'A brave hero'
    });

    assert(response.content[0].text.includes('added successfully'));
    assert(response.content[0].text.includes('Hero'));

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    assert.strictEqual(world.possibleCharacters.length, 1);
    assert.strictEqual(world.possibleCharacters[0].name, 'Hero');
    assert.strictEqual(world.possibleCharacters[0].description, 'A brave hero');
    assert(world.possibleCharacters[0].characterId !== undefined);
  });

  test('adds character with skills', async () => {
    const skills = { Combat: 4, Persuasion: 3, Stealth: 2 };

    await add_character({
      path: worldPath,
      name: 'Rogue',
      description: 'A sneaky rogue',
      skills
    });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    assert.deepStrictEqual(world.possibleCharacters[0].skills, skills);
  });

  test('adds character with portrait', async () => {
    const portrait = 'https://example.com/portrait.jpg';

    await add_character({
      path: worldPath,
      name: 'Character',
      portrait
    });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    assert.strictEqual(world.possibleCharacters[0].portrait, portrait);
  });

  test('rejects invalid skill values', async () => {
    await assert.rejects(async () => {
      await add_character({
        path: worldPath,
        name: 'Bad Character',
        skills: { Combat: 10 }
      });
    });
  });

  test('uses provided characterId', async () => {
    const customId = 'custom_char_001';

    await add_character({
      path: worldPath,
      name: 'Character',
      characterId: customId
    });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    assert.strictEqual(world.possibleCharacters[0].characterId, customId);
  });

  test('generates characterId if not provided', async () => {
    await add_character({
      path: worldPath,
      name: 'Character'
    });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    assert(world.possibleCharacters[0].characterId !== undefined);
    assert.strictEqual(typeof world.possibleCharacters[0].characterId, 'string');
  });

  test('throws error for missing name', async () => {
    await assert.rejects(async () => {
      await add_character({
        path: worldPath,
        description: 'No name'
      });
    }, /Required field/);
  });

  test('adds multiple characters with unique IDs', async () => {
    await add_character({ path: worldPath, name: 'Char 1' });
    await add_character({ path: worldPath, name: 'Char 2' });
    await add_character({ path: worldPath, name: 'Char 3' });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    assert.strictEqual(world.possibleCharacters.length, 3);
    const ids = world.possibleCharacters.map(c => c.characterId);
    assert.strictEqual(new Set(ids).size, 3);
  });
});

describe('add_npc', () => {
  test('adds NPC with minimal fields', async () => {
    const response = await add_npc({
      path: worldPath,
      name: 'Tavern Keeper'
    });

    assert(response.content[0].text.includes('added successfully'));

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    assert.strictEqual(world.NPCs.length, 1);
    assert.strictEqual(world.NPCs[0].name, 'Tavern Keeper');
    assert(world.NPCs[0].id !== undefined);
  });

  test('adds NPC with all fields', async () => {
    const npcData = {
      path: worldPath,
      name: 'Mysterious Stranger',
      detail: 'Full character detail',
      one_liner: 'A mysterious figure',
      appearance: 'Tall and dark',
      location: 'The tavern',
      secret_info: 'Secret past',
      names: ['Stranger', 'Shadow'],
      img_appearance: 'Dark robes',
      img_clothing: 'Black outfit'
    };

    await add_npc(npcData);

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    const npc = world.NPCs[0];

    assert.strictEqual(npc.detail, 'Full character detail');
    assert.strictEqual(npc.one_liner, 'A mysterious figure');
    assert.strictEqual(npc.appearance, 'Tall and dark');
    assert.strictEqual(npc.location, 'The tavern');
    assert.strictEqual(npc.secret_info, 'Secret past');
    assert.deepStrictEqual(npc.names, ['Stranger', 'Shadow']);
  });

  test('uses provided id', async () => {
    const customId = 'npc_custom_001';

    await add_npc({
      path: worldPath,
      name: 'NPC',
      id: customId
    });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    assert.strictEqual(world.NPCs[0].id, customId);
  });

  test('generates id if not provided', async () => {
    await add_npc({
      path: worldPath,
      name: 'NPC'
    });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    assert(world.NPCs[0].id !== undefined);
  });

  test('throws error for missing name', async () => {
    await assert.rejects(async () => {
      await add_npc({
        path: worldPath,
        detail: 'No name provided'
      });
    }, /Required field/);
  });

  test('adds multiple NPCs', async () => {
    await add_npc({ path: worldPath, name: 'NPC 1' });
    await add_npc({ path: worldPath, name: 'NPC 2' });
    await add_npc({ path: worldPath, name: 'NPC 3' });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    assert.strictEqual(world.NPCs.length, 3);
  });
});

describe('add_tracked_item', () => {
  test('adds tracked item with defaults', async () => {
    const response = await add_tracked_item({
      path: worldPath,
      name: 'Health',
      initialValue: '100'
    });

    assert(response.content[0].text.includes('added successfully'));

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    assert.strictEqual(world.trackedItems.length, 1);
    assert.strictEqual(world.trackedItems[0].name, 'Health');
    assert.strictEqual(world.trackedItems[0].initialValue, '100');
    assert.strictEqual(world.trackedItems[0].dataType, 'text');
    assert.strictEqual(world.trackedItems[0].visibility, 'everyone');
  });

  test('adds tracked item with custom types', async () => {
    await add_tracked_item({
      path: worldPath,
      name: 'Money',
      dataType: 'number',
      visibility: 'player_only',
      initialValue: '1000'
    });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    assert.strictEqual(world.trackedItems[0].dataType, 'number');
    assert.strictEqual(world.trackedItems[0].visibility, 'player_only');
  });

  test('rejects invalid dataType', async () => {
    await assert.rejects(async () => {
      await add_tracked_item({
        path: worldPath,
        name: 'Item',
        dataType: 'invalid'
      });
    });
  });

  test('rejects invalid visibility', async () => {
    await assert.rejects(async () => {
      await add_tracked_item({
        path: worldPath,
        name: 'Item',
        visibility: 'invalid'
      });
    });
  });

  test('generates unique IDs for multiple items', async () => {
    await add_tracked_item({ path: worldPath, name: 'Item 1', initialValue: '1' });
    await add_tracked_item({ path: worldPath, name: 'Item 2', initialValue: '2' });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    const ids = world.trackedItems.map(i => i.id);
    assert.strictEqual(new Set(ids).size, 2);
  });
});

describe('add_trigger', () => {
  test('rejects invalid condition type', async () => {
    await assert.rejects(async () => {
      await add_trigger({
        path: worldPath,
        name: 'Bad Trigger',
        conditionType: 'invalidType',
        conditionData: 'test'
      });
    });
  });

  test('rejects invalid effect type', async () => {
    await assert.rejects(async () => {
      await add_trigger({
        path: worldPath,
        name: 'Bad Trigger',
        conditionType: 'triggerOnEvent',
        conditionData: 'test',
        effectType: 'invalidEffect',
        effectData: 'test'
      });
    });
  });

  test('add_trigger is exported', () => {
    assert(typeof add_trigger === 'function');
  });
});
