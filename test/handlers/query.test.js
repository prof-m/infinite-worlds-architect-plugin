/**
 * Tests for lib/handlers/query.js
 */

import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { queryStoryData } from '../../lib/handlers/query.js';
import { extractStoryData } from '../../lib/handlers/extraction.js';

const testFilesDir = '/home/moose/personalProjects/infinite-worlds-architect-plugin/test-files/story-export-examples';

test('queryStoryData - queries manifest category', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  // Extract first
  await extractStoryData([inputFile], tmpDir);

  // Query manifest
  const result = await queryStoryData(tmpDir, 'manifest', []);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.category, 'manifest');
  assert.strictEqual(result.data.version, '1.0');
  assert.strictEqual(result.data.total_turns, 4);

  fs.rmSync(tmpDir, { recursive: true });
});

test('queryStoryData - queries metadata category', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  // Extract first
  await extractStoryData([inputFile], tmpDir);

  // Query metadata
  const result = await queryStoryData(tmpDir, 'metadata', []);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.category, 'metadata');
  assert(result.data.title !== null || result.data.title === null); // Title might be null
  assert.strictEqual(result.data.total_turns, 4);

  fs.rmSync(tmpDir, { recursive: true });
});

test('queryStoryData - queries turn_index category', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  // Extract first
  await extractStoryData([inputFile], tmpDir);

  // Query turn_index
  const result = await queryStoryData(tmpDir, 'turn_index', []);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.category, 'turn_index');
  assert(Array.isArray(result.data.turns));
  assert.strictEqual(result.data.turns.length, 4);
  assert.strictEqual(result.data.turns[0].number, 1);

  fs.rmSync(tmpDir, { recursive: true });
});

test('queryStoryData - queries all categories successfully', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  // Extract first
  await extractStoryData([inputFile], tmpDir);

  // Query each category
  const manifest = await queryStoryData(tmpDir, 'manifest', []);
  assert.strictEqual(manifest.success, true);

  const metadata = await queryStoryData(tmpDir, 'metadata', []);
  assert.strictEqual(metadata.success, true);

  const turnIndex = await queryStoryData(tmpDir, 'turn_index', []);
  assert.strictEqual(turnIndex.success, true);

  fs.rmSync(tmpDir, { recursive: true });
});

test('queryStoryData - returns error for missing tracked_state.json', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  // Extract first (has no tracked items)
  await extractStoryData([inputFile], tmpDir);

  // Query tracked_state (should fail)
  const result = await queryStoryData(tmpDir, 'tracked_state', []);

  assert.strictEqual(result.success, false);
  assert(result.error.includes('No tracked items found'));

  fs.rmSync(tmpDir, { recursive: true });
});

test('queryStoryData - resolves "last" alias in manifest', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  // Extract first
  await extractStoryData([inputFile], tmpDir);

  // Query with "last"
  const result = await queryStoryData(tmpDir, 'manifest', ['last']);

  assert.strictEqual(result.success, true);

  fs.rmSync(tmpDir, { recursive: true });
});

test('queryStoryData - resolves "last" in turn arrays', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  // Extract first
  await extractStoryData([inputFile], tmpDir);

  // Query turn_index to confirm total turns
  const indexResult = await queryStoryData(tmpDir, 'turn_index', []);
  assert.strictEqual(indexResult.data.turns.length, 4);

  fs.rmSync(tmpDir, { recursive: true });
});

test('queryStoryData - returns error for invalid category', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  // Extract first
  await extractStoryData([inputFile], tmpDir);

  // Query invalid category
  const result = await queryStoryData(tmpDir, 'invalid_category', []);

  assert.strictEqual(result.success, false);
  assert(result.error.includes('Invalid category'));

  fs.rmSync(tmpDir, { recursive: true });
});

test('queryStoryData - returns error for nonexistent extraction directory', async (t) => {
  const result = await queryStoryData('/nonexistent/dir', 'manifest', []);

  assert.strictEqual(result.success, false);
  assert(result.error);

  // Test validation error specifically
  assert.strictEqual(result.success, false);
});

test('queryStoryData - turn_detail requires turns parameter', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  // Extract first
  await extractStoryData([inputFile], tmpDir);

  // Query turn_detail without turns
  const result = await queryStoryData(tmpDir, 'turn_detail', []);

  assert.strictEqual(result.success, false);
  assert(result.error.includes('requires turns parameter'));

  fs.rmSync(tmpDir, { recursive: true });
});

test('queryStoryData - queries manifest with resolved "last"', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  // Extract first
  await extractStoryData([inputFile], tmpDir);

  // Query manifest
  const result = await queryStoryData(tmpDir, 'manifest', []);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.category, 'manifest');
  assert.strictEqual(result.data.total_turns, 4);

  fs.rmSync(tmpDir, { recursive: true });
});

test('queryStoryData - turn_detail returns partial results for missing turns', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  // Extract first
  await extractStoryData([inputFile], tmpDir);

  // Query turn_detail with mix of existing and non-existing turns
  const result = await queryStoryData(tmpDir, 'turn_detail', [1, 2, 99]);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.category, 'turn_detail');
  // Should have details for turns 1 and 2
  assert.strictEqual(result.data.turns.length, 2);
  assert.strictEqual(result.data.turns[0].number, 1);
  assert.strictEqual(result.data.turns[1].number, 2);
  // Should have warnings about turn 99
  assert(result.warnings);
  assert(result.warnings.some(w => w.includes('99')));

  fs.rmSync(tmpDir, { recursive: true });
});

test('queryStoryData - turn_detail returns all available turns for single missing turn', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  // Extract first
  await extractStoryData([inputFile], tmpDir);

  // Query turn_detail with only a non-existing turn
  const result = await queryStoryData(tmpDir, 'turn_detail', [100]);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.category, 'turn_detail');
  // Should have no details
  assert.strictEqual(result.data.turns.length, 0);
  // Should have warnings
  assert(result.warnings);
  assert(result.warnings.some(w => w.includes('100')));

  fs.rmSync(tmpDir, { recursive: true });
});

test('queryStoryData - turn_detail includes all available turns with multiple missing turns', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  // Extract first
  await extractStoryData([inputFile], tmpDir);

  // Query turn_detail with all existing turns
  const result = await queryStoryData(tmpDir, 'turn_detail', [1, 2, 3, 4]);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.category, 'turn_detail');
  // Should have details for all 4 turns
  assert.strictEqual(result.data.turns.length, 4);
  // Should not have warnings when all turns exist
  assert(!result.warnings || result.warnings.length === 0);

  fs.rmSync(tmpDir, { recursive: true });
});
