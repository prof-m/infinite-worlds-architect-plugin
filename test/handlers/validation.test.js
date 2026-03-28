/**
 * Tests for lib/validation.js
 */

import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { validateExtractInput, validateQueryInput } from '../../lib/validation.js';

test('validateExtractInput - valid paths and directory', (t) => {
  // Create temporary test files and directory
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const testFile = path.join(tmpDir, 'test.txt');
  fs.writeFileSync(testFile, 'test');
  const outputDir = path.join(tmpDir, 'output');

  const result = validateExtractInput([testFile], outputDir);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.errors.length, 0);

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true });
});

test('validateExtractInput - missing file', (t) => {
  const result = validateExtractInput(['/nonexistent/file.txt'], '/tmp/output');
  assert.strictEqual(result.valid, false);
  assert(result.errors.some(e => e.includes('not readable')));
});

test('validateExtractInput - inputPaths not array', (t) => {
  const result = validateExtractInput('not-an-array', '/tmp/output');
  assert.strictEqual(result.valid, false);
  assert(result.errors.some(e => e.includes('must be an array')));
});

test('validateExtractInput - empty inputPaths', (t) => {
  const result = validateExtractInput([], '/tmp/output');
  assert.strictEqual(result.valid, false);
  assert(result.errors.some(e => e.includes('cannot be empty')));
});

test('validateExtractInput - empty string in inputPaths', (t) => {
  const result = validateExtractInput([''], '/tmp/output');
  assert.strictEqual(result.valid, false);
  assert(result.errors.some(e => e.includes('cannot be empty string')));
});

test('validateExtractInput - extractionDir not writable parent', (t) => {
  const result = validateExtractInput(['/etc/passwd'], '/root/nonexistent/output');
  assert.strictEqual(result.valid, false);
});

test('validateQueryInput - valid extraction directory and category', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

  const result = validateQueryInput(tmpDir, 'manifest', [1, 2, 3]);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.errors.length, 0);

  fs.rmSync(tmpDir, { recursive: true });
});

test('validateQueryInput - invalid category', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

  const result = validateQueryInput(tmpDir, 'invalid_category', []);
  assert.strictEqual(result.valid, false);
  assert(result.errors.some(e => e.includes('Invalid category')));

  fs.rmSync(tmpDir, { recursive: true });
});

test('validateQueryInput - missing extraction directory', (t) => {
  const result = validateQueryInput('/nonexistent/dir', 'manifest', []);
  assert.strictEqual(result.valid, false);
  assert(result.errors.some(e => e.includes('not found or not readable')));
});

test('validateQueryInput - valid "last" turn alias', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

  const result = validateQueryInput(tmpDir, 'turn_detail', [1, 'last']);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.errors.length, 0);

  fs.rmSync(tmpDir, { recursive: true });
});

test('validateQueryInput - turns parameter invalid type', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

  const result = validateQueryInput(tmpDir, 'turn_detail', 'not-an-array');
  assert.strictEqual(result.valid, false);
  assert(result.errors.some(e => e.includes('must be an array')));

  fs.rmSync(tmpDir, { recursive: true });
});

test('validateQueryInput - turns with invalid type in array', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

  const result = validateQueryInput(tmpDir, 'turn_detail', [1, 'invalid']);
  assert.strictEqual(result.valid, false);
  assert(result.errors.some(e => e.includes('Turn must be a number or "last"')));

  fs.rmSync(tmpDir, { recursive: true });
});

test('validateQueryInput - negative turn number', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

  const result = validateQueryInput(tmpDir, 'turn_detail', [-1, 0]);
  assert.strictEqual(result.valid, false);
  assert(result.errors.some(e => e.includes('must be >= 1')));

  fs.rmSync(tmpDir, { recursive: true });
});
