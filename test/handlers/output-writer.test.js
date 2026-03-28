/**
 * Tests for lib/handlers/output-writer.js
 */

import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { writeOutputFiles } from '../../lib/handlers/output-writer.js';

test('writeOutputFiles - writes manifest.json', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

  const parsedHeader = {
    title: 'Test Story',
    storyBackground: 'Background text',
    objective: 'Find the treasure',
    character: {
      name: 'Hero',
      background: 'A brave adventurer',
      skills: [{ name: 'Strength', rating: 3, level: 'Advanced' }],
    },
  };

  const parsedTurns = [
    {
      number: 1,
      action: null,
      outcome: 'You start your journey',
      secretInfo: null,
      trackedItems: null,
      hiddenTrackedItems: null,
      sourceFile: 'test.txt',
      lineRange: [1, 10],
    },
  ];

  const snapshots = [];

  const manifest = {
    sourceFiles: [{ path: 'test.txt', turns: [1, 1], modified: '2024-01-01' }],
    headerSourceFile: 'test.txt',
    files: ['test.txt'],
  };

  const result = await writeOutputFiles(tmpDir, parsedHeader, parsedTurns, snapshots, manifest);

  assert.strictEqual(result.filesWritten.includes('manifest.json'), true);
  const manifestPath = path.join(tmpDir, 'manifest.json');
  assert.strictEqual(fs.existsSync(manifestPath), true);

  const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.strictEqual(manifestData.version, '1.0');
  assert.strictEqual(manifestData.total_turns, 1);

  fs.rmSync(tmpDir, { recursive: true });
});

test('writeOutputFiles - writes metadata.json', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

  const parsedHeader = {
    title: 'Test Story',
    storyBackground: 'Background',
    objective: 'Quest',
    character: {
      name: 'Hero',
      background: 'Background',
      skills: [],
    },
  };

  const parsedTurns = [
    {
      number: 1,
      action: null,
      outcome: 'Outcome',
      secretInfo: null,
      trackedItems: null,
      hiddenTrackedItems: null,
      sourceFile: 'test.txt',
      lineRange: [1, 10],
    },
  ];

  const manifest = {
    sourceFiles: [],
    headerSourceFile: 'test.txt',
    files: [],
  };

  const result = await writeOutputFiles(tmpDir, parsedHeader, parsedTurns, [], manifest);

  assert.strictEqual(result.filesWritten.includes('metadata.json'), true);
  const metadataPath = path.join(tmpDir, 'metadata.json');
  const metadataData = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  assert.strictEqual(metadataData.title, 'Test Story');

  fs.rmSync(tmpDir, { recursive: true });
});

test('writeOutputFiles - writes turn_index.json', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

  const parsedHeader = { title: null, character: {} };
  const parsedTurns = [
    {
      number: 1,
      action: null,
      outcome: 'Start',
      secretInfo: null,
      trackedItems: null,
      hiddenTrackedItems: null,
      sourceFile: 'test.txt',
      lineRange: [1, 20],
    },
    {
      number: 2,
      action: 'Do something',
      outcome: 'Result',
      secretInfo: 'Secret',
      trackedItems: { item: 'value' },
      hiddenTrackedItems: null,
      sourceFile: 'test.txt',
      lineRange: [21, 40],
    },
  ];

  const manifest = { sourceFiles: [], headerSourceFile: '', files: [] };

  const result = await writeOutputFiles(tmpDir, parsedHeader, parsedTurns, [], manifest);

  assert.strictEqual(result.filesWritten.includes('turn_index.json'), true);
  const turnIndexPath = path.join(tmpDir, 'turn_index.json');
  const turnIndexData = JSON.parse(fs.readFileSync(turnIndexPath, 'utf8'));
  assert.strictEqual(turnIndexData.turns.length, 2);
  assert.strictEqual(turnIndexData.turns[0].number, 1);
  assert.strictEqual(turnIndexData.turns[0].has_action, false);
  assert.strictEqual(turnIndexData.turns[1].has_action, true);
  assert.strictEqual(turnIndexData.turns[1].has_tracked_items, true);

  fs.rmSync(tmpDir, { recursive: true });
});

test('writeOutputFiles - writes tracked_state.json when tracked items exist', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

  const parsedHeader = { title: null, character: {} };
  const parsedTurns = [
    {
      number: 1,
      action: null,
      outcome: 'Start',
      secretInfo: null,
      trackedItems: { gold: '100' },
      hiddenTrackedItems: null,
      sourceFile: 'test.txt',
      lineRange: [1, 10],
    },
  ];

  const snapshots = [
    {
      fromTurn: 1,
      toTurn: 1,
      trackedItems: { gold: '100' },
      hiddenTrackedItems: null,
    },
  ];

  const manifest = { sourceFiles: [], headerSourceFile: '', files: [] };

  const result = await writeOutputFiles(tmpDir, parsedHeader, parsedTurns, snapshots, manifest);

  assert.strictEqual(result.filesWritten.includes('tracked_state.json'), true);
  const trackedStatePath = path.join(tmpDir, 'tracked_state.json');
  const trackedStateData = JSON.parse(fs.readFileSync(trackedStatePath, 'utf8'));
  assert.strictEqual(trackedStateData.snapshots.length, 1);
  assert.deepStrictEqual(trackedStateData.snapshots[0].tracked_items, { gold: '100' });

  fs.rmSync(tmpDir, { recursive: true });
});

test('writeOutputFiles - omits tracked_state.json when no tracked items', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

  const parsedHeader = { title: null, character: {} };
  const parsedTurns = [
    {
      number: 1,
      action: null,
      outcome: 'Start',
      secretInfo: null,
      trackedItems: null,
      hiddenTrackedItems: null,
      sourceFile: 'test.txt',
      lineRange: [1, 10],
    },
  ];

  const manifest = { sourceFiles: [], headerSourceFile: '', files: [] };

  const result = await writeOutputFiles(tmpDir, parsedHeader, parsedTurns, [], manifest);

  assert.strictEqual(result.filesWritten.includes('tracked_state.json'), false);
  const trackedStatePath = path.join(tmpDir, 'tracked_state.json');
  assert.strictEqual(fs.existsSync(trackedStatePath), false);

  fs.rmSync(tmpDir, { recursive: true });
});

test('writeOutputFiles - creates extraction directory if missing', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const extractionDir = path.join(tmpDir, 'nested', 'extraction', 'dir');

  const parsedHeader = { title: null, character: {} };
  const parsedTurns = [
    {
      number: 1,
      action: null,
      outcome: 'Start',
      secretInfo: null,
      trackedItems: null,
      hiddenTrackedItems: null,
      sourceFile: 'test.txt',
      lineRange: [1, 10],
    },
  ];

  const manifest = { sourceFiles: [], headerSourceFile: '', files: [] };

  const result = await writeOutputFiles(extractionDir, parsedHeader, parsedTurns, [], manifest);

  assert.strictEqual(fs.existsSync(extractionDir), true);
  assert(fs.statSync(extractionDir).isDirectory());

  fs.rmSync(tmpDir, { recursive: true });
});

test('writeOutputFiles - handles preview truncation', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

  const parsedHeader = { title: null, character: {} };
  const longAction = 'A'.repeat(150);
  const longOutcome = 'B'.repeat(150);

  const parsedTurns = [
    {
      number: 1,
      action: longAction,
      outcome: longOutcome,
      secretInfo: null,
      trackedItems: null,
      hiddenTrackedItems: null,
      sourceFile: 'test.txt',
      lineRange: [1, 10],
    },
  ];

  const manifest = { sourceFiles: [], headerSourceFile: '', files: [] };

  const result = await writeOutputFiles(tmpDir, parsedHeader, parsedTurns, [], manifest);

  const turnIndexPath = path.join(tmpDir, 'turn_index.json');
  const turnIndexData = JSON.parse(fs.readFileSync(turnIndexPath, 'utf8'));
  assert(turnIndexData.turns[0].action_preview.length <= 100);
  assert(turnIndexData.turns[0].outcome_preview.length <= 100);

  fs.rmSync(tmpDir, { recursive: true });
});
