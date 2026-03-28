/**
 * Tests for lib/handlers/extraction.js
 */

import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { extractStoryData } from '../../lib/handlers/extraction.js';

const testFilesDir = '/home/moose/personalProjects/infinite-worlds-architect-plugin/test-files/story-export-examples';

test('extractStoryData - parses TheWorldsAStageTurn4.txt successfully', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  const result = await extractStoryData([inputFile], tmpDir);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.totalTurns, 4);
  assert.deepStrictEqual(result.turnRange, [1, 4]);
  assert.strictEqual(result.inputFilesProcessed, 1);

  // Verify output files exist
  assert(fs.existsSync(path.join(tmpDir, 'manifest.json')));
  assert(fs.existsSync(path.join(tmpDir, 'metadata.json')));
  assert(fs.existsSync(path.join(tmpDir, 'turn_index.json')));

  fs.rmSync(tmpDir, { recursive: true });
});

test('extractStoryData - parses Counsellor2_Turn22.txt successfully', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'Counsellor2_Turn22.txt');

  const result = await extractStoryData([inputFile], tmpDir);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.totalTurns, 22);
  assert.strictEqual(result.inputFilesProcessed, 1);

  // Verify output files exist
  assert(fs.existsSync(path.join(tmpDir, 'manifest.json')));
  assert(fs.existsSync(path.join(tmpDir, 'metadata.json')));
  assert(fs.existsSync(path.join(tmpDir, 'turn_index.json')));

  fs.rmSync(tmpDir, { recursive: true });
});

test('extractStoryData - returns error for invalid input file', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

  const result = await extractStoryData(['/nonexistent/file.txt'], tmpDir);

  assert.strictEqual(result.success, false);
  assert(result.error);

  fs.rmSync(tmpDir, { recursive: true });
});

test('extractStoryData - returns error for empty inputPaths', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

  const result = await extractStoryData([], tmpDir);

  assert.strictEqual(result.success, false);
  assert(result.error.includes('Input validation failed'));

  fs.rmSync(tmpDir, { recursive: true });
});

test('extractStoryData - creates character_index.json when characterList provided', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  const characterList = [
    { name: 'Victor', aliases: [] }
  ];

  const result = await extractStoryData([inputFile], tmpDir, characterList);

  assert.strictEqual(result.success, true);

  // Verify character_index.json exists
  const characterIndexPath = path.join(tmpDir, 'character_index.json');
  assert(fs.existsSync(characterIndexPath), 'character_index.json should be created');

  // Verify character_index.json has valid structure
  const characterIndex = JSON.parse(fs.readFileSync(characterIndexPath, 'utf-8'));
  assert(characterIndex.characters !== undefined, 'Should have characters object');
  assert(characterIndex.indexed_character_count !== undefined, 'Should have indexed_character_count');
  assert(characterIndex.total_mentions !== undefined, 'Should have total_mentions');
  assert(characterIndex.incomplete !== undefined, 'Should have incomplete flag');

  fs.rmSync(tmpDir, { recursive: true });
});

test('extractStoryData - does NOT create character_index.json when characterList not provided', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  const result = await extractStoryData([inputFile], tmpDir);

  assert.strictEqual(result.success, true);

  // Verify character_index.json does NOT exist
  const characterIndexPath = path.join(tmpDir, 'character_index.json');
  assert(!fs.existsSync(characterIndexPath), 'character_index.json should NOT be created without characterList');

  fs.rmSync(tmpDir, { recursive: true });
});

test('extractStoryData - character indexing with aliases', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'Counsellor2_Turn22.txt');

  const characterList = [
    { name: 'Counsellor', aliases: ['The Counsellor'] }
  ];

  const result = await extractStoryData([inputFile], tmpDir, characterList);

  assert.strictEqual(result.success, true);

  // Verify character_index.json has proper alias handling
  const characterIndexPath = path.join(tmpDir, 'character_index.json');
  assert(fs.existsSync(characterIndexPath), 'character_index.json should be created');

  const characterIndex = JSON.parse(fs.readFileSync(characterIndexPath, 'utf-8'));
  if (characterIndex.characters.Counsellor) {
    assert.deepStrictEqual(
      characterIndex.characters.Counsellor.aliases,
      ['The Counsellor'],
      'Aliases should be preserved in character index'
    );
  }

  fs.rmSync(tmpDir, { recursive: true });
});

test('extractStoryData - multiple characters in characterList', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  const characterList = [
    { name: 'Character1', aliases: [] },
    { name: 'Character2', aliases: [] }
  ];

  const result = await extractStoryData([inputFile], tmpDir, characterList);

  assert.strictEqual(result.success, true);

  const characterIndexPath = path.join(tmpDir, 'character_index.json');
  const characterIndex = JSON.parse(fs.readFileSync(characterIndexPath, 'utf-8'));
  assert.strictEqual(
    characterIndex.indexed_character_count,
    characterList.length,
    'Should track number of indexed characters'
  );

  fs.rmSync(tmpDir, { recursive: true });
});
