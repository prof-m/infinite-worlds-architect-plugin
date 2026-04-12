/**
 * Tests for getCharacterList handler (lib/handlers/utility.js)
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { getCharacterList } from '../../lib/handlers/utility.js';
import { extractStoryData } from '../../lib/handlers/extraction.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const worldFilesDir = path.join(__dirname, '../fixtures/world-files');
const storyExportsDir = path.join(__dirname, '../fixtures/story-exports');

describe('getCharacterList', () => {
  describe('basic extraction', () => {
    it('returns character_list with name and aliases for each NPC', async () => {
      const worldPath = path.join(worldFilesDir, 'minimal-world-with-npcs.json');

      const response = await getCharacterList({ path: worldPath });

      expect(response.content).toBeDefined();
      expect(response.content[0].type).toBe('text');

      const result = JSON.parse(response.content[0].text);
      expect(result.character_list).toBeDefined();
      expect(result.character_list).toHaveLength(3);

      const elara = result.character_list.find(c => c.name === 'Elara');
      expect(elara).toBeDefined();
      expect(elara.aliases).toContain('The Silver Mage');
      expect(elara.aliases).toContain('Lady Elara');

      const grorn = result.character_list.find(c => c.name === 'Grorn');
      expect(grorn).toBeDefined();
      expect(grorn.aliases).toContain('The Red Smith');
    });
  });

  describe('alias deduplication', () => {
    it('removes the primary name from aliases to avoid duplicates', async () => {
      const worldPath = path.join(worldFilesDir, 'minimal-world-with-npcs.json');

      const response = await getCharacterList({ path: worldPath });
      const result = JSON.parse(response.content[0].text);

      const elara = result.character_list.find(c => c.name === 'Elara');
      expect(elara).toBeDefined();
      // The names array in the fixture is ["Elara", "The Silver Mage", "Lady Elara"]
      // "Elara" should not appear in aliases
      expect(elara.aliases).not.toContain('Elara');
      expect(elara.aliases).toHaveLength(2);
    });
  });

  describe('no aliases', () => {
    it('returns aliases: [] for NPC with empty names array', async () => {
      const worldPath = path.join(worldFilesDir, 'minimal-world-with-npcs.json');

      const response = await getCharacterList({ path: worldPath });
      const result = JSON.parse(response.content[0].text);

      const shadow = result.character_list.find(c => c.name === 'Shadow');
      expect(shadow).toBeDefined();
      expect(shadow.aliases).toEqual([]);
    });
  });

  describe('empty NPCs array', () => {
    it('returns character_list: [] when NPCs array is empty', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcl-test-'));
      const worldPath = path.join(tmpDir, 'empty-world.json');

      fs.writeFileSync(worldPath, JSON.stringify({
        title: 'Empty World',
        NPCs: []
      }));

      const response = await getCharacterList({ path: worldPath });
      const result = JSON.parse(response.content[0].text);

      expect(result.character_list).toEqual([]);

      fs.rmSync(tmpDir, { recursive: true });
    });
  });

  describe('missing NPCs field', () => {
    it('returns character_list: [] when NPCs field is absent', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcl-test-'));
      const worldPath = path.join(tmpDir, 'no-npcs-world.json');

      fs.writeFileSync(worldPath, JSON.stringify({
        title: 'World Without NPCs'
      }));

      const response = await getCharacterList({ path: worldPath });
      const result = JSON.parse(response.content[0].text);

      expect(result.character_list).toEqual([]);

      fs.rmSync(tmpDir, { recursive: true });
    });
  });

  describe('invalid path', () => {
    it('throws an error for a non-existent file', async () => {
      await expect(
        getCharacterList({ path: '/nonexistent/path/world.json' })
      ).rejects.toThrow();
    });

    it('throws an error for a directory path instead of a file', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcl-test-'));

      await expect(
        getCharacterList({ path: tmpDir })
      ).rejects.toThrow();

      fs.rmSync(tmpDir, { recursive: true });
    });
  });

  describe('integration: output works as extract_story_data input', () => {
    it('produces character_list that can be passed directly to extract_story_data', async () => {
      const worldPath = path.join(worldFilesDir, 'worlds-a-stage-world.json');
      const storyFile = path.join(storyExportsDir, 'TheWorldsAStageTurn4.txt');
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcl-integration-'));

      // Step 1: get character list from world JSON
      const response = await getCharacterList({ path: worldPath });
      const { character_list } = JSON.parse(response.content[0].text);

      expect(character_list).toHaveLength(1);
      expect(character_list[0].name).toBe('Voltage');

      // Step 2: pass it directly to extractStoryData
      const extractResult = await extractStoryData({
        input_paths: [storyFile],
        extraction_dir: tmpDir,
        character_list,
      });

      expect(extractResult.success).toBe(true);
      expect(extractResult.filesWritten).toContain('character_index.json');

      const characterIndexPath = path.join(tmpDir, 'character_index.json');
      expect(fs.existsSync(characterIndexPath)).toBe(true);

      const characterIndex = JSON.parse(fs.readFileSync(characterIndexPath, 'utf8'));
      expect(characterIndex.characters['Voltage']).toBeDefined();
      expect(characterIndex.characters['Voltage'].mentions.length).toBeGreaterThan(0);

      fs.rmSync(tmpDir, { recursive: true });
    });
  });

  describe('NPC with no names field (undefined)', () => {
    it('returns aliases: [] for NPC where names field is missing entirely', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcl-test-'));
      const worldPath = path.join(tmpDir, 'world-no-names-field.json');

      fs.writeFileSync(worldPath, JSON.stringify({
        title: 'World',
        NPCs: [
          { id: 'aaa', name: 'Orphan', detail: 'No names array at all.' }
        ]
      }));

      const response = await getCharacterList({ path: worldPath });
      const result = JSON.parse(response.content[0].text);

      expect(result.character_list).toHaveLength(1);
      expect(result.character_list[0].name).toBe('Orphan');
      expect(result.character_list[0].aliases).toEqual([]);

      fs.rmSync(tmpDir, { recursive: true });
    });
  });
});
