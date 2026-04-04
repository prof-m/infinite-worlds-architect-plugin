/**
 * Tests for modify_* functions in lib/handlers/entities.js
 * Previously uncovered: modify_character, modify_npc, modify_tracked_item, modify_trigger_event
 * Also adds fuller coverage for add_trigger (new array format, optional meta-fields).
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  add_trigger,
  modify_character,
  modify_npc,
  modify_tracked_item,
  modify_trigger_event,
} from '../../lib/handlers/entities.js';
import { writeWorld } from '../../lib/helpers.js';

let tmpDir, worldPath;

const baseWorld = (overrides = {}) => ({
  title: 'Test World',
  description: 'Test',
  background: 'BG',
  instructions: 'Instructions',
  possibleCharacters: [],
  NPCs: [],
  instructionBlocks: [],
  loreBookEntries: [],
  trackedItems: [],
  triggerEvents: [],
  ...overrides,
});

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-entities-modify-'));
  worldPath = path.join(tmpDir, 'world.json');
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

const readWorld = async () => JSON.parse(await fs.readFile(worldPath, 'utf-8'));

// ---------------------------------------------------------------------------
// add_trigger — full format (conditions/effects arrays)
// ---------------------------------------------------------------------------

describe('add_trigger - new array format', () => {
  it('adds trigger using conditions and effects arrays', async () => {
    await writeWorld(worldPath, baseWorld());
    const result = await add_trigger({
      path: worldPath,
      name: 'Game Start',
      conditions: [{ type: 'triggerOnStartOfGame', data: true }],
      effects: [{ type: 'scriptedText', data: 'Welcome!' }],
    });

    expect(result.content[0].text).toContain('Game Start');
    const world = await readWorld();
    expect(world.triggerEvents.length).toBe(1);
    expect(world.triggerEvents[0].triggerConditions[0].type).toBe('triggerOnStartOfGame');
    expect(world.triggerEvents[0].triggerEffects[0].type).toBe('scriptedText');
    expect(world.triggerEvents[0].triggerEffects[0].data).toBe('Welcome!');
  });

  it('adds trigger with multiple conditions and effects', async () => {
    await writeWorld(worldPath, baseWorld());
    await add_trigger({
      path: worldPath,
      name: 'Complex',
      conditions: [
        { type: 'triggerOnEvent', data: 'player_enters_dungeon' },
        { type: 'triggerOnTurn', data: 5 },
      ],
      effects: [
        { type: 'scriptedText', data: 'Dungeon text' },
        { type: 'changeObjective', data: 'Escape the dungeon' },
      ],
    });

    const world = await readWorld();
    expect(world.triggerEvents[0].triggerConditions.length).toBe(2);
    expect(world.triggerEvents[0].triggerEffects.length).toBe(2);
  });

  it('sets canTriggerMoreThanOnce when provided', async () => {
    await writeWorld(worldPath, baseWorld());
    await add_trigger({
      path: worldPath,
      name: 'Repeating',
      conditions: [{ type: 'triggerOnEvent', data: 'every_battle' }],
      effects: [{ type: 'giveGuidance', data: 'Fight well' }],
      canTriggerMoreThanOnce: true,
    });

    const world = await readWorld();
    expect(world.triggerEvents[0].canTriggerMoreThanOnce).toBe(true);
    expect(result => result); // just ensuring no throw
  });

  it('sets prerequisites and blockers when provided', async () => {
    await writeWorld(worldPath, baseWorld({ triggerEvents: [{ id: 'prereq-id', name: 'Prerequisite', triggerConditions: [], triggerEffects: [] }] }));
    await add_trigger({
      path: worldPath,
      name: 'Dependent',
      conditions: [{ type: 'triggerOnEvent', data: 'event' }],
      effects: [{ type: 'scriptedText', data: 'text' }],
      prerequisites: ['prereq-id'],
      blockers: [],
    });

    const world = await readWorld();
    const dep = world.triggerEvents.find(t => t.name === 'Dependent');
    expect(dep.prerequisites).toEqual(['prereq-id']);
  });

  it('throws when no conditions provided', async () => {
    await writeWorld(worldPath, baseWorld());
    await expect(add_trigger({
      path: worldPath,
      name: 'Bad',
      conditions: [],
      effects: [{ type: 'scriptedText', data: 'text' }],
    })).rejects.toThrow(/condition/i);
  });

  it('throws when no effects provided', async () => {
    await writeWorld(worldPath, baseWorld());
    await expect(add_trigger({
      path: worldPath,
      name: 'Bad',
      conditions: [{ type: 'triggerOnEvent', data: 'ev' }],
      effects: [],
    })).rejects.toThrow(/effect/i);
  });

  it('throws for invalid condition type', async () => {
    await writeWorld(worldPath, baseWorld());
    await expect(add_trigger({
      path: worldPath,
      name: 'Bad',
      conditions: [{ type: 'notACondition', data: 'x' }],
      effects: [{ type: 'scriptedText', data: 'text' }],
    })).rejects.toThrow(/condition type/i);
  });

  it('throws for invalid effect type', async () => {
    await writeWorld(worldPath, baseWorld());
    await expect(add_trigger({
      path: worldPath,
      name: 'Bad',
      conditions: [{ type: 'triggerOnEvent', data: 'ev' }],
      effects: [{ type: 'notAnEffect', data: 'x' }],
    })).rejects.toThrow(/effect type/i);
  });

  it('adds trigger via legacy conditionType/conditionData params', async () => {
    await writeWorld(worldPath, baseWorld());
    await add_trigger({
      path: worldPath,
      name: 'Legacy',
      conditionType: 'triggerOnEvent',
      conditionData: 'event',
      effectType: 'scriptedText',
      effectData: 'text',
    });

    const world = await readWorld();
    expect(world.triggerEvents.length).toBe(1);
    expect(world.triggerEvents[0].name).toBe('Legacy');
  });

  it('coerces triggerOnTurn condition data to integer', async () => {
    await writeWorld(worldPath, baseWorld());
    await add_trigger({
      path: worldPath,
      name: 'Turn5',
      conditions: [{ type: 'triggerOnTurn', data: '5' }],
      effects: [{ type: 'scriptedText', data: 'Turn 5!' }],
    });

    const world = await readWorld();
    expect(world.triggerEvents[0].triggerConditions[0].data).toBe(5);
  });

  it('coerces triggerOnStartOfGame condition data to boolean', async () => {
    await writeWorld(worldPath, baseWorld());
    await add_trigger({
      path: worldPath,
      name: 'Start',
      conditions: [{ type: 'triggerOnStartOfGame', data: 'true' }],
      effects: [{ type: 'scriptedText', data: 'Started!' }],
    });

    const world = await readWorld();
    expect(world.triggerEvents[0].triggerConditions[0].data).toBe(true);
  });

  it('generates unique IDs for conditions and effects', async () => {
    await writeWorld(worldPath, baseWorld());
    await add_trigger({
      path: worldPath,
      name: 'IDs',
      conditions: [{ type: 'triggerOnEvent', data: 'ev' }],
      effects: [{ type: 'scriptedText', data: 'text' }],
    });

    const world = await readWorld();
    expect(world.triggerEvents[0].id).toBeDefined();
    expect(world.triggerEvents[0].triggerConditions[0].id).toBeDefined();
    expect(world.triggerEvents[0].triggerEffects[0].id).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// modify_character
// ---------------------------------------------------------------------------

describe('modify_character', () => {
  beforeEach(async () => {
    await writeWorld(worldPath, baseWorld({
      possibleCharacters: [
        { characterId: 'c1', name: 'Hero', description: 'Old desc', portrait: 'old.png', skills: { Combat: 3 } },
        { characterId: 'c2', name: 'Rogue', description: 'Sneaky', portrait: 'rogue.png' },
      ],
    }));
  });

  it('updates description', async () => {
    const result = await modify_character({ path: worldPath, name: 'Hero', description: 'New description' });
    expect(result.content[0].text).toContain('modified successfully');
    const world = await readWorld();
    expect(world.possibleCharacters[0].description).toBe('New description');
  });

  it('updates portrait', async () => {
    await modify_character({ path: worldPath, name: 'Hero', portrait: 'new.png' });
    const world = await readWorld();
    expect(world.possibleCharacters[0].portrait).toBe('new.png');
  });

  it('updates skills', async () => {
    const newSkills = { Combat: 5, Stealth: 4, Persuasion: 1 };
    await modify_character({ path: worldPath, name: 'Hero', skills: newSkills });
    const world = await readWorld();
    expect(world.possibleCharacters[0].skills).toEqual(newSkills);
  });

  it('preserves characterId when updating', async () => {
    await modify_character({ path: worldPath, name: 'Hero', description: 'Changed' });
    const world = await readWorld();
    expect(world.possibleCharacters[0].characterId).toBe('c1');
  });

  it('only modifies the named character, not others', async () => {
    await modify_character({ path: worldPath, name: 'Hero', description: 'Changed' });
    const world = await readWorld();
    expect(world.possibleCharacters[1].description).toBe('Sneaky');
  });

  it('throws for character not found', async () => {
    await expect(
      modify_character({ path: worldPath, name: 'NonExistent', description: 'X' })
    ).rejects.toThrow(/not found/);
  });

  it('error message lists available characters', async () => {
    await expect(
      modify_character({ path: worldPath, name: 'Ghost', description: 'X' })
    ).rejects.toThrow(/Hero/);
  });

  it('throws for missing name', async () => {
    await expect(
      modify_character({ path: worldPath, description: 'X' })
    ).rejects.toThrow(/name/i);
  });

  it('throws for invalid skill values', async () => {
    await expect(
      modify_character({ path: worldPath, name: 'Hero', skills: { Combat: 10 } })
    ).rejects.toThrow();
  });

  it('throws for missing world file', async () => {
    await expect(
      modify_character({ path: path.join(tmpDir, 'missing.json'), name: 'Hero', description: 'X' })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// modify_npc
// ---------------------------------------------------------------------------

describe('modify_npc', () => {
  beforeEach(async () => {
    await writeWorld(worldPath, baseWorld({
      NPCs: [
        { id: 'n1', name: 'Innkeeper', detail: 'Old detail', one_liner: 'Runs the inn', appearance: 'Stout', location: 'Inn', secret_info: 'Spy', names: ['Bob', 'Robert'], img_appearance: 'stout man', img_clothing: 'apron' },
        { id: 'n2', name: 'Blacksmith', detail: 'Strong', one_liner: 'Makes weapons' },
      ],
    }));
  });

  it('updates detail', async () => {
    const result = await modify_npc({ path: worldPath, name: 'Innkeeper', detail: 'New detailed description' });
    expect(result.content[0].text).toContain('modified successfully');
    const world = await readWorld();
    expect(world.NPCs[0].detail).toBe('New detailed description');
  });

  it('updates one_liner', async () => {
    await modify_npc({ path: worldPath, name: 'Innkeeper', one_liner: 'New summary' });
    const world = await readWorld();
    expect(world.NPCs[0].one_liner).toBe('New summary');
  });

  it('updates appearance', async () => {
    await modify_npc({ path: worldPath, name: 'Innkeeper', appearance: 'Tall and thin' });
    const world = await readWorld();
    expect(world.NPCs[0].appearance).toBe('Tall and thin');
  });

  it('updates location', async () => {
    await modify_npc({ path: worldPath, name: 'Innkeeper', location: 'Market' });
    const world = await readWorld();
    expect(world.NPCs[0].location).toBe('Market');
  });

  it('updates secret_info', async () => {
    await modify_npc({ path: worldPath, name: 'Innkeeper', secret_info: 'New secret' });
    const world = await readWorld();
    expect(world.NPCs[0].secret_info).toBe('New secret');
  });

  it('updates names array', async () => {
    await modify_npc({ path: worldPath, name: 'Innkeeper', names: ['Robert', 'Bob', 'Robin'] });
    const world = await readWorld();
    expect(world.NPCs[0].names).toEqual(['Robert', 'Bob', 'Robin']);
  });

  it('updates img_appearance and img_clothing', async () => {
    await modify_npc({ path: worldPath, name: 'Innkeeper', img_appearance: 'round face', img_clothing: 'leather vest' });
    const world = await readWorld();
    expect(world.NPCs[0].img_appearance).toBe('round face');
    expect(world.NPCs[0].img_clothing).toBe('leather vest');
  });

  it('preserves id when modifying', async () => {
    await modify_npc({ path: worldPath, name: 'Innkeeper', detail: 'Changed' });
    const world = await readWorld();
    expect(world.NPCs[0].id).toBe('n1');
  });

  it('only modifies the named NPC', async () => {
    await modify_npc({ path: worldPath, name: 'Innkeeper', detail: 'Changed' });
    const world = await readWorld();
    expect(world.NPCs[1].detail).toBe('Strong');
  });

  it('throws for NPC not found', async () => {
    await expect(modify_npc({ path: worldPath, name: 'Ghost', detail: 'X' })).rejects.toThrow(/not found/);
  });

  it('error message lists available NPCs', async () => {
    await expect(modify_npc({ path: worldPath, name: 'Ghost', detail: 'X' })).rejects.toThrow(/Innkeeper/);
  });

  it('throws for missing name', async () => {
    await expect(modify_npc({ path: worldPath, detail: 'X' })).rejects.toThrow(/name/i);
  });

  it('throws for missing world file', async () => {
    await expect(
      modify_npc({ path: path.join(tmpDir, 'missing.json'), name: 'Anyone', detail: 'X' })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// modify_tracked_item
// ---------------------------------------------------------------------------

describe('modify_tracked_item', () => {
  beforeEach(async () => {
    await writeWorld(worldPath, baseWorld({
      trackedItems: [
        { id: 'ti1', name: 'Health', dataType: 'number', visibility: 'everyone', description: 'HP', updateInstructions: 'Decrease on hit', initialValue: '100' },
        { id: 'ti2', name: 'Mana', dataType: 'number', visibility: 'player_only', description: 'MP', updateInstructions: '', initialValue: '50' },
      ],
    }));
  });

  it('updates dataType', async () => {
    const result = await modify_tracked_item({ path: worldPath, name: 'Health', dataType: 'text' });
    expect(result.content[0].text).toContain('modified successfully');
    const world = await readWorld();
    expect(world.trackedItems[0].dataType).toBe('text');
  });

  it('updates visibility', async () => {
    await modify_tracked_item({ path: worldPath, name: 'Health', visibility: 'ai_only' });
    const world = await readWorld();
    expect(world.trackedItems[0].visibility).toBe('ai_only');
  });

  it('updates description', async () => {
    await modify_tracked_item({ path: worldPath, name: 'Health', description: 'Hit points' });
    const world = await readWorld();
    expect(world.trackedItems[0].description).toBe('Hit points');
  });

  it('updates updateInstructions', async () => {
    await modify_tracked_item({ path: worldPath, name: 'Health', updateInstructions: 'Reduce by damage dealt' });
    const world = await readWorld();
    expect(world.trackedItems[0].updateInstructions).toBe('Reduce by damage dealt');
  });

  it('updates initialValue', async () => {
    await modify_tracked_item({ path: worldPath, name: 'Health', initialValue: '200' });
    const world = await readWorld();
    expect(world.trackedItems[0].initialValue).toBe('200');
  });

  it('preserves id when modifying', async () => {
    await modify_tracked_item({ path: worldPath, name: 'Health', description: 'Changed' });
    const world = await readWorld();
    expect(world.trackedItems[0].id).toBe('ti1');
  });

  it('only modifies the named item', async () => {
    await modify_tracked_item({ path: worldPath, name: 'Health', description: 'Changed' });
    const world = await readWorld();
    expect(world.trackedItems[1].description).toBe('MP');
  });

  it('throws for tracked item not found', async () => {
    await expect(
      modify_tracked_item({ path: worldPath, name: 'Stamina', description: 'X' })
    ).rejects.toThrow(/not found/);
  });

  it('error message lists available tracked items', async () => {
    await expect(
      modify_tracked_item({ path: worldPath, name: 'Missing', description: 'X' })
    ).rejects.toThrow(/Health/);
  });

  it('throws for missing name', async () => {
    await expect(modify_tracked_item({ path: worldPath, dataType: 'text' })).rejects.toThrow(/name/i);
  });

  it('throws for invalid dataType', async () => {
    await expect(
      modify_tracked_item({ path: worldPath, name: 'Health', dataType: 'invalid' })
    ).rejects.toThrow();
  });

  it('throws for invalid visibility', async () => {
    await expect(
      modify_tracked_item({ path: worldPath, name: 'Health', visibility: 'invalid' })
    ).rejects.toThrow();
  });

  it('throws for missing world file', async () => {
    await expect(
      modify_tracked_item({ path: path.join(tmpDir, 'missing.json'), name: 'Health', description: 'X' })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// modify_trigger_event
// ---------------------------------------------------------------------------

describe('modify_trigger_event', () => {
  beforeEach(async () => {
    await writeWorld(worldPath, baseWorld({
      triggerEvents: [
        {
          id: 'trig1',
          name: 'Game Start',
          triggerConditions: [{ id: 'c1', type: 'triggerOnStartOfGame', data: true, category: 'condition' }],
          triggerEffects: [{ id: 'e1', type: 'scriptedText', data: 'Welcome!' }],
          canTriggerMoreThanOnce: false,
        },
        {
          id: 'trig2',
          name: 'Victory',
          triggerConditions: [{ id: 'c2', type: 'triggerOnEvent', data: 'win', category: 'condition' }],
          triggerEffects: [{ id: 'e2', type: 'endsGame', data: '' }],
        },
      ],
    }));
  });

  it('updates trigger name via newName', async () => {
    const result = await modify_trigger_event({ path: worldPath, name: 'Game Start', newName: 'Adventure Begins' });
    expect(result.content[0].text).toContain('Adventure Begins');
    const world = await readWorld();
    expect(world.triggerEvents[0].name).toBe('Adventure Begins');
  });

  it('replaces conditions', async () => {
    await modify_trigger_event({
      path: worldPath,
      name: 'Game Start',
      conditions: [{ type: 'triggerOnTurn', data: 1 }],
    });
    const world = await readWorld();
    expect(world.triggerEvents[0].triggerConditions[0].type).toBe('triggerOnTurn');
    expect(world.triggerEvents[0].triggerConditions[0].data).toBe(1);
  });

  it('replaces effects', async () => {
    await modify_trigger_event({
      path: worldPath,
      name: 'Game Start',
      effects: [{ type: 'changeObjective', data: 'New objective' }],
    });
    const world = await readWorld();
    expect(world.triggerEvents[0].triggerEffects[0].type).toBe('changeObjective');
    expect(world.triggerEvents[0].triggerEffects[0].data).toBe('New objective');
  });

  it('updates canTriggerMoreThanOnce', async () => {
    await modify_trigger_event({ path: worldPath, name: 'Game Start', canTriggerMoreThanOnce: true });
    const world = await readWorld();
    expect(world.triggerEvents[0].canTriggerMoreThanOnce).toBe(true);
  });

  it('updates prerequisites', async () => {
    await modify_trigger_event({ path: worldPath, name: 'Victory', prerequisites: ['trig1'] });
    const world = await readWorld();
    expect(world.triggerEvents[1].prerequisites).toEqual(['trig1']);
  });

  it('updates blockers', async () => {
    await modify_trigger_event({ path: worldPath, name: 'Victory', blockers: ['trig1'] });
    const world = await readWorld();
    expect(world.triggerEvents[1].blockers).toEqual(['trig1']);
  });

  it('preserves id when modifying', async () => {
    await modify_trigger_event({ path: worldPath, name: 'Game Start', newName: 'Renamed' });
    const world = await readWorld();
    expect(world.triggerEvents[0].id).toBe('trig1');
  });

  it('only modifies the named trigger', async () => {
    await modify_trigger_event({ path: worldPath, name: 'Game Start', newName: 'Changed' });
    const world = await readWorld();
    expect(world.triggerEvents[1].name).toBe('Victory');
  });

  it('new conditions get new UUIDs', async () => {
    await modify_trigger_event({
      path: worldPath,
      name: 'Game Start',
      conditions: [{ type: 'triggerOnEvent', data: 'new_event' }],
    });
    const world = await readWorld();
    const newId = world.triggerEvents[0].triggerConditions[0].id;
    expect(newId).toBeDefined();
    expect(newId).not.toBe('c1');
  });

  it('throws for trigger not found', async () => {
    await expect(
      modify_trigger_event({ path: worldPath, name: 'NonExistent', newName: 'X' })
    ).rejects.toThrow(/not found/);
  });

  it('error message lists available triggers', async () => {
    await expect(
      modify_trigger_event({ path: worldPath, name: 'Ghost' })
    ).rejects.toThrow(/Game Start/);
  });

  it('throws for missing name', async () => {
    await expect(modify_trigger_event({ path: worldPath, newName: 'X' })).rejects.toThrow(/name/i);
  });

  it('throws for invalid condition type in replacement', async () => {
    await expect(
      modify_trigger_event({
        path: worldPath,
        name: 'Game Start',
        conditions: [{ type: 'badCondition', data: 'x' }],
      })
    ).rejects.toThrow(/condition type/i);
  });

  it('throws for invalid effect type in replacement', async () => {
    await expect(
      modify_trigger_event({
        path: worldPath,
        name: 'Game Start',
        effects: [{ type: 'badEffect', data: 'x' }],
      })
    ).rejects.toThrow(/effect type/i);
  });

  it('throws for missing world file', async () => {
    await expect(
      modify_trigger_event({ path: path.join(tmpDir, 'missing.json'), name: 'Game Start' })
    ).rejects.toThrow();
  });
});
