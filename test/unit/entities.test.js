/**
 * Tests for lib/handlers/entities.js
 * Tests entity creation and management functions
 */

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

    expect(response.content[0].type).toBe('text');
    expect(response.content[0].text).toContain('added successfully');

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.instructionBlocks.length).toBe(1);
    expect(world.instructionBlocks[0].name).toBe('Test Block');
    expect(world.instructionBlocks[0].content).toBe('Block content');
    expect(world.instructionBlocks[0].id).toBeDefined();
  });

  test('adds lore book entry with keywords', async () => {
    const response = await add_instruction_block({
      path: worldPath,
      name: 'Magic System',
      content: 'How magic works',
      keywords: ['magic', 'system', 'arcane']
    });

    expect(response.content[0].text).toContain('added successfully');

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.loreBookEntries.length).toBe(1);
    expect(world.loreBookEntries[0].name).toBe('Magic System');
    expect(world.loreBookEntries[0].keywords).toEqual(['magic', 'system', 'arcane']);
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
    expect(new Set(ids).size).toBe(2);
  });

  test('throws error for missing world', async () => {
    await expect(add_instruction_block({
      path: path.join(tmpDir, 'nonexistent.json'),
      name: 'Block',
      content: 'Content'
    })).rejects.toThrow();
  });
});

describe('add_character', () => {
  test('adds character with minimal fields', async () => {
    const response = await add_character({
      path: worldPath,
      name: 'Hero',
      description: 'A brave hero'
    });

    expect(response.content[0].text).toContain('added successfully');
    expect(response.content[0].text).toContain('Hero');

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.possibleCharacters.length).toBe(1);
    expect(world.possibleCharacters[0].name).toBe('Hero');
    expect(world.possibleCharacters[0].description).toBe('A brave hero');
    expect(world.possibleCharacters[0].characterId).toBeDefined();
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
    expect(world.possibleCharacters[0].skills).toEqual(skills);
  });

  test('adds character with portrait', async () => {
    const portrait = 'https://example.com/portrait.jpg';

    await add_character({
      path: worldPath,
      name: 'Character',
      portrait
    });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.possibleCharacters[0].portrait).toBe(portrait);
  });

  test('rejects invalid skill values', async () => {
    await expect(add_character({
      path: worldPath,
      name: 'Bad Character',
      skills: { Combat: 10 }
    })).rejects.toThrow();
  });

  test('uses provided characterId', async () => {
    const customId = 'custom_char_001';

    await add_character({
      path: worldPath,
      name: 'Character',
      characterId: customId
    });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.possibleCharacters[0].characterId).toBe(customId);
  });

  test('generates characterId if not provided', async () => {
    await add_character({
      path: worldPath,
      name: 'Character'
    });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.possibleCharacters[0].characterId).toBeDefined();
    expect(typeof world.possibleCharacters[0].characterId).toBe('string');
  });

  test('throws error for missing name', async () => {
    await expect(add_character({
      path: worldPath,
      description: 'No name'
    })).rejects.toThrow(/Required field/);
  });

  test('adds multiple characters with unique IDs', async () => {
    await add_character({ path: worldPath, name: 'Char 1' });
    await add_character({ path: worldPath, name: 'Char 2' });
    await add_character({ path: worldPath, name: 'Char 3' });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.possibleCharacters.length).toBe(3);
    const ids = world.possibleCharacters.map(c => c.characterId);
    expect(new Set(ids).size).toBe(3);
  });
});

describe('add_npc', () => {
  test('adds NPC with minimal fields', async () => {
    const response = await add_npc({
      path: worldPath,
      name: 'Tavern Keeper'
    });

    expect(response.content[0].text).toContain('added successfully');

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.NPCs.length).toBe(1);
    expect(world.NPCs[0].name).toBe('Tavern Keeper');
    expect(world.NPCs[0].id).toBeDefined();
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

    expect(npc.detail).toBe('Full character detail');
    expect(npc.one_liner).toBe('A mysterious figure');
    expect(npc.appearance).toBe('Tall and dark');
    expect(npc.location).toBe('The tavern');
    expect(npc.secret_info).toBe('Secret past');
    expect(npc.names).toEqual(['Stranger', 'Shadow']);
  });

  test('uses provided id', async () => {
    const customId = 'npc_custom_001';

    await add_npc({
      path: worldPath,
      name: 'NPC',
      id: customId
    });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.NPCs[0].id).toBe(customId);
  });

  test('generates id if not provided', async () => {
    await add_npc({
      path: worldPath,
      name: 'NPC'
    });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.NPCs[0].id).toBeDefined();
  });

  test('throws error for missing name', async () => {
    await expect(add_npc({
      path: worldPath,
      detail: 'No name provided'
    })).rejects.toThrow(/Required field/);
  });

  test('adds multiple NPCs', async () => {
    await add_npc({ path: worldPath, name: 'NPC 1' });
    await add_npc({ path: worldPath, name: 'NPC 2' });
    await add_npc({ path: worldPath, name: 'NPC 3' });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.NPCs.length).toBe(3);
  });
});

describe('add_tracked_item', () => {
  test('adds tracked item with defaults', async () => {
    const response = await add_tracked_item({
      path: worldPath,
      name: 'Health',
      initialValue: '100'
    });

    expect(response.content[0].text).toContain('added successfully');

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.trackedItems.length).toBe(1);
    expect(world.trackedItems[0].name).toBe('Health');
    expect(world.trackedItems[0].initialValue).toBe('100');
    expect(world.trackedItems[0].dataType).toBe('text');
    expect(world.trackedItems[0].visibility).toBe('everyone');
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
    expect(world.trackedItems[0].dataType).toBe('number');
    expect(world.trackedItems[0].visibility).toBe('player_only');
  });

  test('rejects invalid dataType', async () => {
    await expect(add_tracked_item({
      path: worldPath,
      name: 'Item',
      dataType: 'invalid'
    })).rejects.toThrow();
  });

  test('rejects invalid visibility', async () => {
    await expect(add_tracked_item({
      path: worldPath,
      name: 'Item',
      visibility: 'invalid'
    })).rejects.toThrow();
  });

  test('generates unique IDs for multiple items', async () => {
    await add_tracked_item({ path: worldPath, name: 'Item 1', initialValue: '1' });
    await add_tracked_item({ path: worldPath, name: 'Item 2', initialValue: '2' });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    const ids = world.trackedItems.map(i => i.id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('add_trigger', () => {
  test('rejects invalid condition type', async () => {
    await expect(add_trigger({
      path: worldPath,
      name: 'Bad Trigger',
      conditionType: 'invalidType',
      conditionData: 'test'
    })).rejects.toThrow();
  });

  test('rejects invalid effect type', async () => {
    await expect(add_trigger({
      path: worldPath,
      name: 'Bad Trigger',
      conditionType: 'triggerOnEvent',
      conditionData: 'test',
      effectType: 'invalidEffect',
      effectData: 'test'
    })).rejects.toThrow();
  });

  test('add_trigger is exported', () => {
    expect(typeof add_trigger).toBe('function');
  });
});
