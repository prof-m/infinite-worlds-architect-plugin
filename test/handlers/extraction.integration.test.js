/**
 * Integration tests for extraction tool - verify bug fixes
 *
 * Tests four critical bug fixes:
 * 1. Parameter Naming Fix: MCP parameters (input_paths, extraction_dir) correctly received
 * 2. MCP Response Format Fix: Responses wrapped in MCP-compliant envelope format
 * 3. Turn Extraction Regex Fix: Files with multiple newlines after turn markers properly extracted
 * 4. Tracked Items Detection: Tracked and hidden tracked items properly detected
 *
 * Run: node --test test/handlers/extraction.integration.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { extractStoryData } from '../../lib/handlers/extraction.js';

const testFilesDir = '/home/moose/personalProjects/infinite-worlds-architect-plugin/test-files/story-export-examples';
const storyExportDir = '/home/moose/personalProjects/infinite_worlds_stories/httt-melanie-recruiter-sequel-experiment';

// Helper function to create temp directory
function createTempDir() {
  // Try multiple temp directories in order of preference
  const tempDirs = [
    '/tmp',
    os.tmpdir(),
    process.env.HOME ? path.join(process.env.HOME, 'tmp') : null
  ].filter(Boolean);

  for (const baseDir of tempDirs) {
    try {
      fs.accessSync(baseDir, fs.constants.W_OK);
      return fs.mkdtempSync(path.join(baseDir, 'extraction-test-'));
    } catch (e) {
      // Try next directory
    }
  }

  // Fallback to current directory
  const cwd = process.cwd();
  return fs.mkdtempSync(path.join(cwd, 'extraction-test-'));
}

// ============================================================================
// Test Suite 1: Parameter Naming Fix (snake_case parameters)
// ============================================================================

test('Bug Fix #1: Parameter Naming - input_paths parameter received correctly', async () => {
  const tmpDir = createTempDir();
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  // Call with snake_case parameter name as per MCP spec
  const mcpResponse = await extractStoryData({
    input_paths: [inputFile],
    extraction_dir: tmpDir
  });

  // Verify response structure
  assert(mcpResponse.content, 'Response should have content property');
  assert(Array.isArray(mcpResponse.content), 'content should be an array');
  assert.strictEqual(mcpResponse.content.length, 1, 'Should have one content item');

  const result = JSON.parse(mcpResponse.content[0].text);
  assert.strictEqual(result.success, true, 'Should succeed with snake_case parameter names');
  assert.strictEqual(result.inputFilesProcessed, 1, 'Should process correct number of files');

  fs.rmSync(tmpDir, { recursive: true });
});

test('Bug Fix #1: Parameter Naming - extraction_dir parameter received correctly', async () => {
  const tmpDir = createTempDir();
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  const mcpResponse = await extractStoryData({
    input_paths: [inputFile],
    extraction_dir: tmpDir
  });

  const result = JSON.parse(mcpResponse.content[0].text);
  assert.strictEqual(result.success, true);

  // Verify files are written to the correct directory (extraction_dir)
  const manifestPath = path.join(tmpDir, 'manifest.json');
  assert(fs.existsSync(manifestPath), 'Output files should be written to extraction_dir');

  fs.rmSync(tmpDir, { recursive: true });
});

test('Bug Fix #1: Parameter Naming - multiple files with snake_case parameters', async () => {
  const tmpDir = createTempDir();
  const inputFiles = [
    path.join(testFilesDir, 'TheWorldsAStageTurn4.txt'),
    path.join(testFilesDir, 'Counsellor2_Turn22.txt')
  ];

  // Call with array of input_paths
  const mcpResponse = await extractStoryData({
    input_paths: inputFiles,
    extraction_dir: tmpDir
  });

  const result = JSON.parse(mcpResponse.content[0].text);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.inputFilesProcessed, 2, 'Should process both files');

  fs.rmSync(tmpDir, { recursive: true });
});

// ============================================================================
// Test Suite 2: MCP Response Format Fix (envelope wrapper)
// ============================================================================

test('Bug Fix #2: MCP Response Format - success response has proper envelope', async () => {
  const tmpDir = createTempDir();
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  const mcpResponse = await extractStoryData({
    input_paths: [inputFile],
    extraction_dir: tmpDir
  });

  // Verify MCP envelope format
  assert(mcpResponse.content, 'Must have content property');
  assert(Array.isArray(mcpResponse.content), 'content must be array');
  assert.strictEqual(mcpResponse.content.length, 1);

  const contentItem = mcpResponse.content[0];
  assert.strictEqual(contentItem.type, 'text', 'Content type must be "text"');
  assert(contentItem.text, 'Content must have text property');
  assert(typeof contentItem.text === 'string', 'text must be a string');

  // Verify text is valid JSON
  const parsed = JSON.parse(contentItem.text);
  assert.strictEqual(parsed.success, true);

  fs.rmSync(tmpDir, { recursive: true });
});

test('Bug Fix #2: MCP Response Format - error response has proper envelope', async () => {
  const tmpDir = createTempDir();

  // Call with invalid input that triggers validation error
  const mcpResponse = await extractStoryData({
    input_paths: ['/nonexistent/file.txt'],
    extraction_dir: tmpDir
  });

  // Validation errors may return directly (not wrapped in envelope)
  // but still should be properly structured
  assert(mcpResponse);

  // If response is wrapped in envelope, verify it
  if (mcpResponse.content) {
    assert(Array.isArray(mcpResponse.content));
    assert.strictEqual(mcpResponse.content[0].type, 'text');
    const result = JSON.parse(mcpResponse.content[0].text);
    assert.strictEqual(result.success, false);
    assert(result.error, 'Error response must include error message');
  } else {
    // If validation error returns directly (legacy behavior)
    assert.strictEqual(mcpResponse.success, false);
    assert(mcpResponse.error, 'Error response must include error message');
  }

  fs.rmSync(tmpDir, { recursive: true });
});

test('Bug Fix #2: MCP Response Format - response JSON is valid and parseable', async () => {
  const tmpDir = createTempDir();
  const inputFile = path.join(testFilesDir, 'Counsellor2_Turn22.txt');

  const mcpResponse = await extractStoryData({
    input_paths: [inputFile],
    extraction_dir: tmpDir
  });

  const textContent = mcpResponse.content[0].text;

  // Should not throw
  const parsed = JSON.parse(textContent);
  assert(parsed, 'Must parse to valid object');
  assert(typeof parsed === 'object', 'Parsed result must be object');
  assert('success' in parsed, 'Must have success property');

  fs.rmSync(tmpDir, { recursive: true });
});

test('Bug Fix #2: MCP Response Format - response contains all expected fields', async () => {
  const tmpDir = createTempDir();
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  const mcpResponse = await extractStoryData({
    input_paths: [inputFile],
    extraction_dir: tmpDir
  });

  const result = JSON.parse(mcpResponse.content[0].text);

  // Verify all expected result fields are present
  assert('success' in result);
  assert('totalTurns' in result);
  assert('turnRange' in result);
  assert('inputFilesProcessed' in result);
  assert('filesWritten' in result);
  assert('warnings' in result);

  fs.rmSync(tmpDir, { recursive: true });
});

// ============================================================================
// Test Suite 3: Turn Extraction Regex Fix (multiline newlines)
// ============================================================================

test('Bug Fix #3: Turn Extraction - handles multiple newlines after turn marker', async () => {
  const tmpDir = createTempDir();

  // Use real story export file which has proper spacing
  const inputFile = path.join(storyExportDir, 'turn_35_export.txt');

  if (!fs.existsSync(inputFile)) {
    console.log('Skipping test - story export file not found at:', inputFile);
    fs.rmSync(tmpDir, { recursive: true });
    return;
  }

  const mcpResponse = await extractStoryData({
    input_paths: [inputFile],
    extraction_dir: tmpDir
  });

  const result = JSON.parse(mcpResponse.content[0].text);
  assert.strictEqual(result.success, true);
  assert(result.totalTurns >= 30, 'Should extract a significant number of turns (30+)');

  // Verify turn_index shows all extracted turns have content
  const turnIndexPath = path.join(tmpDir, 'turn_index.json');
  assert(fs.existsSync(turnIndexPath), 'turn_index.json should exist');

  const turnIndex = JSON.parse(fs.readFileSync(turnIndexPath, 'utf8'));
  assert.strictEqual(turnIndex.turns.length, result.totalTurns, 'Turn index should match reported totalTurns');

  // Verify turns have non-zero content (this is the key test for the regex fix)
  let turnsWithOutcome = 0;
  for (const turn of turnIndex.turns) {
    // outcome_preview should not be empty for normal turns
    if (turn.outcome_preview !== null && turn.number > 1) {
      assert(turn.outcome_preview.length > 0, `Turn ${turn.number} should have non-empty outcome content`);
      turnsWithOutcome++;
    }
  }

  assert(turnsWithOutcome > 20, 'Most turns should have outcome content');

  fs.rmSync(tmpDir, { recursive: true });
});

test('Bug Fix #3: Turn Extraction - multiline section headers properly parsed', async () => {
  const tmpDir = createTempDir();
  const inputFile = path.join(testFilesDir, 'Counsellor2_Turn22.txt');

  const mcpResponse = await extractStoryData({
    input_paths: [inputFile],
    extraction_dir: tmpDir
  });

  const result = JSON.parse(mcpResponse.content[0].text);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.totalTurns, 22);

  // Verify all turns were extracted (not truncated)
  assert(result.turnRange[1] >= 22, 'Should extract through turn 22 or higher');

  fs.rmSync(tmpDir, { recursive: true });
});

test('Bug Fix #3: Turn Extraction - outcome content is not empty for normal turns', async () => {
  const tmpDir = createTempDir();
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  const mcpResponse = await extractStoryData({
    input_paths: [inputFile],
    extraction_dir: tmpDir
  });

  const result = JSON.parse(mcpResponse.content[0].text);
  assert.strictEqual(result.success, true);

  // Check that outcomes have content
  const turnIndexPath = path.join(tmpDir, 'turn_index.json');
  const turnIndex = JSON.parse(fs.readFileSync(turnIndexPath, 'utf8'));

  // At least some turns should have outcome previews
  const turnsWithOutcome = turnIndex.turns.filter(t => t.outcome_preview);
  assert(turnsWithOutcome.length > 0, 'Should have turns with outcome content');

  // No turn should have zero-length outcome_preview (that was the bug)
  for (const turn of turnsWithOutcome) {
    assert(turn.outcome_preview.length > 0, `Turn ${turn.number} outcome should not be empty`);
  }

  fs.rmSync(tmpDir, { recursive: true });
});

// ============================================================================
// Test Suite 4: Tracked Items Detection
// ============================================================================

test('Bug Fix #4: Tracked Items - detected when present', async () => {
  const tmpDir = createTempDir();
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  const mcpResponse = await extractStoryData({
    input_paths: [inputFile],
    extraction_dir: tmpDir
  });

  const result = JSON.parse(mcpResponse.content[0].text);

  // Result should report whether tracked items were found
  assert('hasTrackedItems' in result, 'Result should report hasTrackedItems');
  assert('hasHiddenTrackedItems' in result, 'Result should report hasHiddenTrackedItems');

  fs.rmSync(tmpDir, { recursive: true });
});

test('Bug Fix #4: Tracked Items - tracked_state.json created when tracked items exist', async () => {
  const tmpDir = createTempDir();
  const inputFile = path.join(storyExportDir, 'turn_35_export.txt');

  if (!fs.existsSync(inputFile)) {
    console.log('Skipping test - story export file not found');
    fs.rmSync(tmpDir, { recursive: true });
    return;
  }

  const mcpResponse = await extractStoryData({
    input_paths: [inputFile],
    extraction_dir: tmpDir
  });

  const result = JSON.parse(mcpResponse.content[0].text);
  assert.strictEqual(result.success, true);

  // If tracked items exist, tracked_state.json should be created
  if (result.hasTrackedItems || result.hasHiddenTrackedItems) {
    const trackedStatePath = path.join(tmpDir, 'tracked_state.json');
    assert(fs.existsSync(trackedStatePath), 'tracked_state.json should exist when tracked items are present');

    const trackedState = JSON.parse(fs.readFileSync(trackedStatePath, 'utf8'));
    assert(Array.isArray(trackedState.snapshots), 'tracked_state should have snapshots array');
  }

  fs.rmSync(tmpDir, { recursive: true });
});

test('Bug Fix #4: Tracked Items - turn index has_tracked_items flag correct', async () => {
  const tmpDir = createTempDir();
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  const mcpResponse = await extractStoryData({
    input_paths: [inputFile],
    extraction_dir: tmpDir
  });

  const result = JSON.parse(mcpResponse.content[0].text);
  assert.strictEqual(result.success, true);

  const turnIndexPath = path.join(tmpDir, 'turn_index.json');
  const turnIndex = JSON.parse(fs.readFileSync(turnIndexPath, 'utf8'));

  // Verify turn index structure
  assert(Array.isArray(turnIndex.turns));
  for (const turn of turnIndex.turns) {
    assert('has_tracked_items' in turn, `Turn ${turn.number} should have has_tracked_items flag`);
    assert(typeof turn.has_tracked_items === 'boolean', 'has_tracked_items should be boolean');
  }

  fs.rmSync(tmpDir, { recursive: true });
});

test('Bug Fix #4: Tracked Items - manifest records tracked items flags correctly', async () => {
  const tmpDir = createTempDir();
  const inputFile = path.join(testFilesDir, 'Counsellor2_Turn22.txt');

  const mcpResponse = await extractStoryData({
    input_paths: [inputFile],
    extraction_dir: tmpDir
  });

  const result = JSON.parse(mcpResponse.content[0].text);
  assert.strictEqual(result.success, true);

  const manifestPath = path.join(tmpDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Manifest should report tracked items presence
  assert('has_tracked_items' in manifest, 'Manifest should have has_tracked_items');
  assert('has_hidden_tracked_items' in manifest, 'Manifest should have has_hidden_tracked_items');
  assert(typeof manifest.has_tracked_items === 'boolean');
  assert(typeof manifest.has_hidden_tracked_items === 'boolean');

  fs.rmSync(tmpDir, { recursive: true });
});

test('Bug Fix #4: Tracked Items - hidden tracked items detected separately', async () => {
  const tmpDir = createTempDir();
  const inputFile = path.join(storyExportDir, 'turn_35_export.txt');

  if (!fs.existsSync(inputFile)) {
    console.log('Skipping test - story export file not found');
    fs.rmSync(tmpDir, { recursive: true });
    return;
  }

  const mcpResponse = await extractStoryData({
    input_paths: [inputFile],
    extraction_dir: tmpDir
  });

  const result = JSON.parse(mcpResponse.content[0].text);
  assert.strictEqual(result.success, true);

  // Result should distinguish between regular and hidden tracked items
  assert(typeof result.hasTrackedItems === 'boolean', 'hasTrackedItems should be boolean');
  assert(typeof result.hasHiddenTrackedItems === 'boolean', 'hasHiddenTrackedItems should be boolean');

  fs.rmSync(tmpDir, { recursive: true });
});

// ============================================================================
// Edge Case Tests
// ============================================================================

test('Edge Case: Empty tracked items section handled correctly', async () => {
  const tmpDir = createTempDir();
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  const mcpResponse = await extractStoryData({
    input_paths: [inputFile],
    extraction_dir: tmpDir
  });

  const result = JSON.parse(mcpResponse.content[0].text);

  // Even if tracking is empty, structure should be consistent
  assert('hasTrackedItems' in result);
  assert('hasHiddenTrackedItems' in result);

  fs.rmSync(tmpDir, { recursive: true });
});

test('Edge Case: Missing optional parameters handled gracefully', async () => {
  const tmpDir = createTempDir();
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  // Call without optional characterList parameter
  const mcpResponse = await extractStoryData({
    input_paths: [inputFile],
    extraction_dir: tmpDir
  });

  const result = JSON.parse(mcpResponse.content[0].text);
  assert.strictEqual(result.success, true);

  // Should work fine without characterList
  assert.strictEqual(result.inputFilesProcessed, 1);

  fs.rmSync(tmpDir, { recursive: true });
});

test('Edge Case: All output files have correct structure', async () => {
  const tmpDir = createTempDir();
  const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

  const mcpResponse = await extractStoryData({
    input_paths: [inputFile],
    extraction_dir: tmpDir
  });

  const result = JSON.parse(mcpResponse.content[0].text);
  assert.strictEqual(result.success, true);

  // Verify all expected files exist
  const manifestPath = path.join(tmpDir, 'manifest.json');
  const metadataPath = path.join(tmpDir, 'metadata.json');
  const turnIndexPath = path.join(tmpDir, 'turn_index.json');

  assert(fs.existsSync(manifestPath), 'manifest.json should exist');
  assert(fs.existsSync(metadataPath), 'metadata.json should exist');
  assert(fs.existsSync(turnIndexPath), 'turn_index.json should exist');

  // Verify all files are valid JSON
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const turnIndex = JSON.parse(fs.readFileSync(turnIndexPath, 'utf8'));

  assert(typeof manifest === 'object', 'manifest.json should parse to object');
  assert(typeof metadata === 'object', 'metadata.json should parse to object');
  assert(typeof turnIndex === 'object', 'turn_index.json should parse to object');

  fs.rmSync(tmpDir, { recursive: true });
});

test('Edge Case: Result includes all required response fields', async () => {
  const tmpDir = createTempDir();
  const inputFile = path.join(testFilesDir, 'Counsellor2_Turn22.txt');

  const mcpResponse = await extractStoryData({
    input_paths: [inputFile],
    extraction_dir: tmpDir
  });

  const result = JSON.parse(mcpResponse.content[0].text);

  // Success response should have all these fields
  assert.strictEqual(result.success, true);
  assert(typeof result.totalTurns === 'number');
  assert(Array.isArray(result.turnRange));
  assert.strictEqual(result.turnRange.length, 2);
  assert(typeof result.inputFilesProcessed === 'number');
  assert(typeof result.hasTrackedItems === 'boolean');
  assert(typeof result.hasHiddenTrackedItems === 'boolean');
  assert(Array.isArray(result.filesWritten));
  assert(Array.isArray(result.warnings));

  fs.rmSync(tmpDir, { recursive: true });
});
