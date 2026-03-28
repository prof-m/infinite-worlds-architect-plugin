/**
 * Tests for lib/handlers/character-indexer.js
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { indexCharacters } from '../../lib/handlers/character-indexer.js';

test('indexCharacters - returns null for empty character list', async (t) => {
  const parsedTurns = [
    {
      number: 1,
      action: 'Character does something',
      outcome: 'It works',
      source: 'test.txt',
      lineRange: [1, 10],
    },
  ];

  const sourceFileData = new Map();
  sourceFileData.set('test.txt', 'Line 1\nCharacter does something\nLine 3');

  const result = await indexCharacters(parsedTurns, sourceFileData, []);

  assert.strictEqual(result.characterIndex, null);
  assert.deepStrictEqual(result.warnings, []);
});

test('indexCharacters - returns null for null character list', async (t) => {
  const parsedTurns = [
    {
      number: 1,
      action: 'Character does something',
      outcome: 'It works',
      source: 'test.txt',
      lineRange: [1, 10],
    },
  ];

  const sourceFileData = new Map();
  sourceFileData.set('test.txt', 'Line 1\nCharacter does something\nLine 3');

  const result = await indexCharacters(parsedTurns, sourceFileData, null);

  assert.strictEqual(result.characterIndex, null);
});

test('indexCharacters - finds exact character matches', async (t) => {
  const sourceText = 'Line 1: Victor enters\nLine 2: He looks around\nLine 3: Victor nods';
  const lines = sourceText.split('\n');
  const lineRange = [1, lines.length];

  const parsedTurns = [
    {
      number: 1,
      action: 'Victor enters the room',
      outcome: 'Victor nods',
      source: 'test.txt',
      lineRange,
    },
  ];

  const sourceFileData = new Map();
  sourceFileData.set('test.txt', sourceText);

  const result = await indexCharacters(parsedTurns, sourceFileData, [
    { name: 'Victor', aliases: [] },
  ]);

  assert.strictEqual(result.characterIndex !== null, true);
  assert.strictEqual(result.characterIndex.characters['Victor'] !== undefined, true);
  assert.strictEqual(result.characterIndex.characters['Victor'].mentions.length > 0, true);
  assert.strictEqual(result.characterIndex.total_mentions >= 1, true);
});

test('indexCharacters - handles aliases', async (t) => {
  const sourceText = 'Line 1: Victor enters\nLine 2: The Maestro is here\nLine 3: Victor smiles';
  const lines = sourceText.split('\n');
  const lineRange = [1, lines.length];

  const parsedTurns = [
    {
      number: 1,
      action: 'Victor and The Maestro meet',
      outcome: 'They talk',
      source: 'test.txt',
      lineRange,
    },
  ];

  const sourceFileData = new Map();
  sourceFileData.set('test.txt', sourceText);

  const result = await indexCharacters(parsedTurns, sourceFileData, [
    { name: 'Victor', aliases: ['The Maestro', 'V'] },
  ]);

  assert.strictEqual(result.characterIndex !== null, true);
  assert.strictEqual(result.characterIndex.characters['Victor'].aliases.length, 2);
  assert.strictEqual(result.characterIndex.characters['Victor'].mentions.length, 1);
  assert.strictEqual(result.characterIndex.total_mentions >= 1, true);
});

test('indexCharacters - case-insensitive matching', async (t) => {
  const sourceText = 'Line 1: VICTOR enters\nLine 2: victor looks\nLine 3: Victor smiles';
  const lines = sourceText.split('\n');
  const lineRange = [1, lines.length];

  const parsedTurns = [
    {
      number: 1,
      action: 'VICTOR and victor meet',
      outcome: 'Victor talks',
      source: 'test.txt',
      lineRange,
    },
  ];

  const sourceFileData = new Map();
  sourceFileData.set('test.txt', sourceText);

  const result = await indexCharacters(parsedTurns, sourceFileData, [
    { name: 'Victor', aliases: [] },
  ]);

  assert.strictEqual(result.characterIndex.characters['Victor'].mentions.length, 1);
  assert.strictEqual(
    result.characterIndex.characters['Victor'].mentions[0].lines.length,
    3
  );
});

test('indexCharacters - avoids false positives with word boundaries', async (t) => {
  const sourceText = 'Line 1: The character is strong\nLine 2: The is not a character\nLine 3: character study';
  const lines = sourceText.split('\n');
  const lineRange = [1, lines.length];

  const parsedTurns = [
    {
      number: 1,
      action: 'The character is strong',
      outcome: 'All is well',
      source: 'test.txt',
      lineRange,
    },
  ];

  const sourceFileData = new Map();
  sourceFileData.set('test.txt', sourceText);

  const result = await indexCharacters(parsedTurns, sourceFileData, [
    { name: 'The', aliases: [] },
  ]);

  // "The" should match "The" at the start of lines
  assert.strictEqual(result.characterIndex.characters['The'].mentions.length, 1);
});

test('indexCharacters - sets incomplete flag when character not found', async (t) => {
  const sourceText = 'Line 1: Victor acts\nLine 2: Someone else does something';
  const lines = sourceText.split('\n');
  const lineRange = [1, lines.length];

  const parsedTurns = [
    {
      number: 1,
      action: 'Victor does something',
      outcome: 'Done',
      source: 'test.txt',
      lineRange,
    },
  ];

  const sourceFileData = new Map();
  sourceFileData.set('test.txt', sourceText);

  const result = await indexCharacters(parsedTurns, sourceFileData, [
    { name: 'Victor', aliases: [] },
    { name: 'Alice', aliases: [] },
  ]);

  assert.strictEqual(result.characterIndex.incomplete, true);
  assert.strictEqual(result.characterIndex.indexed_character_count, 2);
  assert.strictEqual(
    Object.values(result.characterIndex.characters).filter(c => c.mentions.length > 0)
      .length,
    1
  );
});

test('indexCharacters - includes line numbers in mentions', async (t) => {
  const sourceText =
    'Line 1: Victor starts\nLine 2: Other content\nLine 3: Victor continues\nLine 4: More stuff\nLine 5: Victor ends';
  const lines = sourceText.split('\n');
  const lineRange = [1, lines.length];

  const parsedTurns = [
    {
      number: 1,
      action: 'Victor acts multiple times',
      outcome: 'Done',
      source: 'test.txt',
      lineRange,
    },
  ];

  const sourceFileData = new Map();
  sourceFileData.set('test.txt', sourceText);

  const result = await indexCharacters(parsedTurns, sourceFileData, [
    { name: 'Victor', aliases: [] },
  ]);

  const mentions = result.characterIndex.characters['Victor'].mentions;
  assert.strictEqual(mentions.length, 1);
  assert.strictEqual(mentions[0].turn, 1);
  assert.deepStrictEqual(mentions[0].lines, [1, 3, 5]);
});

test('indexCharacters - includes context in mentions', async (t) => {
  const sourceText = 'Line 1: Victor enters the room with a smile\nLine 2: Other content';
  const lines = sourceText.split('\n');
  const lineRange = [1, lines.length];

  const parsedTurns = [
    {
      number: 1,
      action: 'Victor acts',
      outcome: 'Done',
      source: 'test.txt',
      lineRange,
    },
  ];

  const sourceFileData = new Map();
  sourceFileData.set('test.txt', sourceText);

  const result = await indexCharacters(parsedTurns, sourceFileData, [
    { name: 'Victor', aliases: [] },
  ]);

  const mentions = result.characterIndex.characters['Victor'].mentions;
  assert.strictEqual(mentions.length, 1);
  assert.strictEqual(mentions[0].context.length > 0, true);
  assert.strictEqual(mentions[0].context.includes('Victor'), true);
});

test('indexCharacters - handles multiple characters', async (t) => {
  const sourceText = 'Line 1: Victor and Alice arrive\nLine 2: Victor speaks\nLine 3: Alice listens';
  const lines = sourceText.split('\n');
  const lineRange = [1, lines.length];

  const parsedTurns = [
    {
      number: 1,
      action: 'Victor and Alice meet',
      outcome: 'They talk',
      source: 'test.txt',
      lineRange,
    },
  ];

  const sourceFileData = new Map();
  sourceFileData.set('test.txt', sourceText);

  const result = await indexCharacters(parsedTurns, sourceFileData, [
    { name: 'Victor', aliases: [] },
    { name: 'Alice', aliases: [] },
  ]);

  assert.strictEqual(Object.keys(result.characterIndex.characters).length, 2);
  assert.strictEqual(result.characterIndex.incomplete, false);
  assert.strictEqual(result.characterIndex.total_mentions >= 2, true);
});

test('indexCharacters - tracks mentions across multiple turns', async (t) => {
  const sourceText = 'Line 1: Victor appears\nLine 2: He acts\nLine 3: Victor continues\nLine 4: More action';
  const lines = sourceText.split('\n');

  const parsedTurns = [
    {
      number: 1,
      action: 'Victor appears',
      outcome: 'He acts',
      source: 'test.txt',
      lineRange: [1, 2],
    },
    {
      number: 2,
      action: 'Victor continues',
      outcome: 'More action',
      source: 'test.txt',
      lineRange: [3, 4],
    },
  ];

  const sourceFileData = new Map();
  sourceFileData.set('test.txt', sourceText);

  const result = await indexCharacters(parsedTurns, sourceFileData, [
    { name: 'Victor', aliases: [] },
  ]);

  const mentions = result.characterIndex.characters['Victor'].mentions;
  assert.strictEqual(mentions.length, 2);
  assert.strictEqual(mentions[0].turn, 1);
  assert.strictEqual(mentions[1].turn, 2);
});

test('indexCharacters - handles missing source file gracefully', async (t) => {
  const parsedTurns = [
    {
      number: 1,
      action: 'Victor acts',
      outcome: 'Done',
      source: 'missing.txt',
      lineRange: [1, 10],
    },
  ];

  const sourceFileData = new Map();
  // empty map - missing.txt not present

  const result = await indexCharacters(parsedTurns, sourceFileData, [
    { name: 'Victor', aliases: [] },
  ]);

  assert.strictEqual(result.warnings.length > 0, true);
  assert.strictEqual(result.characterIndex.characters['Victor'].mentions.length, 0);
  assert.strictEqual(result.characterIndex.incomplete, true);
});

test('indexCharacters - returns proper schema structure', async (t) => {
  const sourceText = 'Line 1: Victor enters\nLine 2: He looks around';
  const lines = sourceText.split('\n');
  const lineRange = [1, lines.length];

  const parsedTurns = [
    {
      number: 1,
      action: 'Victor acts',
      outcome: 'Done',
      source: 'test.txt',
      lineRange,
    },
  ];

  const sourceFileData = new Map();
  sourceFileData.set('test.txt', sourceText);

  const result = await indexCharacters(parsedTurns, sourceFileData, [
    { name: 'Victor', aliases: ['V'] },
  ]);

  const index = result.characterIndex;

  // Check schema
  assert.strictEqual('characters' in index, true);
  assert.strictEqual('indexed_character_count' in index, true);
  assert.strictEqual('total_mentions' in index, true);
  assert.strictEqual('incomplete' in index, true);

  // Check character structure
  const victorEntry = index.characters['Victor'];
  assert.strictEqual('aliases' in victorEntry, true);
  assert.strictEqual('mentions' in victorEntry, true);
  assert.strictEqual(Array.isArray(victorEntry.mentions), true);

  if (victorEntry.mentions.length > 0) {
    const mention = victorEntry.mentions[0];
    assert.strictEqual('turn' in mention, true);
    assert.strictEqual('lines' in mention, true);
    assert.strictEqual('context' in mention, true);
    assert.strictEqual(Array.isArray(mention.lines), true);
  }
});

test('indexCharacters - character with no mentions has no aliases key if empty', async (t) => {
  const sourceText = 'Line 1: Some action here\nLine 2: Alice does something';
  const lines = sourceText.split('\n');
  const lineRange = [1, lines.length];

  const parsedTurns = [
    {
      number: 1,
      action: 'Some action',
      outcome: 'Done',
      source: 'test.txt',
      lineRange,
    },
  ];

  const sourceFileData = new Map();
  sourceFileData.set('test.txt', sourceText);

  const result = await indexCharacters(parsedTurns, sourceFileData, [
    { name: 'Victor', aliases: [] },
  ]);

  const victorEntry = result.characterIndex.characters['Victor'];

  // If no aliases, the aliases property should not exist in the output
  assert.strictEqual(!('aliases' in victorEntry), true);
  assert.strictEqual(Array.isArray(victorEntry.mentions), true);
  assert.strictEqual(victorEntry.mentions.length, 0);
});

test('indexCharacters - handles special characters in names', async (t) => {
  const sourceText = "Line 1: O'Brien enters the room\nLine 2: He looks around\nLine 3: O'Brien nods";
  const lines = sourceText.split('\n');
  const lineRange = [1, lines.length];

  const parsedTurns = [
    {
      number: 1,
      action: "O'Brien appears",
      outcome: 'He acts',
      source: 'test.txt',
      lineRange,
    },
  ];

  const sourceFileData = new Map();
  sourceFileData.set('test.txt', sourceText);

  const result = await indexCharacters(parsedTurns, sourceFileData, [
    { name: "O'Brien", aliases: [] },
  ]);

  assert.strictEqual(
    result.characterIndex.characters["O'Brien"].mentions.length >= 1,
    true
  );
});

test('indexCharacters - empty source file data returns no mentions', async (t) => {
  const parsedTurns = [
    {
      number: 1,
      action: 'Victor acts',
      outcome: 'Done',
      source: 'test.txt',
      lineRange: [1, 1],
    },
  ];

  const sourceFileData = new Map();
  sourceFileData.set('test.txt', '');

  const result = await indexCharacters(parsedTurns, sourceFileData, [
    { name: 'Victor', aliases: [] },
  ]);

  assert.strictEqual(result.characterIndex.characters['Victor'].mentions.length, 0);
  assert.strictEqual(result.characterIndex.incomplete, true);
});
