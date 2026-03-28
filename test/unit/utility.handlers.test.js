/**
 * Tests for lib/handlers/utility.js
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
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

    assert(result.content[0].text.includes('RESOLVED_PATH'));
  });

  test('confirms existence of directory', async () => {
    const testDir = path.join(tmpDir, 'subdir');
    await fs.mkdir(testDir);

    const result = await confirm_path({
      inputPath: testDir,
      type: 'directory'
    });

    assert(result.content[0].text.includes('RESOLVED_PATH'));
  });

  test('returns NOT_FOUND for missing file', async () => {
    const result = await confirm_path({
      inputPath: path.join(tmpDir, 'nonexistent.json'),
      type: 'file'
    });

    assert(result.content[0].text.includes('NOT_FOUND'));
  });

  test('returns NOT_FOUND for missing directory', async () => {
    const result = await confirm_path({
      inputPath: path.join(tmpDir, 'nonexistent'),
      type: 'directory'
    });

    assert(result.content[0].text.includes('NOT_FOUND'));
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

    assert(result.content[0].text.includes('scaffolded successfully'));

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));
    assert.strictEqual(world.title, 'My Adventure');
    assert.strictEqual(world.background, 'A mysterious land');
  });

  test('sets expected default values', async () => {
    const worldPath = path.join(tmpDir, 'world.json');

    await scaffold_world({
      path: worldPath,
      title: 'Test World'
    });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));

    assert.strictEqual(world.authorStyle, 'Concise, highly descriptive narrative.');
    assert.strictEqual(world.objective, 'Explore.');
    assert.strictEqual(world.nsfw, false);
    assert.strictEqual(world.imageModel, 'manticore');
    assert.strictEqual(world.canChangeCharacterName, true);
  });

  test('initializes all entity arrays', async () => {
    const worldPath = path.join(tmpDir, 'world.json');

    await scaffold_world({
      path: worldPath,
      title: 'Test'
    });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));

    assert(Array.isArray(world.possibleCharacters));
    assert(Array.isArray(world.NPCs));
    assert(Array.isArray(world.instructionBlocks));
    assert(Array.isArray(world.loreBookEntries));
    assert(Array.isArray(world.trackedItems));
    assert(Array.isArray(world.triggerEvents));
  });

  test('initializes with default skills', async () => {
    const worldPath = path.join(tmpDir, 'world.json');

    await scaffold_world({
      path: worldPath,
      title: 'Test'
    });

    const world = JSON.parse(await fs.readFile(worldPath, 'utf-8'));

    assert(Array.isArray(world.skills));
    assert(world.skills.includes('Persuasion'));
    assert(world.skills.includes('Observation'));
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
    assert.strictEqual(world.title, 'New World');
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
    assert(text.includes('title'));
    assert(text.includes('description'));
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
    assert(result.content !== undefined);
    assert(result.content.length > 0);
  });

  test('throws error for missing first world', async () => {
    const worldB = path.join(tmpDir, 'worldB.json');
    await writeWorld(worldB, { title: 'B' });

    await assert.rejects(async () => {
      await compare_worlds({
        pathA: path.join(tmpDir, 'nonexistent.json'),
        pathB: worldB
      });
    });
  });

  test('throws error for missing second world', async () => {
    const worldA = path.join(tmpDir, 'worldA.json');
    await writeWorld(worldA, { title: 'A' });

    await assert.rejects(async () => {
      await compare_worlds({
        pathA: worldA,
        pathB: path.join(tmpDir, 'nonexistent.json')
      });
    });
  });
});
