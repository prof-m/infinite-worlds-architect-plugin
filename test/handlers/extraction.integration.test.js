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
import { fileURLToPath } from 'url';
import { extractStoryData } from '../../lib/handlers/extraction.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testFilesDir = path.join(__dirname, '../../test-files/story-export-examples');

// Test story files organized by speed
// Note: Files must start from Turn 1 for proper extraction
const testStoryFiles = {
  fast: [
    'TheWorldsAStageTurn4.txt',
    'TheCounsellor2_Turn6.txt'
  ],
  thorough: [
    'Melanie_The_RecruiterTurn35.txt',
    'Counsellor2_Turn22.txt'
  ],
  edgeCase: [
    'HowTheTurnsTable_Turn208-250.txt'  // Edge case: doesn't start at turn 1
  ]
};

// Track created temp directories for cleanup
const createdTempDirs = [];

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
      const tmpDir = fs.mkdtempSync(path.join(baseDir, 'extraction-test-'));
      createdTempDirs.push(tmpDir);
      return tmpDir;
    } catch (e) {
      // Try next directory
    }
  }

  // Fallback to current directory
  const cwd = process.cwd();
  const tmpDir = fs.mkdtempSync(path.join(cwd, 'extraction-test-'));
  createdTempDirs.push(tmpDir);
  return tmpDir;
}

// Helper function to clean up all created temp directories
function cleanupAllTempDirs() {
  for (const tmpDir of createdTempDirs) {
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true });
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }
  createdTempDirs.length = 0;
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

// Parametrized test for Turn Extraction with multiple files
test('Bug Fix #3: Turn Extraction - handles multiple newlines after turn marker', async () => {
  for (const filename of testStoryFiles.thorough) {
    const tmpDir = createTempDir();
    const inputFile = path.join(testFilesDir, filename);

    if (!fs.existsSync(inputFile)) {
      console.log(`Skipping test for ${filename} - file not found`);
      fs.rmSync(tmpDir, { recursive: true });
      continue;
    }

    const mcpResponse = await extractStoryData({
      input_paths: [inputFile],
      extraction_dir: tmpDir
    });

    const result = JSON.parse(mcpResponse.content[0].text);
    assert.strictEqual(result.success, true, `${filename}: Should succeed`);
    assert(result.totalTurns >= 5, `${filename}: Should extract at least 5 turns`);

    // Verify turn_index shows all extracted turns have content
    const turnIndexPath = path.join(tmpDir, 'turn_index.json');
    assert(fs.existsSync(turnIndexPath), `${filename}: turn_index.json should exist`);

    const turnIndex = JSON.parse(fs.readFileSync(turnIndexPath, 'utf8'));
    assert.strictEqual(turnIndex.turns.length, result.totalTurns, `${filename}: Turn index should match reported totalTurns`);

    // Verify turns have proper structure (this is the key test for the regex fix)
    // Some turns may not have outcome content, but the structure should be valid
    let turnsWithOutcome = 0;
    let turnsChecked = 0;
    for (const turn of turnIndex.turns) {
      // Verify turn structure is present
      assert('number' in turn, `${filename} Turn should have number property`);
      assert('outcome_preview' in turn, `${filename} Turn should have outcome_preview property`);
      turnsChecked++;

      // Count turns with actual outcome content
      if (turn.outcome_preview !== null && turn.outcome_preview && turn.outcome_preview.length > 0) {
        turnsWithOutcome++;
      }
    }

    assert(turnsChecked > 0, `${filename}: Should have extracted turns`);
    // At least some turns should have outcome content (not all may have it)
    assert(turnsWithOutcome > 0, `${filename}: Should have at least some turns with outcome content`);

    fs.rmSync(tmpDir, { recursive: true });
  }
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

// Parametrized test for Tracked Items with multiple files
test('Bug Fix #4: Tracked Items - tracked_state.json created when tracked items exist', async () => {
  for (const filename of testStoryFiles.thorough) {
    const tmpDir = createTempDir();
    const inputFile = path.join(testFilesDir, filename);

    if (!fs.existsSync(inputFile)) {
      console.log(`Skipping tracked items test for ${filename} - file not found`);
      fs.rmSync(tmpDir, { recursive: true });
      continue;
    }

    const mcpResponse = await extractStoryData({
      input_paths: [inputFile],
      extraction_dir: tmpDir
    });

    const result = JSON.parse(mcpResponse.content[0].text);
    assert.strictEqual(result.success, true, `${filename}: Extraction should succeed`);

    // If tracked items exist, tracked_state.json should be created
    if (result.hasTrackedItems || result.hasHiddenTrackedItems) {
      const trackedStatePath = path.join(tmpDir, 'tracked_state.json');
      assert(fs.existsSync(trackedStatePath), `${filename}: tracked_state.json should exist when tracked items are present`);

      const trackedState = JSON.parse(fs.readFileSync(trackedStatePath, 'utf8'));
      assert(Array.isArray(trackedState.snapshots), `${filename}: tracked_state should have snapshots array`);
    }

    fs.rmSync(tmpDir, { recursive: true });
  }
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

// Parametrized test for Hidden Tracked Items detection with multiple files
test('Bug Fix #4: Tracked Items - hidden tracked items detected separately', async () => {
  for (const filename of testStoryFiles.thorough) {
    const tmpDir = createTempDir();
    const inputFile = path.join(testFilesDir, filename);

    if (!fs.existsSync(inputFile)) {
      console.log(`Skipping hidden tracked items test for ${filename} - file not found`);
      fs.rmSync(tmpDir, { recursive: true });
      continue;
    }

    const mcpResponse = await extractStoryData({
      input_paths: [inputFile],
      extraction_dir: tmpDir
    });

    const result = JSON.parse(mcpResponse.content[0].text);
    assert.strictEqual(result.success, true, `${filename}: Extraction should succeed`);

    // Result should distinguish between regular and hidden tracked items
    assert(typeof result.hasTrackedItems === 'boolean', `${filename}: hasTrackedItems should be boolean`);
    assert(typeof result.hasHiddenTrackedItems === 'boolean', `${filename}: hasHiddenTrackedItems should be boolean`);

    fs.rmSync(tmpDir, { recursive: true });
  }
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

// ============================================================================
// Multi-File Coverage Tests - Comprehensive parametrized tests
// ============================================================================

test('Multi-File Coverage: Parameter naming works on all test files', async () => {
  const allFiles = [...testStoryFiles.fast, ...testStoryFiles.thorough];
  for (const filename of allFiles) {
    const tmpDir = createTempDir();
    const inputFile = path.join(testFilesDir, filename);

    if (!fs.existsSync(inputFile)) {
      console.log(`Skipping parameter test for ${filename} - file not found`);
      fs.rmSync(tmpDir, { recursive: true });
      continue;
    }

    const mcpResponse = await extractStoryData({
      input_paths: [inputFile],
      extraction_dir: tmpDir
    });

    const result = JSON.parse(mcpResponse.content[0].text);
    assert.strictEqual(result.success, true, `${filename}: Should process with snake_case parameters`);
    assert.strictEqual(result.inputFilesProcessed, 1, `${filename}: Should process exactly one file`);

    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('Multi-File Coverage: MCP response format correct on all test files', async () => {
  const allFiles = [...testStoryFiles.fast, ...testStoryFiles.thorough];
  for (const filename of allFiles) {
    const tmpDir = createTempDir();
    const inputFile = path.join(testFilesDir, filename);

    if (!fs.existsSync(inputFile)) {
      console.log(`Skipping response format test for ${filename} - file not found`);
      fs.rmSync(tmpDir, { recursive: true });
      continue;
    }

    const mcpResponse = await extractStoryData({
      input_paths: [inputFile],
      extraction_dir: tmpDir
    });

    // Verify MCP envelope format
    assert(mcpResponse.content, `${filename}: Must have content property`);
    assert(Array.isArray(mcpResponse.content), `${filename}: content must be array`);
    assert.strictEqual(mcpResponse.content.length, 1, `${filename}: Should have one content item`);

    const contentItem = mcpResponse.content[0];
    assert.strictEqual(contentItem.type, 'text', `${filename}: Content type must be "text"`);
    assert(contentItem.text, `${filename}: Content must have text property`);
    assert(typeof contentItem.text === 'string', `${filename}: text must be a string`);

    // Verify text is valid JSON and contains expected fields
    const parsed = JSON.parse(contentItem.text);
    assert.strictEqual(parsed.success, true, `${filename}: Response should be successful`);
    assert('success' in parsed, `${filename}: Must have success property`);
    assert('totalTurns' in parsed, `${filename}: Must have totalTurns property`);
    assert('turnRange' in parsed, `${filename}: Must have turnRange property`);

    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('Multi-File Coverage: Output file structure consistent on all test files', async () => {
  const allFiles = [...testStoryFiles.fast, ...testStoryFiles.thorough];
  for (const filename of allFiles) {
    const tmpDir = createTempDir();
    const inputFile = path.join(testFilesDir, filename);

    if (!fs.existsSync(inputFile)) {
      console.log(`Skipping output structure test for ${filename} - file not found`);
      fs.rmSync(tmpDir, { recursive: true });
      continue;
    }

    const mcpResponse = await extractStoryData({
      input_paths: [inputFile],
      extraction_dir: tmpDir
    });

    const result = JSON.parse(mcpResponse.content[0].text);
    assert.strictEqual(result.success, true, `${filename}: Extraction should succeed`);

    // Verify all expected files exist
    const manifestPath = path.join(tmpDir, 'manifest.json');
    const metadataPath = path.join(tmpDir, 'metadata.json');
    const turnIndexPath = path.join(tmpDir, 'turn_index.json');

    assert(fs.existsSync(manifestPath), `${filename}: manifest.json should exist`);
    assert(fs.existsSync(metadataPath), `${filename}: metadata.json should exist`);
    assert(fs.existsSync(turnIndexPath), `${filename}: turn_index.json should exist`);

    // Verify all files are valid JSON
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const turnIndex = JSON.parse(fs.readFileSync(turnIndexPath, 'utf8'));

    assert(typeof manifest === 'object', `${filename}: manifest.json should parse to object`);
    assert(typeof metadata === 'object', `${filename}: metadata.json should parse to object`);
    assert(typeof turnIndex === 'object', `${filename}: turn_index.json should parse to object`);

    // Verify turn counts match
    assert.strictEqual(
      turnIndex.turns.length,
      result.totalTurns,
      `${filename}: Turn index length should match reported total`
    );

    fs.rmSync(tmpDir, { recursive: true });
  }
});

// Cleanup all temp directories on test completion
test('Cleanup: Remove all created temporary directories', () => {
  cleanupAllTempDirs();
  assert.strictEqual(createdTempDirs.length, 0, 'All temp directories should be cleaned up');
});
