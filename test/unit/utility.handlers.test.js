/**
 * Tests for lib/handlers/utility.js
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  confirm_path,
  scaffold_world,
  compare_worlds
} from '../../lib/handlers/utility.js';
import { writeWorld } from '../../lib/helpers.js';

let tmpDir;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-utility-'));
});

afterEach(async () => {
  try {
    await fs.rm(tmpDir, { recursive: true });
  } catch (e) {
    // Ignore
  }
});

describe('confirm_path', () => {
  test('confirms existence of file', async () => {
    const testFile = path.join(tmpDir, 'test.txt');
    await fs.writeFile(testFile, 'test content');

    const result = await confirm_path({
      inputPath: testFile,
      type: 'file'
    });

    expect(result.content[0].text).toContain('RESOLVED_PATH');
  });

  test('confirms existence of directory', async () => {
    const testDir = path.join(tmpDir, 'subdir');
    await fs.mkdir(testDir);

    const result = await confirm_path({
      inputPath: testDir,
      type: 'directory'
    });

    expect(result.content[0].text).toContain('RESOLVED_PATH');
  });

  test('returns NOT_FOUND for missing file', async () => {
    const result = await confirm_path({
      inputPath: path.join(tmpDir, 'nonexistent.json'),
      type: 'file'
    });

    expect(result.content[0].text).toContain('NOT_FOUND');
  });

  test('returns NOT_FOUND for missing directory', async () => {
    const result = await confirm_path({
      inputPath: path.join(tmpDir, 'nonexistent'),
      type: 'directory'
    });

    expect(result.content[0].text).toContain('NOT_FOUND');
  });
});

describe('scaffold_world', () => {
  test('creates world with default values', async () => {
    const worldPath = path.join(tmpDir, 'new-world.json');

    const result = await scaffold_world({
      path: worldPath,
      title: 'My Adventure',
      background: 'A mysterious land',
      instructions: 'Explore freely'
    });

    expect(result.content[0].text).toContain('scaffolded successfully');

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.title).toBe('My Adventure');
    expect(world.background).toBe('A mysterious land');
  });

  test('sets expected default values', async () => {
    const worldPath = path.join(tmpDir, 'world.json');

    await scaffold_world({
      path: worldPath,
      title: 'Test World'
    });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));

    expect(world.authorStyle).toBe('Concise, highly descriptive narrative.');
    expect(world.objective).toBe('Explore.');
    expect(world.nsfw).toBe(false);
    expect(world.imageModel).toBe('manticore');
    expect(world.canChangeCharacterName).toBe(true);
  });

  test('initializes all entity arrays', async () => {
    const worldPath = path.join(tmpDir, 'world.json');

    await scaffold_world({
      path: worldPath,
      title: 'Test'
    });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));

    expect(Array.isArray(world.possibleCharacters)).toBeTruthy();
    expect(Array.isArray(world.NPCs)).toBeTruthy();
    expect(Array.isArray(world.instructionBlocks)).toBeTruthy();
    expect(Array.isArray(world.loreBookEntries)).toBeTruthy();
    expect(Array.isArray(world.trackedItems)).toBeTruthy();
    expect(Array.isArray(world.triggerEvents)).toBeTruthy();
  });

  test('initializes with default skills', async () => {
    const worldPath = path.join(tmpDir, 'world.json');

    await scaffold_world({
      path: worldPath,
      title: 'Test'
    });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));

    expect(Array.isArray(world.skills)).toBeTruthy();
    expect(world.skills).toContain('Persuasion');
    expect(world.skills).toContain('Observation');
  });

  test('overwrites existing file', async () => {
    const worldPath = path.join(tmpDir, 'world.json');
    const oldWorld = {
      title: 'Old World',
      some_field: 'old value'
    };

    await writeWorld(worldPath, oldWorld);

    await scaffold_world({
      path: worldPath,
      title: 'New World'
    });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    expect(world.title).toBe('New World');
  });
});

describe('compare_worlds', () => {
  test('identifies differences in root fields', async () => {
    const worldA = {
      title: 'World A',
      description: 'Description A',
      background: 'Background A',
      instructions: 'Instructions A'
    };

    const worldB = {
      title: 'World B',
      description: 'Description B',
      background: 'Background A',
      instructions: 'Instructions A'
    };

    const pathA = path.join(tmpDir, 'worldA.json');
    const pathB = path.join(tmpDir, 'worldB.json');

    await writeWorld(pathA, worldA);
    await writeWorld(pathB, worldB);

    const result = await compare_worlds({
      pathA,
      pathB
    });

    const text = result.content[0].text;
    expect(text).toContain('title');
    expect(text).toContain('description');
  });

  test('compares entity arrays', async () => {
    const worldA = {
      title: 'A',
      description: 'Desc A',
      background: 'Background',
      instructions: 'Instr',
      possibleCharacters: [
        { characterId: 'char_001', name: 'Character A' }
      ],
      NPCs: [],
      instructionBlocks: [],
      loreBookEntries: [],
      trackedItems: [],
      triggerEvents: []
    };

    const worldB = {
      title: 'A',
      description: 'Desc A',
      background: 'Background',
      instructions: 'Instr',
      possibleCharacters: [
        { characterId: 'char_001', name: 'Character B' }
      ],
      NPCs: [],
      instructionBlocks: [],
      loreBookEntries: [],
      trackedItems: [],
      triggerEvents: []
    };

    const pathA = path.join(tmpDir, 'worldA.json');
    const pathB = path.join(tmpDir, 'worldB.json');

    await writeWorld(pathA, worldA);
    await writeWorld(pathB, worldB);

    const result = await compare_worlds({
      pathA,
      pathB
    });

    // Should produce a comparison report
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
  });

  test('throws error for missing first world', async () => {
    const worldB = path.join(tmpDir, 'worldB.json');
    await writeWorld(worldB, { title: 'B' });

    await expect(async () => {
      await compare_worlds({
        pathA: path.join(tmpDir, 'nonexistent.json'),
        pathB: worldB
      });
    }).rejects.toThrow();
  });

  test('throws error for missing second world', async () => {
    const worldA = path.join(tmpDir, 'worldA.json');
    await writeWorld(worldA, { title: 'A' });

    await expect(async () => {
      await compare_worlds({
        pathA: worldA,
        pathB: path.join(tmpDir, 'nonexistent.json')
      });
    }).rejects.toThrow();
  });
});
