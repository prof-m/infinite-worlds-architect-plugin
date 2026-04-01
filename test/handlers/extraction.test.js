/**
 * Tests for lib/handlers/extraction.js
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { extractStoryData } from '../../lib/handlers/extraction.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testFilesDir = path.join(__dirname, '../fixtures/story-exports');

describe('extractStoryData', () => {
  it('parses TheWorldsAStageTurn4.txt successfully', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
    const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

    const mcpResponse = await extractStoryData({ input_paths: [inputFile], extraction_dir: tmpDir });
    const result = JSON.parse(mcpResponse.content[0].text);

    expect(result.success).toBe(true);
    expect(result.totalTurns).toBe(4);
    expect(result.turnRange).toEqual([1, 4]);
    expect(result.inputFilesProcessed).toBe(1);

    // Verify output files exist
    expect(fs.existsSync(path.join(tmpDir, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'metadata.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'turn_index.json'))).toBe(true);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('parses Counsellor2_Turn22.txt successfully', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
    const inputFile = path.join(testFilesDir, 'Counsellor2_Turn22.txt');

    const mcpResponse = await extractStoryData({ input_paths: [inputFile], extraction_dir: tmpDir });
    const result = JSON.parse(mcpResponse.content[0].text);

    expect(result.success).toBe(true);
    expect(result.totalTurns).toBe(22);
    expect(result.inputFilesProcessed).toBe(1);

    // Verify output files exist
    expect(fs.existsSync(path.join(tmpDir, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'metadata.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'turn_index.json'))).toBe(true);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('returns error for invalid input file', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

    const mcpResponse = await extractStoryData({ input_paths: ['/nonexistent/file.txt'], extraction_dir: tmpDir });
    const result = JSON.parse(mcpResponse.content[0].text);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('returns error for empty inputPaths', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

    const mcpResponse = await extractStoryData({ input_paths: [], extraction_dir: tmpDir });
    const result = JSON.parse(mcpResponse.content[0].text);

    expect(result.success).toBe(false);
    expect(result.error.includes('Input validation failed')).toBe(true);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('creates character_index.json when characterList provided', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
    const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

    const characterList = [
      { name: 'Victor', aliases: [] }
    ];

    const mcpResponse = await extractStoryData({ input_paths: [inputFile], extraction_dir: tmpDir, characterList });
    const result = JSON.parse(mcpResponse.content[0].text);

    expect(result.success).toBe(true);

    // Verify character_index.json exists
    const characterIndexPath = path.join(tmpDir, 'character_index.json');
    expect(fs.existsSync(characterIndexPath)).toBe(true);

    // Verify character_index.json has valid structure
    const characterIndex = JSON.parse(fs.readFileSync(characterIndexPath, 'utf-8'));
    expect(characterIndex.characters).toBeDefined();
    expect(characterIndex.indexed_character_count).toBeDefined();
    expect(characterIndex.total_mentions).toBeDefined();
    expect(characterIndex.incomplete).toBeDefined();

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('does NOT create character_index.json when characterList not provided', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
    const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

    const mcpResponse = await extractStoryData({ input_paths: [inputFile], extraction_dir: tmpDir });
    const result = JSON.parse(mcpResponse.content[0].text);

    expect(result.success).toBe(true);

    // Verify character_index.json does NOT exist
    const characterIndexPath = path.join(tmpDir, 'character_index.json');
    expect(fs.existsSync(characterIndexPath)).toBe(false);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('character indexing with aliases', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
    const inputFile = path.join(testFilesDir, 'Counsellor2_Turn22.txt');

    const characterList = [
      { name: 'Counsellor', aliases: ['The Counsellor'] }
    ];

    const mcpResponse = await extractStoryData({ input_paths: [inputFile], extraction_dir: tmpDir, characterList });
    const result = JSON.parse(mcpResponse.content[0].text);

    expect(result.success).toBe(true);

    // Verify character_index.json has proper alias handling
    const characterIndexPath = path.join(tmpDir, 'character_index.json');
    expect(fs.existsSync(characterIndexPath)).toBe(true);

    const characterIndex = JSON.parse(fs.readFileSync(characterIndexPath, 'utf-8'));
    if (characterIndex.characters.Counsellor) {
      expect(
        characterIndex.characters.Counsellor.aliases,
      ).toEqual(['The Counsellor']);
    }

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('multiple characters in characterList', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
    const inputFile = path.join(testFilesDir, 'TheWorldsAStageTurn4.txt');

    const characterList = [
      { name: 'Character1', aliases: [] },
      { name: 'Character2', aliases: [] }
    ];

    const mcpResponse = await extractStoryData({ input_paths: [inputFile], extraction_dir: tmpDir, characterList });
    const result = JSON.parse(mcpResponse.content[0].text);

    expect(result.success).toBe(true);

    const characterIndexPath = path.join(tmpDir, 'character_index.json');
    const characterIndex = JSON.parse(fs.readFileSync(characterIndexPath, 'utf-8'));
    expect(
      characterIndex.indexed_character_count,
    ).toBe(characterList.length);

    fs.rmSync(tmpDir, { recursive: true });
  });
});
