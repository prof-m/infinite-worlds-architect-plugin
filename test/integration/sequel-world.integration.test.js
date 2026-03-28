/**
 * Integration tests for sequel-world command with extraction tool
 * Tests that the story data extraction tool integrates correctly with the sequel-world workflow
 */

import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { extractStoryData } from '../../lib/handlers/extraction.js';
import { queryStoryData } from '../../lib/handlers/query.js';

const testFilesDir = '/home/moose/personalProjects/infinite-worlds-architect-plugin/test-files/story-export-examples';

test('sequel-world integration - 4-turn story extraction workflow', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sequel-test-'));
  const extractionDir = path.join(tmpDir, 'extraction');
  
  fs.mkdirSync(extractionDir, { recursive: true });

  try {
    // Step 1: Extract story data
    const extractResult = await extractStoryData(
      [path.join(testFilesDir, 'TheWorldsAStageTurn4.txt')],
      extractionDir
    );
    
    assert.strictEqual(extractResult.success, true, 'Extraction should succeed');
    assert.strictEqual(extractResult.totalTurns, 4, 'Should extract 4 turns');
    assert.deepStrictEqual(extractResult.turnRange, [1, 4], 'Turn range should be 1-4');

    // Step 2: Query story overview
    const turnIndexResult = await queryStoryData(extractionDir, 'turn_index');
    assert.strictEqual(turnIndexResult.success, true, 'turn_index query should succeed');
    assert(turnIndexResult.data.turns.length > 0, 'Should have turn data');

    // Step 3: Query metadata
    const metadataResult = await queryStoryData(extractionDir, 'metadata');
    assert.strictEqual(metadataResult.success, true, 'metadata query should succeed');
    assert(metadataResult.data.title, 'Metadata should have title');

    // Step 4: Query tracked state
    const trackedStateResult = await queryStoryData(extractionDir, 'tracked_state');
    // This might not have tracked state if the story doesn't use them
    assert(trackedStateResult.success === true || trackedStateResult.error, 'tracked_state should return valid response');

    // Step 5: Query final turn details
    const finalTurnResult = await queryStoryData(extractionDir, 'turn_detail', ['last']);
    assert.strictEqual(finalTurnResult.success, true, 'turn_detail query should succeed');
    assert(finalTurnResult.data.turns.length > 0, 'Should have final turn data');
    assert(finalTurnResult.data.turns[0].content, 'Final turn should have content');

    // Verify extracted context is usable for sequel generation
    const title = metadataResult.data.title;
    const finalTurnContent = finalTurnResult.data.turns[0].content;
    assert(title && title.length > 0, 'Should have story title for sequel');
    assert(finalTurnContent && finalTurnContent.length > 0, 'Should have final turn content');

  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('sequel-world integration - 22-turn story extraction workflow', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sequel-test-'));
  const extractionDir = path.join(tmpDir, 'extraction');
  
  fs.mkdirSync(extractionDir, { recursive: true });

  try {
    // Step 1: Extract story data
    const extractResult = await extractStoryData(
      [path.join(testFilesDir, 'Counsellor2_Turn22.txt')],
      extractionDir
    );
    
    assert.strictEqual(extractResult.success, true, 'Extraction should succeed for 22-turn story');
    assert.strictEqual(extractResult.totalTurns, 22, 'Should extract 22 turns');

    // Step 2: Query story overview efficiently
    const turnIndexResult = await queryStoryData(extractionDir, 'turn_index');
    assert.strictEqual(turnIndexResult.success, true, 'turn_index should succeed');
    assert.strictEqual(turnIndexResult.data.turns.length, 22, 'Should have 22 turns in index');

    // Step 3: Query specific turns (middle and end) without loading entire story
    const specificTurnsResult = await queryStoryData(extractionDir, 'turn_detail', [10, 22]);
    assert.strictEqual(specificTurnsResult.success, true, 'turn_detail should succeed');
    assert.strictEqual(specificTurnsResult.data.turns.length, 2, 'Should return 2 turns');

    // Verify context reduction: metadata should be smaller than full export
    const metadataResult = await queryStoryData(extractionDir, 'metadata');
    assert.strictEqual(metadataResult.success, true, 'metadata query should succeed');
    
    const metadataSize = JSON.stringify(metadataResult.data).length;
    const fullExportSize = fs.statSync(path.join(testFilesDir, 'Counsellor2_Turn22.txt')).size;
    
    // Metadata should be significantly smaller than full export
    assert(metadataSize < fullExportSize / 10, 'Metadata should be < 10% of full export size');

  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('sequel-world integration - 30-turn story with selective querying', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sequel-test-'));
  const extractionDir = path.join(tmpDir, 'extraction');
  
  fs.mkdirSync(extractionDir, { recursive: true });

  try {
    // Extract large story
    const extractResult = await extractStoryData(
      [path.join(testFilesDir, 'TheRingOfDisTurn30.txt')],
      extractionDir
    );
    
    assert.strictEqual(extractResult.success, true, 'Extraction should succeed for 30-turn story');
    assert.strictEqual(extractResult.totalTurns, 30, 'Should extract 30 turns');

    // Query turn index for overview
    const turnIndexResult = await queryStoryData(extractionDir, 'turn_index');
    assert.strictEqual(turnIndexResult.success, true);
    assert.strictEqual(turnIndexResult.data.turns.length, 30);

    // Query multiple specific turns: middle point and end
    const pivotTurns = [15, 30];
    const pivotTurnResult = await queryStoryData(extractionDir, 'turn_detail', pivotTurns);
    assert.strictEqual(pivotTurnResult.success, true);
    assert.strictEqual(pivotTurnResult.data.turns.length, 2);

    // Verify turn numbers are correct
    const turnNumbers = pivotTurnResult.data.turns.map(t => t.number);
    assert.deepStrictEqual(turnNumbers.sort((a, b) => a - b), [15, 30]);

  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('sequel-world integration - error handling for invalid extraction dir', async (t) => {
  const invalidDir = '/nonexistent/extraction/dir';

  // Query should fail gracefully
  const result = await queryStoryData(invalidDir, 'manifest');
  assert.strictEqual(result.success, false, 'Should fail for invalid extraction dir');
  assert(result.error, 'Should provide error message');
});

test('sequel-world integration - error handling for missing turn_detail', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sequel-test-'));
  const extractionDir = path.join(tmpDir, 'extraction');
  
  fs.mkdirSync(extractionDir, { recursive: true });

  try {
    // Extract small story
    const extractResult = await extractStoryData(
      [path.join(testFilesDir, 'TheWorldsAStageTurn4.txt')],
      extractionDir
    );
    assert.strictEqual(extractResult.success, true);

    // Try to query a turn that doesn't exist
    const result = await queryStoryData(extractionDir, 'turn_detail', [999]);
    assert.strictEqual(result.success, false, 'Should fail for non-existent turn');
    assert(result.error, 'Should provide error message');

  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('sequel-world integration - query tracked state for stories with tracked items', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sequel-test-'));
  const extractionDir = path.join(tmpDir, 'extraction');
  
  fs.mkdirSync(extractionDir, { recursive: true });

  try {
    // Extract story that has tracked items
    const extractResult = await extractStoryData(
      [path.join(testFilesDir, 'Counsellor2_Turn22.txt')],
      extractionDir
    );
    assert.strictEqual(extractResult.success, true);

    // If story has tracked items, query should work
    if (extractResult.hasTrackedItems) {
      const result = await queryStoryData(extractionDir, 'tracked_state');
      assert.strictEqual(result.success, true, 'Should query tracked state successfully');
      assert(result.data.snapshots || result.data, 'Should return snapshots');
    }

  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('sequel-world integration - performance test (context reduction)', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sequel-test-'));
  const extractionDir = path.join(tmpDir, 'extraction');
  
  fs.mkdirSync(extractionDir, { recursive: true });

  try {
    // Extract 22-turn story
    const extractResult = await extractStoryData(
      [path.join(testFilesDir, 'Counsellor2_Turn22.txt')],
      extractionDir
    );
    assert.strictEqual(extractResult.success, true);

    // Read original file size
    const originalSize = fs.statSync(path.join(testFilesDir, 'Counsellor2_Turn22.txt')).size;

    // Query just metadata
    const metadataResult = await queryStoryData(extractionDir, 'metadata');
    const metadataSize = JSON.stringify(metadataResult.data).length;

    // Query turn index
    const indexResult = await queryStoryData(extractionDir, 'turn_index');
    const indexSize = JSON.stringify(indexResult.data).length;

    // Query last turn only
    const finalTurnResult = await queryStoryData(extractionDir, 'turn_detail', ['last']);
    const finalTurnSize = JSON.stringify(finalTurnResult.data).length;

    // Total context used for sequel generation workflow
    const totalQuerySize = metadataSize + indexSize + finalTurnSize;

    // Should be significantly smaller than full export
    const contextReduction = ((originalSize - totalQuerySize) / originalSize * 100).toFixed(1);
    console.log(`Context reduction for sequel-world workflow: ${contextReduction}% smaller than full export`);
    
    assert(totalQuerySize < originalSize / 2, `Should reduce context by at least 50% (achieved ${contextReduction}%)`);

  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});
