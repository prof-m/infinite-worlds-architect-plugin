/**
 * Tests for lib/handlers/output-writer.js
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { writeOutputFiles } from '../../lib/handlers/output-writer.js';

describe('writeOutputFiles', () => {
  it('writes manifest.json', async () => {
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

    expect(result.filesWritten.includes('manifest.json')).toBe(true);
    const manifestPath = path.join(tmpDir, 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifestData.version).toBe('1.0');
    expect(manifestData.total_turns).toBe(1);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('writes metadata.json', async () => {
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

    expect(result.filesWritten.includes('metadata.json')).toBe(true);
    const metadataPath = path.join(tmpDir, 'metadata.json');
    const metadataData = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    expect(metadataData.title).toBe('Test Story');

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('writes turn_index.json', async () => {
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

    expect(result.filesWritten.includes('turn_index.json')).toBe(true);
    const turnIndexPath = path.join(tmpDir, 'turn_index.json');
    const turnIndexData = JSON.parse(fs.readFileSync(turnIndexPath, 'utf8'));
    expect(turnIndexData.turns.length).toBe(2);
    expect(turnIndexData.turns[0].number).toBe(1);
    expect(turnIndexData.turns[0].has_action).toBe(false);
    expect(turnIndexData.turns[1].has_action).toBe(true);
    expect(turnIndexData.turns[1].has_tracked_items).toBe(true);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('writes tracked_state.json when tracked items exist', async () => {
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

    expect(result.filesWritten.includes('tracked_state.json')).toBe(true);
    const trackedStatePath = path.join(tmpDir, 'tracked_state.json');
    const trackedStateData = JSON.parse(fs.readFileSync(trackedStatePath, 'utf8'));
    expect(trackedStateData.snapshots.length).toBe(1);
    expect(trackedStateData.snapshots[0].tracked_items).toEqual({ gold: '100' });

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('omits tracked_state.json when no tracked items', async () => {
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

    expect(result.filesWritten.includes('tracked_state.json')).toBe(false);
    const trackedStatePath = path.join(tmpDir, 'tracked_state.json');
    expect(fs.existsSync(trackedStatePath)).toBe(false);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('creates extraction directory if missing', async () => {
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

    expect(fs.existsSync(extractionDir)).toBe(true);
    expect(fs.statSync(extractionDir).isDirectory()).toBe(true);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('handles preview truncation', async () => {
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
    expect(turnIndexData.turns[0].action_preview.length).toBeLessThanOrEqual(100);
    expect(turnIndexData.turns[0].outcome_preview.length).toBeLessThanOrEqual(100);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('includes files array in manifest.json output', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

  const parsedHeader = {
    title: 'Test Story',
    storyBackground: 'Background text',
    objective: 'Find the treasure',
    character: {
      name: 'Hero',
      background: 'A brave adventurer',
      skills: [],
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

  const manifest = {
    sourceFiles: [{ path: 'test.txt', turns: [1, 1], modified: '2024-01-01' }],
    headerSourceFile: 'test.txt',
    files: ['test.txt'],
  };

    const result = await writeOutputFiles(tmpDir, parsedHeader, parsedTurns, [], manifest);

    const manifestPath = path.join(tmpDir, 'manifest.json');
    const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(manifestData.files).toBeDefined();
    expect(Array.isArray(manifestData.files)).toBe(true);
    expect(manifestData.files.length).toBe(1);
    expect(manifestData.files[0]).toBe('test.txt');

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('includes multiple files in manifest.json', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

  const parsedHeader = {
    title: 'Test Story',
    storyBackground: 'Background text',
    objective: 'Find the treasure',
    character: {
      name: 'Hero',
      background: 'A brave adventurer',
      skills: [],
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
      sourceFile: 'file1.txt',
      lineRange: [1, 10],
    },
    {
      number: 2,
      action: 'Continue journey',
      outcome: 'You progress',
      secretInfo: null,
      trackedItems: null,
      hiddenTrackedItems: null,
      sourceFile: 'file2.txt',
      lineRange: [1, 15],
    },
  ];

  const manifest = {
    sourceFiles: [
      { path: 'file1.txt', turns: [1, 1], modified: '2024-01-01' },
      { path: 'file2.txt', turns: [2, 2], modified: '2024-01-02' },
    ],
    headerSourceFile: 'file1.txt',
    files: ['file1.txt', 'file2.txt'],
  };

    const result = await writeOutputFiles(tmpDir, parsedHeader, parsedTurns, [], manifest);

    const manifestPath = path.join(tmpDir, 'manifest.json');
    const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(manifestData.files).toBeDefined();
    expect(manifestData.files.length).toBe(2);
    expect(manifestData.files[0]).toBe('file1.txt');
    expect(manifestData.files[1]).toBe('file2.txt');

    fs.rmSync(tmpDir, { recursive: true });
  });
});
