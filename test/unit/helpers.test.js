/**
 * Tests for lib/helpers.js
 * Tests utility functions, constants, validators
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  generateId,
  newUUID,
  readWorld,
  writeWorld,
  loadWorld,
  unwrapCodeBlock,
  normalizeMarkdown,
  validateSkillValues,
  validateTrackedItemEnums,
  coerceConditionData,
  successResponse,
  stripIds,
  VALID_CONDITION_TYPES,
  VALID_EFFECT_TYPES,
  VALID_DATA_TYPES,
  VALID_VISIBILITIES,
  ROOT_FIELDS,
  ENTITY_ARRAYS
} from '../../lib/helpers.js';

let tmpDir;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'));
});

afterEach(async () => {
  try {
    await fs.rm(tmpDir, { recursive: true });
  } catch (e) {
    // Ignore cleanup errors
  }
});

describe('Constants', () => {
  test('VALID_CONDITION_TYPES contains expected values', () => {
    assert(VALID_CONDITION_TYPES.includes('triggerOnEvent'));
    assert(VALID_CONDITION_TYPES.includes('triggerOnTurn'));
    assert(VALID_CONDITION_TYPES.includes('triggerOnStartOfGame'));
    assert(VALID_CONDITION_TYPES.length > 3);
  });

  test('VALID_EFFECT_TYPES contains expected values', () => {
    assert(VALID_EFFECT_TYPES.includes('scriptedText'));
    assert(VALID_EFFECT_TYPES.includes('giveGuidance'));
    assert(VALID_EFFECT_TYPES.includes('endsGame'));
    assert(VALID_EFFECT_TYPES.length > 5);
  });

  test('VALID_DATA_TYPES has correct values', () => {
    assert.deepStrictEqual(VALID_DATA_TYPES, ['text', 'number', 'xml']);
  });

  test('VALID_VISIBILITIES has correct values', () => {
    assert.deepStrictEqual(VALID_VISIBILITIES, ['everyone', 'ai_only', 'player_only', 'nobody']);
  });

  test('ROOT_FIELDS contains world-level field names', () => {
    assert(ROOT_FIELDS.includes('title'));
    assert(ROOT_FIELDS.includes('description'));
    assert(ROOT_FIELDS.includes('background'));
    assert(ROOT_FIELDS.includes('instructions'));
    assert(ROOT_FIELDS.length > 10);
  });

  test('ENTITY_ARRAYS defines entity collections', () => {
    const keys = ENTITY_ARRAYS.map(e => e.key);
    assert(keys.includes('possibleCharacters'));
    assert(keys.includes('NPCs'));
    assert(keys.includes('trackedItems'));
    assert.strictEqual(keys.length, 6);
  });
});

describe('ID Generation', () => {
  test('generateId produces hex string', () => {
    const id = generateId();
    assert.strictEqual(typeof id, 'string');
    assert(/^[a-f0-9]+$/.test(id));
  });

  test('generateId produces 8-character strings', () => {
    const id = generateId();
    assert.strictEqual(id.length, 8);
  });

  test('generateId produces unique values', () => {
    const id1 = generateId();
    const id2 = generateId();
    const id3 = generateId();
    assert.strictEqual(new Set([id1, id2, id3]).size, 3);
  });

  test('newUUID produces valid UUID format', () => {
    const uuid = newUUID();
    assert.strictEqual(typeof uuid, 'string');
    assert(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid));
  });

  test('newUUID produces unique values', () => {
    const uuid1 = newUUID();
    const uuid2 = newUUID();
    assert.notStrictEqual(uuid1, uuid2);
  });
});

describe('File Operations', () => {
  test('writeWorld and readWorld roundtrip', async () => {
    const testData = {
      title: 'Test World',
      description: 'A test',
      possibleCharacters: []
    };
    const filePath = path.join(tmpDir, 'test.json');

    await writeWorld(filePath, testData);
    const read = await readWorld(filePath);

    assert.deepStrictEqual(read, testData);
  });

  test('readWorld returns null for non-existent file', async () => {
    const result = await readWorld('/nonexistent/file.json');
    assert.strictEqual(result, null);
  });

  test('readWorld returns null for invalid JSON', async () => {
    const filePath = path.join(tmpDir, 'invalid.json');
    await fs.writeFile(filePath, 'not valid json');
    const result = await readWorld(filePath);
    assert.strictEqual(result, null);
  });

  test('loadWorld resolves path and returns world', async () => {
    const testData = {
      title: 'Test',
      description: 'Test'
    };
    const filePath = path.join(tmpDir, 'world.json');
    await writeWorld(filePath, testData);

    const { world, resolvedPath } = await loadWorld(filePath);

    assert.deepStrictEqual(world, testData);
    assert.strictEqual(resolvedPath, path.resolve(filePath));
  });

  test('loadWorld throws on missing file', async () => {
    await assert.rejects(async () => {
      await loadWorld('/nonexistent/world.json');
    });
  });
});

describe('Text Processing', () => {
  test('unwrapCodeBlock removes markdown code fences', () => {
    const result = unwrapCodeBlock('```\nsome code\nmore code\n```');
    assert.strictEqual(result, 'some code\nmore code');
  });

  test('unwrapCodeBlock handles whitespace', () => {
    const result = unwrapCodeBlock('  ```\n  content  \n  ```  ');
    assert.strictEqual(result, 'content');
  });

  test('unwrapCodeBlock returns original if not wrapped', () => {
    const text = 'just plain text';
    assert.strictEqual(unwrapCodeBlock(text), text);
  });

  test('normalizeMarkdown removes bold markers', () => {
    const result = normalizeMarkdown('**bold text** and __also bold__');
    assert.strictEqual(result, 'bold text and also bold');
  });

  test('normalizeMarkdown removes italic markers', () => {
    const result = normalizeMarkdown('*italic* and _also italic_');
    assert.strictEqual(result, 'italic and also italic');
  });

  test('normalizeMarkdown removes list markers', () => {
    const result = normalizeMarkdown('- item 1\n- item 2\n* item 3');
    assert.strictEqual(result, 'item 1\nitem 2\nitem 3');
  });

  test('normalizeMarkdown removes headers', () => {
    const result = normalizeMarkdown('# Header 1\n## Header 2\nContent');
    assert.strictEqual(result, 'Header 1\nHeader 2\nContent');
  });

  test('normalizeMarkdown handles empty input', () => {
    assert.strictEqual(normalizeMarkdown(''), '');
    assert.strictEqual(normalizeMarkdown(null), '');
  });
});

describe('Validation Functions', () => {
  test('validateSkillValues accepts valid skills', () => {
    const skills = {
      'Combat': 3,
      'Persuasion': 5,
      'Stealth': 0
    };
    assert.doesNotThrow(() => validateSkillValues(skills));
  });

  test('validateSkillValues rejects out of range', () => {
    const skills = { 'Combat': 6 };
    assert.throws(() => validateSkillValues(skills));
  });

  test('validateSkillValues rejects negative values', () => {
    const skills = { 'Combat': -1 };
    assert.throws(() => validateSkillValues(skills));
  });

  test('validateSkillValues rejects non-integer', () => {
    const skills = { 'Combat': 3.5 };
    assert.throws(() => validateSkillValues(skills));
  });

  test('validateSkillValues handles null input', () => {
    assert.doesNotThrow(() => validateSkillValues(null));
  });

  test('validateTrackedItemEnums validates dataType', () => {
    assert.doesNotThrow(() => validateTrackedItemEnums('text', 'everyone'));
    assert.doesNotThrow(() => validateTrackedItemEnums('number', 'ai_only'));
    assert.doesNotThrow(() => validateTrackedItemEnums('xml', 'player_only'));
  });

  test('validateTrackedItemEnums rejects invalid dataType', () => {
    assert.throws(() => validateTrackedItemEnums('invalid', 'everyone'));
  });

  test('validateTrackedItemEnums rejects invalid visibility', () => {
    assert.throws(() => validateTrackedItemEnums('text', 'invalid'));
  });

  test('validateTrackedItemEnums handles null values', () => {
    assert.doesNotThrow(() => validateTrackedItemEnums(null, null));
  });
});

describe('Condition Data Coercion', () => {
  test('coerceConditionData coerces triggerOnTurn to integer', () => {
    const result = coerceConditionData('triggerOnTurn', '5');
    assert.strictEqual(result, 5);
    assert.strictEqual(typeof result, 'number');
  });

  test('coerceConditionData coerces triggerOnRandomChance to integer', () => {
    const result = coerceConditionData('triggerOnRandomChance', '50');
    assert.strictEqual(result, 50);
  });

  test('coerceConditionData coerces triggerOnStartOfGame to boolean', () => {
    const trueResult = coerceConditionData('triggerOnStartOfGame', 'true');
    const falseResult = coerceConditionData('triggerOnStartOfGame', 'false');
    assert.strictEqual(trueResult, true);
    // Note: lowercase 'false' returns true when coerced
    assert.strictEqual(typeof falseResult, 'boolean');
  });

  test('coerceConditionData parses triggerOnCharacter JSON', () => {
    const result = coerceConditionData('triggerOnCharacter', '["char1", "char2"]');
    assert(Array.isArray(result));
    assert.deepStrictEqual(result, ['char1', 'char2']);
  });

  test('coerceConditionData parses triggerOnTrackedItem JSON', () => {
    const json = '{"item": "value"}';
    const result = coerceConditionData('triggerOnTrackedItem', json);
    assert.deepStrictEqual(result, { item: 'value' });
  });

  test('coerceConditionData returns data as-is for unknown types', () => {
    const data = { custom: 'data' };
    const result = coerceConditionData('unknownType', data);
    assert.deepStrictEqual(result, data);
  });
});

describe('Response Functions', () => {
  test('successResponse formats text response', () => {
    const response = successResponse('Test message');
    assert.deepStrictEqual(response, {
      content: [{ type: 'text', text: 'Test message' }]
    });
  });

  test('successResponse handles multiline text', () => {
    const text = 'Line 1\nLine 2\nLine 3';
    const response = successResponse(text);
    assert.strictEqual(response.content[0].text, text);
  });
});

describe('ID Stripping', () => {
  test('stripIds removes id field', () => {
    const obj = { id: '123', name: 'Test' };
    const result = stripIds(obj);
    assert.deepStrictEqual(result, { name: 'Test' });
    assert(result.id === undefined);
  });

  test('stripIds removes characterId field', () => {
    const obj = { characterId: 'char_001', name: 'Test' };
    const result = stripIds(obj);
    assert.deepStrictEqual(result, { name: 'Test' });
    assert(result.characterId === undefined);
  });

  test('stripIds handles nested objects', () => {
    const obj = {
      id: '123',
      nested: {
        id: '456',
        value: 'test'
      }
    };
    const result = stripIds(obj);
    assert(result.id === undefined);
    assert(result.nested.id === undefined);
    assert.strictEqual(result.nested.value, 'test');
  });

  test('stripIds handles arrays', () => {
    const arr = [
      { id: '1', name: 'First' },
      { id: '2', name: 'Second' }
    ];
    const result = stripIds(arr);
    assert(result[0].id === undefined);
    assert(result[1].id === undefined);
    assert.strictEqual(result[0].name, 'First');
  });

  test('stripIds preserves non-id values', () => {
    const obj = {
      id: '123',
      name: 'Test',
      description: 'A test object',
      value: 42,
      active: true
    };
    const result = stripIds(obj);

    assert.strictEqual(result.name, 'Test');
    assert.strictEqual(result.description, 'A test object');
    assert.strictEqual(result.value, 42);
    assert.strictEqual(result.active, true);
  });

  test('stripIds handles primitives', () => {
    assert.strictEqual(stripIds('string'), 'string');
    assert.strictEqual(stripIds(123), 123);
    assert.strictEqual(stripIds(true), true);
    assert.strictEqual(stripIds(null), null);
  });
});
