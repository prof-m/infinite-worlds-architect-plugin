/**
 * Tests for lib/validation.js
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { validateExtractInput, validateQueryInput } from '../../lib/validation.js';

describe('validateExtractInput', () => {
  it('valid paths and directory', () => {
  // Create temporary test files and directory
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const testFile = path.join(tmpDir, 'test.txt');
  fs.writeFileSync(testFile, 'test');
  const outputDir = path.join(tmpDir, 'output');

    const result = validateExtractInput([testFile], outputDir);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('missing file', () => {
    const result = validateExtractInput(['/nonexistent/file.txt'], '/tmp/output');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('not readable'))).toBe(true);
  });

  it('inputPaths not array', () => {
    const result = validateExtractInput('not-an-array', '/tmp/output');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('must be an array'))).toBe(true);
  });

  it('empty inputPaths', () => {
    const result = validateExtractInput([], '/tmp/output');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('cannot be empty'))).toBe(true);
  });

  it('empty string in inputPaths', () => {
    const result = validateExtractInput([''], '/tmp/output');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('cannot be empty string'))).toBe(true);
  });

  it('extractionDir not writable parent', () => {
    const result = validateExtractInput(['/etc/passwd'], '/root/nonexistent/output');
    expect(result.valid).toBe(false);
  });
});

describe('validateQueryInput', () => {
  it('valid extraction directory and category', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

    const result = validateQueryInput(tmpDir, 'manifest', [1, 2, 3]);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('invalid category', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

    const result = validateQueryInput(tmpDir, 'invalid_category', []);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid category'))).toBe(true);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('missing extraction directory', () => {
    const result = validateQueryInput('/nonexistent/dir', 'manifest', []);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('not found or not readable'))).toBe(true);
  });

  it('valid "last" turn alias', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

    const result = validateQueryInput(tmpDir, 'turn_detail', [1, 'last']);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('turns parameter invalid type', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

    const result = validateQueryInput(tmpDir, 'turn_detail', 'not-an-array');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('must be an array'))).toBe(true);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('turns with invalid type in array', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

    const result = validateQueryInput(tmpDir, 'turn_detail', [1, 'invalid']);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Turn must be a number or "last"'))).toBe(true);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('negative turn number', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

    const result = validateQueryInput(tmpDir, 'turn_detail', [-1, 0]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('must be >= 1'))).toBe(true);

    fs.rmSync(tmpDir, { recursive: true });
  });
});
