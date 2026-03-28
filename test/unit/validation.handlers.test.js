/**
 * Tests for lib/handlers/validation.js
 * Tests world validation and error detection
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { validate_world } from '../../lib/handlers/validation.js';
import { writeWorld } from '../../lib/helpers.js';

let tmpDir, worldPath;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-validation-'));
  worldPath = path.join(tmpDir, 'world.json');
});

afterEach(async () => {
  try {
    await fs.rm(tmpDir, { recursive: true });
  } catch (e) {
    // Ignore
  }
});

const createValidWorld = (overrides = {}) => ({
  title: 'Valid World',
  description: 'A valid description',
  background: 'Valid background',
  instructions: 'Valid instructions',
  possibleCharacters: [],
  NPCs: [],
  instructionBlocks: [],
  loreBookEntries: [],
  trackedItems: [],
  triggerEvents: [],
  ...overrides
});

describe('validate_world - Required Fields', () => {
  test('accepts world with all required fields', async () => {
    const world = createValidWorld();
    await writeWorld(worldPath, world);

    const result = await validate_world({ path: worldPath });
    const resultText = result.content[0].text;

    assert(resultText.includes('Valid') || resultText.includes('valid'));
  });

  test('rejects missing title', async () => {
    const world = createValidWorld({ title: '' });
    await writeWorld(worldPath, world);

    const result = await validate_world({ path: worldPath });
    assert(result.content[0].text.includes('Required field "title"'));
  });

  test('rejects missing background', async () => {
    const world = createValidWorld({ background: '' });
    await writeWorld(worldPath, world);

    const result = await validate_world({ path: worldPath });
    assert(result.content[0].text.includes('Required field "background"'));
  });

  test('rejects missing instructions', async () => {
    const world = createValidWorld({ instructions: '' });
    await writeWorld(worldPath, world);

    const result = await validate_world({ path: worldPath });
    assert(result.content[0].text.includes('Required field "instructions"'));
  });

  test('rejects whitespace-only title', async () => {
    const world = createValidWorld({ title: '   ' });
    await writeWorld(worldPath, world);

    const result = await validate_world({ path: worldPath });
    assert(result.content[0].text.includes('Required field "title"'));
  });
});

describe('validate_world - Tracked Items', () => {
  test('rejects invalid tracked item dataType', async () => {
    const world = createValidWorld({
      trackedItems: [
        {
          id: 'item_001',
          name: 'Bad Item',
          dataType: 'invalid',
          visibility: 'everyone'
        }
      ]
    });
    await writeWorld(worldPath, world);

    const result = await validate_world({ path: worldPath });
    assert(result.content[0].text.includes('invalid dataType'));
  });

  test('rejects invalid tracked item visibility', async () => {
    const world = createValidWorld({
      trackedItems: [
        {
          id: 'item_001',
          name: 'Bad Item',
          dataType: 'text',
          visibility: 'invalid'
        }
      ]
    });
    await writeWorld(worldPath, world);

    const result = await validate_world({ path: worldPath });
    assert(result.content[0].text.includes('invalid visibility'));
  });

  test('accepts valid tracked item types', async () => {
    const world = createValidWorld({
      trackedItems: [
        {
          id: 'item_001',
          name: 'Health',
          dataType: 'number',
          visibility: 'everyone'
        },
        {
          id: 'item_002',
          name: 'Secrets',
          dataType: 'xml',
          visibility: 'ai_only'
        }
      ]
    });
    await writeWorld(worldPath, world);

    const result = await validate_world({ path: worldPath });
    assert(!result.content[0].text.includes('invalid dataType'));
    assert(!result.content[0].text.includes('invalid visibility'));
  });
});

describe('validate_world - Trigger Conditions', () => {
  test('rejects invalid trigger condition type', async () => {
    const world = createValidWorld({
      triggerEvents: [
        {
          id: 'trigger_001',
          name: 'Bad Trigger',
          triggerConditions: [
            {
              id: 'cond_001',
              type: 'invalidType',
              data: 'test'
            }
          ],
          triggerEffects: []
        }
      ]
    });
    await writeWorld(worldPath, world);

    const result = await validate_world({ path: worldPath });
    assert(result.content[0].text.includes('invalid condition type'));
  });

  test('accepts valid trigger condition types', async () => {
    const world = createValidWorld({
      triggerEvents: [
        {
          id: 'trigger_001',
          name: 'Good Trigger',
          triggerConditions: [
            { id: 'cond_001', type: 'triggerOnEvent', data: 'test' },
            { id: 'cond_002', type: 'triggerOnTurn', data: '5' },
            { id: 'cond_003', type: 'triggerOnStartOfGame', data: 'true' }
          ],
          triggerEffects: []
        }
      ]
    });
    await writeWorld(worldPath, world);

    const result = await validate_world({ path: worldPath });
    assert(!result.content[0].text.includes('invalid condition type'));
  });
});

describe('validate_world - Trigger Effects', () => {
  test('rejects invalid trigger effect type', async () => {
    const world = createValidWorld({
      triggerEvents: [
        {
          id: 'trigger_001',
          name: 'Bad Trigger',
          triggerConditions: [],
          triggerEffects: [
            {
              id: 'eff_001',
              type: 'invalidEffect',
              data: 'test'
            }
          ]
        }
      ]
    });
    await writeWorld(worldPath, world);

    const result = await validate_world({ path: worldPath });
    assert(result.content[0].text.includes('invalid effect type'));
  });

  test('accepts valid trigger effect types', async () => {
    const world = createValidWorld({
      triggerEvents: [
        {
          id: 'trigger_001',
          name: 'Good Trigger',
          triggerConditions: [],
          triggerEffects: [
            { id: 'eff_001', type: 'scriptedText', data: 'text' },
            { id: 'eff_002', type: 'endsGame', data: '' },
            { id: 'eff_003', type: 'changeObjective', data: 'new objective' }
          ]
        }
      ]
    });
    await writeWorld(worldPath, world);

    const result = await validate_world({ path: worldPath });
    assert(!result.content[0].text.includes('invalid effect type'));
  });
});

describe('validate_world - Character Skills', () => {
  test('rejects skill value out of range', async () => {
    const world = createValidWorld({
      possibleCharacters: [
        {
          characterId: 'char_001',
          name: 'Bad Character',
          skills: {
            'Combat': 6
          }
        }
      ]
    });
    await writeWorld(worldPath, world);

    const result = await validate_world({ path: worldPath });
    assert(result.content[0].text.includes('invalid value 6'));
  });

  test('rejects negative skill value', async () => {
    const world = createValidWorld({
      possibleCharacters: [
        {
          characterId: 'char_001',
          name: 'Bad Character',
          skills: {
            'Combat': -1
          }
        }
      ]
    });
    await writeWorld(worldPath, world);

    const result = await validate_world({ path: worldPath });
    assert(result.content[0].text.includes('invalid value -1'));
  });

  test('accepts valid skill values (0-5)', async () => {
    const world = createValidWorld({
      possibleCharacters: [
        {
          characterId: 'char_001',
          name: 'Good Character',
          skills: {
            'Combat': 0,
            'Persuasion': 3,
            'Stealth': 5
          }
        }
      ]
    });
    await writeWorld(worldPath, world);

    const result = await validate_world({ path: worldPath });
    assert(!result.content[0].text.includes('invalid value'));
  });
});

describe('validate_world - ID Uniqueness', () => {
  test('detects duplicate IDs across entity arrays', async () => {
    const duplicateId = 'duplicate_001';
    const world = createValidWorld({
      trackedItems: [
        { id: duplicateId, name: 'Item 1' }
      ],
      instructionBlocks: [
        { id: duplicateId, name: 'Block 1' }
      ]
    });
    await writeWorld(worldPath, world);

    const result = await validate_world({ path: worldPath });
    assert(result.content[0].text.includes('Duplicate id'));
  });

  test('accepts unique IDs across entities', async () => {
    const world = createValidWorld({
      trackedItems: [
        { id: 'item_001', name: 'Item 1' },
        { id: 'item_002', name: 'Item 2' }
      ],
      instructionBlocks: [
        { id: 'block_001', name: 'Block 1' },
        { id: 'block_002', name: 'Block 2' }
      ]
    });
    await writeWorld(worldPath, world);

    const result = await validate_world({ path: worldPath });
    assert(!result.content[0].text.includes('Duplicate id'));
  });
});

describe('validate_world - Error Handling', () => {
  test('throws error for non-existent world file', async () => {
    await assert.rejects(async () => {
      await validate_world({ path: path.join(tmpDir, 'nonexistent.json') });
    });
  });

  test('handles empty entity arrays gracefully', async () => {
    const world = createValidWorld({
      possibleCharacters: [],
      NPCs: [],
      triggerEvents: []
    });
    await writeWorld(worldPath, world);

    const result = await validate_world({ path: worldPath });
    assert(result.content !== undefined);
    assert(result.content.length > 0);
  });

  test('validates world with all entity types populated', async () => {
    const world = createValidWorld({
      possibleCharacters: [
        {
          characterId: 'char_001',
          name: 'Character 1',
          skills: { Combat: 3 }
        }
      ],
      NPCs: [
        { id: 'npc_001', name: 'NPC 1' }
      ],
      instructionBlocks: [
        { id: 'block_001', name: 'Block 1', content: 'Content' }
      ],
      loreBookEntries: [
        { id: 'lore_001', name: 'Lore 1', content: 'Content', keywords: ['test'] }
      ],
      trackedItems: [
        { id: 'item_001', name: 'Item 1', dataType: 'number', visibility: 'everyone' }
      ],
      triggerEvents: [
        {
          id: 'trigger_001',
          name: 'Trigger 1',
          triggerConditions: [{ id: 'cond_001', type: 'triggerOnEvent', data: 'test' }],
          triggerEffects: [{ id: 'eff_001', type: 'scriptedText', data: 'text' }]
        }
      ]
    });
    await writeWorld(worldPath, world);

    const result = await validate_world({ path: worldPath });
    assert(typeof result.content[0].text === 'string');
  });
});
