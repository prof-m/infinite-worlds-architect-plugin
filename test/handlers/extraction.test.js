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
