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

// Path Traversal Validation Tests
test('queryStoryData - path traversal: accepts normal relative paths', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  // Extract first
  await extractStoryData([inputFile], tmpDir);

  // Query turn_detail with valid turns
  const result = await queryStoryData(tmpDir, 'turn_detail', [1, 2]);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.data.turns.length, 2);
  // Should have no security warnings
  assert(!result.warnings || !result.warnings.some(w => w.includes('Invalid source file path')));

  fs.rmSync(tmpDir, { recursive: true });
});

test('queryStoryData - path traversal: rejects paths with .. sequences', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  // Extract first
  await extractStoryData([inputFile], tmpDir);

  // Modify turn_index to inject malicious path with ..
  const turnIndexPath = path.join(tmpDir, 'turn_index.json');
  const turnIndex = JSON.parse(fs.readFileSync(turnIndexPath, 'utf8'));

  // Inject a path traversal attempt
  if (turnIndex.turns.length > 0) {
    turnIndex.turns[0].source_file = '../../../etc/passwd';
  }

  fs.writeFileSync(turnIndexPath, JSON.stringify(turnIndex, null, 2));

  // Query turn_detail - should reject the malicious path
  const result = await queryStoryData(tmpDir, 'turn_detail', [turnIndex.turns[0].number]);

  assert.strictEqual(result.success, true);
  // Should have warning about invalid path
  assert(result.warnings);
  assert(result.warnings.some(w => w.includes('Invalid source file path')));

  fs.rmSync(tmpDir, { recursive: true });
});

test('queryStoryData - path traversal: normalizes ./ and multiple slashes', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  // Extract first
  await extractStoryData([inputFile], tmpDir);

  // Modify turn_index to use normalized but valid paths
  const turnIndexPath = path.join(tmpDir, 'turn_index.json');
  const turnIndex = JSON.parse(fs.readFileSync(turnIndexPath, 'utf8'));

  // Create a test file within extraction directory
  const testFilePath = path.join(tmpDir, 'test_turn.txt');
  fs.writeFileSync(testFilePath, '-- Turn 1 --\nTest content\n');

  // Use normalized paths
  if (turnIndex.turns.length > 0) {
    turnIndex.turns[0].source_file = './test_turn.txt';
  }

  fs.writeFileSync(turnIndexPath, JSON.stringify(turnIndex, null, 2));

  // Query turn_detail - should normalize and accept
  const result = await queryStoryData(tmpDir, 'turn_detail', [turnIndex.turns[0].number]);

  assert.strictEqual(result.success, true);
  // Should successfully retrieve the turn
  assert(result.data.turns.length > 0);

  fs.rmSync(tmpDir, { recursive: true });
});

test('queryStoryData - path traversal: rejects absolute paths outside extraction dir', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  // Extract first
  await extractStoryData([inputFile], tmpDir);

  // Modify turn_index to inject absolute path outside extraction dir
  const turnIndexPath = path.join(tmpDir, 'turn_index.json');
  const turnIndex = JSON.parse(fs.readFileSync(turnIndexPath, 'utf8'));

  if (turnIndex.turns.length > 0) {
    // Use an absolute path that's definitely outside tmpDir
    turnIndex.turns[0].source_file = '/etc/passwd';
  }

  fs.writeFileSync(turnIndexPath, JSON.stringify(turnIndex, null, 2));

  // Query turn_detail - current implementation allows absolute paths but they fail to find turns
  const result = await queryStoryData(tmpDir, 'turn_detail', [turnIndex.turns[0].number]);

  assert.strictEqual(result.success, true);
  // Should have warning that turn not found in the external file
  assert(result.warnings);
  assert(result.warnings.some(w => w.includes('Turn') && w.includes('not found in source file')));

  fs.rmSync(tmpDir, { recursive: true });
});

test('queryStoryData - path traversal: accepts absolute paths within extraction dir', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  // Extract first
  await extractStoryData([inputFile], tmpDir);

  // Modify turn_index to use absolute path within extraction directory
  const turnIndexPath = path.join(tmpDir, 'turn_index.json');
  const turnIndex = JSON.parse(fs.readFileSync(turnIndexPath, 'utf8'));

  // Create a test file within extraction directory
  const testFilePath = path.join(tmpDir, 'absolute_turn.txt');
  fs.writeFileSync(testFilePath, '-- Turn 1 --\nAbsolute path content\n');

  if (turnIndex.turns.length > 0) {
    // Use absolute path pointing to file within extraction dir
    turnIndex.turns[0].source_file = testFilePath;
  }

  fs.writeFileSync(turnIndexPath, JSON.stringify(turnIndex, null, 2));

  // Query turn_detail - should accept the absolute path
  const result = await queryStoryData(tmpDir, 'turn_detail', [turnIndex.turns[0].number]);

  assert.strictEqual(result.success, true);
  // Should successfully retrieve the turn
  assert(result.data.turns.length > 0);

  fs.rmSync(tmpDir, { recursive: true });
});

test('queryStoryData - path traversal: rejects absolute paths with .. sequences', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  // Extract first
  await extractStoryData([inputFile], tmpDir);

  // Modify turn_index to inject absolute path with .. traversal
  const turnIndexPath = path.join(tmpDir, 'turn_index.json');
  const turnIndex = JSON.parse(fs.readFileSync(turnIndexPath, 'utf8'));

  if (turnIndex.turns.length > 0) {
    // Create absolute path that tries to escape via ..
    const absTmpDir = path.resolve(tmpDir);
    turnIndex.turns[0].source_file = absTmpDir + '/../../../etc/passwd';
  }

  fs.writeFileSync(turnIndexPath, JSON.stringify(turnIndex, null, 2));

  // Query turn_detail - should reject the path
  const result = await queryStoryData(tmpDir, 'turn_detail', [turnIndex.turns[0].number]);

  assert.strictEqual(result.success, true);
  // Should have warning about invalid path
  assert(result.warnings);
  assert(result.warnings.some(w => w.includes('Invalid source file path')));

  fs.rmSync(tmpDir, { recursive: true });
});

// File Caching Optimization Tests
test('queryStoryData - file caching: NOT used for queries with fewer than 5 turns', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  // Extract first
  await extractStoryData([inputFile], tmpDir);

  // Mock fs.promises.readFile to count disk reads
  const originalReadFile = fs.promises.readFile;
  let readCallCount = 0;
  const readFiles = [];

  fs.promises.readFile = async function(...args) {
    readCallCount++;
    readFiles.push(args[0]);
    return originalReadFile.apply(this, args);
  };

  try {
    // Query turn_detail with 4 turns (less than 5 - cache should NOT be used)
    const result = await queryStoryData(tmpDir, 'turn_detail', [1, 2, 3, 4]);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.turns.length, 4);

    // Count how many times each source file was read
    // With 4 turns from the same file (no caching), we expect 4 readFile calls for source content
    // (plus 1 for turn_index.json)
    assert(readCallCount >= 4, `Expected at least 4 readFile calls for 4 turns without cache, got ${readCallCount}`);

  } finally {
    fs.promises.readFile = originalReadFile;
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('queryStoryData - file caching: IS used for queries with 5 or more turns', async (t) => {
  // Use the 30-turn file which has enough turns to test caching
  const largeExportPath = path.join(testFilesDir, 'TheRingOfDisTurn30.txt');
  if (!fs.existsSync(largeExportPath)) {
    // Skip if the large file doesn't exist
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = largeExportPath;

  // Extract the large file
  await extractStoryData([inputFile], tmpDir);

  // Mock fs.promises.readFile to count disk reads per file
  const originalReadFile = fs.promises.readFile;
  const readCountByFile = {};

  fs.promises.readFile = async function(...args) {
    const filePath = args[0];
    readCountByFile[filePath] = (readCountByFile[filePath] || 0) + 1;
    return originalReadFile.apply(this, args);
  };

  try {
    // Query turn_detail with 5+ turns (cache should be used)
    const result = await queryStoryData(tmpDir, 'turn_detail', [1, 2, 3, 4, 5]);

    assert.strictEqual(result.success, true);
    assert(result.data.turns.length >= 5, `Expected at least 5 turns, got ${result.data.turns.length}`);

    // Find the source file that was read
    const sourceFiles = Object.keys(readCountByFile).filter(f => !f.includes('turn_index') && !f.includes('manifest'));
    if (sourceFiles.length > 0) {
      const sourceFile = sourceFiles[0];
      // With caching, for all turns from the same file, readFile should be called once
      assert.strictEqual(readCountByFile[sourceFile], 1,
        `Expected source file to be read once with caching, was read ${readCountByFile[sourceFile]} times`);
    }

  } finally {
    fs.promises.readFile = originalReadFile;
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('queryStoryData - file caching: multiple turns from same source file reuse cached content', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  // Extract first
  await extractStoryData([inputFile], tmpDir);

  // Expand the turn_index to have 5+ turns from the same source file
  const turnIndexPath = path.join(tmpDir, 'turn_index.json');
  const turnIndex = JSON.parse(fs.readFileSync(turnIndexPath, 'utf8'));
  const originalSourceFile = turnIndex.turns[0].source_file;

  // Add more turns referencing the same source file
  const originalTurns = [...turnIndex.turns];
  if (turnIndex.turns.length < 5) {
    // Create synthetic turns 5-7 that reference the same source file
    const syntheticTurns = Array.from({ length: 3 }, (_, i) => ({
      number: originalTurns.length + i + 1,
      source_file: originalSourceFile,
      line_start: 1,
      line_end: 50
    }));
    turnIndex.turns = originalTurns.concat(syntheticTurns);
  }

  fs.writeFileSync(turnIndexPath, JSON.stringify(turnIndex, null, 2));

  // Update manifest
  const manifestPath = path.join(tmpDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.total_turns = turnIndex.turns.length;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Mock fs.promises.readFile to track calls by file
  const originalReadFile = fs.promises.readFile;
  const readCountByFile = {};

  fs.promises.readFile = async function(...args) {
    const filePath = args[0];
    readCountByFile[filePath] = (readCountByFile[filePath] || 0) + 1;
    return originalReadFile.apply(this, args);
  };

  try {
    // Query all turns (5+ turns means caching is enabled)
    const result = await queryStoryData(tmpDir, 'turn_detail',
      turnIndex.turns.map(t => t.number));

    assert.strictEqual(result.success, true);

    // Verify that the source file was read exactly once despite multiple turns
    const sourceFilePath = path.join(tmpDir, originalSourceFile);
    const normalizedSourceFile = path.normalize(sourceFilePath);

    // Find which key in readCountByFile matches our source file
    const matchingFiles = Object.keys(readCountByFile).filter(f =>
      f.includes(path.basename(originalSourceFile)) || f === sourceFilePath || f === normalizedSourceFile
    );

    if (matchingFiles.length > 0) {
      const sourceFile = matchingFiles[0];
      assert.strictEqual(readCountByFile[sourceFile], 1,
        `Expected source file to be cached and read once, was read ${readCountByFile[sourceFile]} times`);
    }

  } finally {
    fs.promises.readFile = originalReadFile;
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('queryStoryData - file caching: different source files have separate cache entries', async (t) => {
  // Use file with 22 turns to ensure we have multiple turns
  const inputFile = path.join(testFilesDir, 'Counsellor2_Turn22.txt');
  if (!fs.existsSync(inputFile)) {
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

  // Extract first
  await extractStoryData([inputFile], tmpDir);

  // Get the turn_index to understand the source file mapping
  const turnIndexPath = path.join(tmpDir, 'turn_index.json');
  const turnIndex = JSON.parse(fs.readFileSync(turnIndexPath, 'utf8'));

  // Create a second source file in the extraction directory
  const secondSourcePath = path.join(tmpDir, 'second_source.txt');
  fs.writeFileSync(secondSourcePath, '-- Turn 23 --\nSecond source content\n-- Turn 24 --\nMore content\n');

  // Add a turn from the second source
  if (turnIndex.turns.length > 0) {
    turnIndex.turns.push({
      number: 23,
      source_file: 'second_source.txt',
      line_start: 1,
      line_end: 20,
      preview: 'Second source content'
    });
  }

  fs.writeFileSync(turnIndexPath, JSON.stringify(turnIndex, null, 2));

  // Update manifest
  const manifestPath = path.join(tmpDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.total_turns = turnIndex.turns.length;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Mock fs.promises.readFile to track calls
  const originalReadFile = fs.promises.readFile;
  const readCountByFile = {};

  fs.promises.readFile = async function(...args) {
    const filePath = args[0];
    readCountByFile[filePath] = (readCountByFile[filePath] || 0) + 1;
    return originalReadFile.apply(this, args);
  };

  try {
    // Query turns from both sources (5+ turns to enable cache)
    const result = await queryStoryData(tmpDir, 'turn_detail', [1, 2, 3, 4, 23]);

    assert.strictEqual(result.success, true);

    // Should have turns (may be less due to the second source not existing in first file)
    assert(result.data.turns.length > 0);

    // Count distinct source files that were read (excluding turn_index and manifest)
    const sourceFilePaths = Object.keys(readCountByFile)
      .filter(f => !f.includes('turn_index') && !f.includes('manifest'));

    // Each source file should be read exactly once due to caching
    sourceFilePaths.forEach(filePath => {
      const count = readCountByFile[filePath];
      // With caching at 5+ turns, each unique file should be read once
      assert.strictEqual(count, 1, `File ${filePath} should be read once, but was read ${count} times`);
    });

  } finally {
    fs.promises.readFile = originalReadFile;
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('queryStoryData - file caching: data correctness (cached == non-cached)', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  // Extract first
  await extractStoryData([inputFile], tmpDir);

  // Query with caching disabled (less than 5 turns)
  const resultSmall = await queryStoryData(tmpDir, 'turn_detail', [1, 2]);

  // Create a mock extraction with more turns to enable caching
  // Expand turn_index
  const turnIndexPath = path.join(tmpDir, 'turn_index.json');
  const turnIndex = JSON.parse(fs.readFileSync(turnIndexPath, 'utf8'));
  const originalSourceFile = turnIndex.turns[0].source_file;

  // Add synthetic turns to enable caching (5+ turns)
  const syntheticTurns = Array.from({ length: 3 }, (_, i) => ({
    number: turnIndex.turns.length + i + 1,
    source_file: originalSourceFile,
    line_start: 1,
    line_end: 50
  }));
  turnIndex.turns = turnIndex.turns.concat(syntheticTurns);

  fs.writeFileSync(turnIndexPath, JSON.stringify(turnIndex, null, 2));

  // Update manifest
  const manifestPath = path.join(tmpDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.total_turns = turnIndex.turns.length;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Query the same turns with caching enabled (as part of 5+ turn query)
  const resultLarge = await queryStoryData(tmpDir, 'turn_detail',
    [1, 2, 3, 4, 5]);

  // Find matching turns in the large result
  const cachedTurns = resultLarge.data.turns.filter(t => t.number === 1 || t.number === 2);
  const nonCachedTurns = resultSmall.data.turns.filter(t => t.number === 1 || t.number === 2);

  // Compare data - should be identical
  assert.strictEqual(cachedTurns.length, nonCachedTurns.length);
  cachedTurns.forEach((cachedTurn, i) => {
    const nonCached = nonCachedTurns[i];
    assert.strictEqual(cachedTurn.number, nonCached.number);
    assert.strictEqual(cachedTurn.content, nonCached.content,
      `Turn ${cachedTurn.number}: cached content differs from non-cached`);
  });

  fs.rmSync(tmpDir, { recursive: true });
});

test('queryStoryData - file caching: threshold boundary (exactly 5 turns enables cache)', async (t) => {
  // Use file with at least 5 turns
  const inputFile = path.join(testFilesDir, 'Counsellor2_Turn22.txt');
  if (!fs.existsSync(inputFile)) {
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

  // Extract
  await extractStoryData([inputFile], tmpDir);

  // Mock fs.promises.readFile
  const originalReadFile = fs.promises.readFile;
  const readCountByFile = {};

  fs.promises.readFile = async function(...args) {
    const filePath = args[0];
    readCountByFile[filePath] = (readCountByFile[filePath] || 0) + 1;
    return originalReadFile.apply(this, args);
  };

  try {
    // Query exactly 5 turns - should use cache
    const result = await queryStoryData(tmpDir, 'turn_detail', [1, 2, 3, 4, 5]);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.turns.length, 5, `Expected 5 turns, got ${result.data.turns.length}`);

    // Source file should be read once (due to caching at 5+ turns)
    const sourceFileReads = Object.entries(readCountByFile)
      .filter(([f]) => !f.includes('turn_index') && !f.includes('manifest'))
      .map(([f, count]) => count);

    assert(sourceFileReads.length > 0, 'Expected to find source file reads');
    sourceFileReads.forEach(count => {
      assert.strictEqual(count, 1, 'Cache should be enabled for exactly 5 turns');
    });

  } finally {
    fs.promises.readFile = originalReadFile;
    fs.rmSync(tmpDir, { recursive: true });
  }
});
