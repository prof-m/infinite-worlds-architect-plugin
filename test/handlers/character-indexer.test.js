/**
 * Tests for lib/handlers/character-indexer.js
 */

import { describe, it, expect } from '@jest/globals';
import { indexCharacters } from '../../lib/handlers/character-indexer.js';

describe('indexCharacters', () => {
  it('returns null for empty character list', async () => {
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

    expect(result.characterIndex).toBeNull();
    expect(result.warnings).toEqual([]);
  });

  it('returns null for null character list', async () => {
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

    expect(result.characterIndex).toBeNull();
  });

  it('finds exact character matches', async () => {
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

    expect(result.characterIndex).not.toBeNull();
    expect(result.characterIndex.characters['Victor']).toBeDefined();
    expect(result.characterIndex.characters['Victor'].mentions.length).toBeGreaterThan(0);
    expect(result.characterIndex.total_mentions).toBeGreaterThanOrEqual(1);
  });

  it('handles aliases', async () => {
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

    expect(result.characterIndex).not.toBeNull();
    expect(result.characterIndex.characters['Victor'].aliases.length).toBe(2);
    expect(result.characterIndex.characters['Victor'].mentions.length).toBe(1);
    expect(result.characterIndex.total_mentions).toBeGreaterThanOrEqual(1);
  });

  it('case-insensitive matching', async () => {
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

    expect(result.characterIndex.characters['Victor'].mentions.length).toBe(1);
    expect(
      result.characterIndex.characters['Victor'].mentions[0].lines.length,
    ).toBe(3);
  });

  it('avoids false positives with word boundaries', async () => {
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
    expect(result.characterIndex.characters['The'].mentions.length).toBe(1);
  });

  it('sets incomplete flag when character not found', async () => {
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

    expect(result.characterIndex.incomplete).toBe(true);
    expect(result.characterIndex.indexed_character_count).toBe(2);
    expect(
      Object.values(result.characterIndex.characters).filter(c => c.mentions.length > 0)
        .length,
    ).toBe(1);
  });

  it('includes line numbers in mentions', async () => {
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
    expect(mentions.length).toBe(1);
    expect(mentions[0].turn).toBe(1);
    expect(mentions[0].lines).toEqual([1, 3, 5]);
  });

  it('includes context in mentions', async () => {
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
    expect(mentions.length).toBe(1);
    expect(mentions[0].context.length).toBeGreaterThan(0);
    expect(mentions[0].context.includes('Victor')).toBe(true);
  });

  it('handles multiple characters', async () => {
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

    expect(Object.keys(result.characterIndex.characters).length).toBe(2);
    expect(result.characterIndex.incomplete).toBe(false);
    expect(result.characterIndex.total_mentions).toBeGreaterThanOrEqual(2);
  });

  it('tracks mentions across multiple turns', async () => {
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
    expect(mentions.length).toBe(2);
    expect(mentions[0].turn).toBe(1);
    expect(mentions[1].turn).toBe(2);
  });

  it('handles missing source file gracefully', async () => {
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

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.characterIndex.characters['Victor'].mentions.length).toBe(0);
    expect(result.characterIndex.incomplete).toBe(true);
  });

  it('returns proper schema structure', async () => {
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
    expect('characters' in index).toBe(true);
    expect('indexed_character_count' in index).toBe(true);
    expect('total_mentions' in index).toBe(true);
    expect('incomplete' in index).toBe(true);

    // Check character structure
    const victorEntry = index.characters['Victor'];
    expect('aliases' in victorEntry).toBe(true);
    expect('mentions' in victorEntry).toBe(true);
    expect(Array.isArray(victorEntry.mentions)).toBe(true);

    if (victorEntry.mentions.length > 0) {
      const mention = victorEntry.mentions[0];
      expect('turn' in mention).toBe(true);
      expect('lines' in mention).toBe(true);
      expect('context' in mention).toBe(true);
      expect(Array.isArray(mention.lines)).toBe(true);
    }
  });

  it('character with no mentions has no aliases key if empty', async () => {
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
    expect(!('aliases' in victorEntry)).toBe(true);
    expect(Array.isArray(victorEntry.mentions)).toBe(true);
    expect(victorEntry.mentions.length).toBe(0);
  });

  it('handles special characters in names', async () => {
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

    expect(
      result.characterIndex.characters["O'Brien"].mentions.length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('empty source file data returns no mentions', async () => {
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

    expect(result.characterIndex.characters['Victor'].mentions.length).toBe(0);
    expect(result.characterIndex.incomplete).toBe(true);
  });
});
