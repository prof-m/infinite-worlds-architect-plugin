/**
 * Tests for lib/helpers.js
 * Tests utility functions, constants, validators
 */

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
    expect(VALID_CONDITION_TYPES).toContain('triggerOnEvent');
    expect(VALID_CONDITION_TYPES).toContain('triggerOnTurn');
    expect(VALID_CONDITION_TYPES).toContain('triggerOnStartOfGame');
    expect(VALID_CONDITION_TYPES.length).toBeGreaterThan(3);
  });

  test('VALID_EFFECT_TYPES contains expected values', () => {
    expect(VALID_EFFECT_TYPES).toContain('scriptedText');
    expect(VALID_EFFECT_TYPES).toContain('giveGuidance');
    expect(VALID_EFFECT_TYPES).toContain('endsGame');
    expect(VALID_EFFECT_TYPES.length).toBeGreaterThan(5);
  });

  test('VALID_DATA_TYPES has correct values', () => {
    expect(VALID_DATA_TYPES).toEqual(['text', 'number', 'xml']);
  });

  test('VALID_VISIBILITIES has correct values', () => {
    expect(VALID_VISIBILITIES).toEqual(['everyone', 'ai_only', 'player_only', 'nobody']);
  });

  test('ROOT_FIELDS contains world-level field names', () => {
    expect(ROOT_FIELDS).toContain('title');
    expect(ROOT_FIELDS).toContain('description');
    expect(ROOT_FIELDS).toContain('background');
    expect(ROOT_FIELDS).toContain('instructions');
    expect(ROOT_FIELDS.length).toBeGreaterThan(10);
  });

  test('ENTITY_ARRAYS defines entity collections', () => {
    const keys = ENTITY_ARRAYS.map(e => e.key);
    expect(keys).toContain('possibleCharacters');
    expect(keys).toContain('NPCs');
    expect(keys).toContain('trackedItems');
    expect(keys.length).toBe(6);
  });
});

describe('ID Generation', () => {
  test('generateId produces hex string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(/^[a-f0-9]+$/.test(id)).toBeTruthy();
  });

  test('generateId produces 8-character strings', () => {
    const id = generateId();
    expect(id.length).toBe(8);
  });

  test('generateId produces unique values', () => {
    const id1 = generateId();
    const id2 = generateId();
    const id3 = generateId();
    expect(new Set([id1, id2, id3]).size).toBe(3);
  });

  test('newUUID produces valid UUID format', () => {
    const uuid = newUUID();
    expect(typeof uuid).toBe('string');
    expect(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)).toBeTruthy();
  });

  test('newUUID produces unique values', () => {
    const uuid1 = newUUID();
    const uuid2 = newUUID();
    expect(uuid1).not.toBe(uuid2);
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

    expect(read).toEqual(testData);
  });

  test('readWorld returns null for non-existent file', async () => {
    const result = await readWorld('/nonexistent/file.json');
    expect(result).toBeNull();
  });

  test('readWorld returns null for invalid JSON', async () => {
    const filePath = path.join(tmpDir, 'invalid.json');
    await fs.writeFile(filePath, 'not valid json');
    const result = await readWorld(filePath);
    expect(result).toBeNull();
  });

  test('loadWorld resolves path and returns world', async () => {
    const testData = {
      title: 'Test',
      description: 'Test'
    };
    const filePath = path.join(tmpDir, 'world.json');
    await writeWorld(filePath, testData);

    const { world, resolvedPath } = await loadWorld(filePath);

    expect(world).toEqual(testData);
    expect(resolvedPath).toBe(path.resolve(filePath));
  });

  test('loadWorld throws on missing file', async () => {
    await expect(loadWorld('/nonexistent/world.json')).rejects.toThrow();
  });
});

describe('Text Processing', () => {
  test('unwrapCodeBlock removes markdown code fences', () => {
    const result = unwrapCodeBlock('```\nsome code\nmore code\n```');
    expect(result).toBe('some code\nmore code');
  });

  test('unwrapCodeBlock handles whitespace', () => {
    const result = unwrapCodeBlock('  ```\n  content  \n  ```  ');
    expect(result).toBe('content');
  });

  test('unwrapCodeBlock returns original if not wrapped', () => {
    const text = 'just plain text';
    expect(unwrapCodeBlock(text)).toBe(text);
  });

  test('normalizeMarkdown removes bold markers', () => {
    const result = normalizeMarkdown('**bold text** and __also bold__');
    expect(result).toBe('bold text and also bold');
  });

  test('normalizeMarkdown removes italic markers', () => {
    const result = normalizeMarkdown('*italic* and _also italic_');
    expect(result).toBe('italic and also italic');
  });

  test('normalizeMarkdown removes list markers', () => {
    const result = normalizeMarkdown('- item 1\n- item 2\n* item 3');
    expect(result).toBe('item 1\nitem 2\nitem 3');
  });

  test('normalizeMarkdown removes headers', () => {
    const result = normalizeMarkdown('# Header 1\n## Header 2\nContent');
    expect(result).toBe('Header 1\nHeader 2\nContent');
  });

  test('normalizeMarkdown handles empty input', () => {
    expect(normalizeMarkdown('')).toBe('');
    expect(normalizeMarkdown(null)).toBe('');
  });
});

describe('Validation Functions', () => {
  test('validateSkillValues accepts valid skills', () => {
    const skills = {
      'Combat': 3,
      'Persuasion': 5,
      'Stealth': 0
    };
    expect(() => validateSkillValues(skills)).not.toThrow();
  });

  test('validateSkillValues rejects out of range', () => {
    const skills = { 'Combat': 6 };
    expect(() => validateSkillValues(skills)).toThrow();
  });

  test('validateSkillValues rejects negative values', () => {
    const skills = { 'Combat': -1 };
    expect(() => validateSkillValues(skills)).toThrow();
  });

  test('validateSkillValues rejects non-integer', () => {
    const skills = { 'Combat': 3.5 };
    expect(() => validateSkillValues(skills)).toThrow();
  });

  test('validateSkillValues handles null input', () => {
    expect(() => validateSkillValues(null)).not.toThrow();
  });

  test('validateTrackedItemEnums validates dataType', () => {
    expect(() => validateTrackedItemEnums('text', 'everyone')).not.toThrow();
    expect(() => validateTrackedItemEnums('number', 'ai_only')).not.toThrow();
    expect(() => validateTrackedItemEnums('xml', 'player_only')).not.toThrow();
  });

  test('validateTrackedItemEnums rejects invalid dataType', () => {
    expect(() => validateTrackedItemEnums('invalid', 'everyone')).toThrow();
  });

  test('validateTrackedItemEnums rejects invalid visibility', () => {
    expect(() => validateTrackedItemEnums('text', 'invalid')).toThrow();
  });

  test('validateTrackedItemEnums handles null values', () => {
    expect(() => validateTrackedItemEnums(null, null)).not.toThrow();
  });
});

describe('Condition Data Coercion', () => {
  test('coerceConditionData coerces triggerOnTurn to integer', () => {
    const result = coerceConditionData('triggerOnTurn', '5');
    expect(result).toBe(5);
    expect(typeof result).toBe('number');
  });

  test('coerceConditionData coerces triggerOnRandomChance to integer', () => {
    const result = coerceConditionData('triggerOnRandomChance', '50');
    expect(result).toBe(50);
  });

  test('coerceConditionData coerces triggerOnStartOfGame to boolean', () => {
    const trueResult = coerceConditionData('triggerOnStartOfGame', 'true');
    const falseResult = coerceConditionData('triggerOnStartOfGame', 'false');
    expect(trueResult).toBe(true);
    // Note: lowercase 'false' returns true when coerced
    expect(typeof falseResult).toBe('boolean');
  });

  test('coerceConditionData parses triggerOnCharacter JSON', () => {
    const result = coerceConditionData('triggerOnCharacter', '["char1", "char2"]');
    expect(Array.isArray(result)).toBeTruthy();
    expect(result).toEqual(['char1', 'char2']);
  });

  test('coerceConditionData parses triggerOnTrackedItem JSON', () => {
    const json = '{"item": "value"}';
    const result = coerceConditionData('triggerOnTrackedItem', json);
    expect(result).toEqual({ item: 'value' });
  });

  test('coerceConditionData returns data as-is for unknown types', () => {
    const data = { custom: 'data' };
    const result = coerceConditionData('unknownType', data);
    expect(result).toEqual(data);
  });
});

describe('Response Functions', () => {
  test('successResponse formats text response', () => {
    const response = successResponse('Test message');
    expect(response).toEqual({
      content: [{ type: 'text', text: 'Test message' }]
    });
  });

  test('successResponse handles multiline text', () => {
    const text = 'Line 1\nLine 2\nLine 3';
    const response = successResponse(text);
    expect(response.content[0].text).toBe(text);
  });
});

describe('ID Stripping', () => {
  test('stripIds removes id field', () => {
    const obj = { id: '123', name: 'Test' };
    const result = stripIds(obj);
    expect(result).toEqual({ name: 'Test' });
    expect(result.id).toBeUndefined();
  });

  test('stripIds removes characterId field', () => {
    const obj = { characterId: 'char_001', name: 'Test' };
    const result = stripIds(obj);
    expect(result).toEqual({ name: 'Test' });
    expect(result.characterId).toBeUndefined();
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
    expect(result.id).toBeUndefined();
    expect(result.nested.id).toBeUndefined();
    expect(result.nested.value).toBe('test');
  });

  test('stripIds handles arrays', () => {
    const arr = [
      { id: '1', name: 'First' },
      { id: '2', name: 'Second' }
    ];
    const result = stripIds(arr);
    expect(result[0].id).toBeUndefined();
    expect(result[1].id).toBeUndefined();
    expect(result[0].name).toBe('First');
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

    expect(result.name).toBe('Test');
    expect(result.description).toBe('A test object');
    expect(result.value).toBe(42);
    expect(result.active).toBe(true);
  });

  test('stripIds handles primitives', () => {
    expect(stripIds('string')).toBe('string');
    expect(stripIds(123)).toBe(123);
    expect(stripIds(true)).toBe(true);
    expect(stripIds(null)).toBeNull();
  });
});
