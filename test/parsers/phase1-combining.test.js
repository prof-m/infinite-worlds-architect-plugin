import test from 'node:test';
import assert from 'node:assert';
import { combine } from '../../lib/parsers/phase1-combining.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Helper to create temp test files
function createTempFile(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  const filePath = path.join(dir, 'test.txt');
  fs.writeFileSync(filePath, content);
  return filePath;
}

function cleanup(filePath) {
  const dir = path.dirname(filePath);
  fs.rmSync(dir, { recursive: true });
}

test('combine extracts header from newest file', async () => {
  const content = `== Test Story ==

-- Story Background --
This is a test story.

-- Turn 1 --

Outcome
-------
Turn 1 outcome.
`;
  const filePath = createTempFile(content);
  try {
    const result = await combine([filePath]);
    assert.ok(result.header.includes('Test Story'));
    assert.ok(result.header.includes('Story Background'));
    assert.strictEqual(result.turns.length, 1);
    assert.strictEqual(result.turns[0].number, 1);
  } finally {
    cleanup(filePath);
  }
});

test('combine detects gaps in turn numbers', async () => {
  const content = `== Test Story ==

-- Turn 1 --
Outcome
-------
First turn.

-- Turn 50 --
Outcome
-------
Fiftieth turn.

-- Turn 100 --
Outcome
-------
Hundredth turn.
`;
  const filePath = createTempFile(content);
  try {
    const result = await combine([filePath]);
    assert.ok(result.manifest.detected_gaps.length > 0);
    assert.ok(result.manifest.detected_gaps[0].includes('2-49'));
    assert.ok(result.manifest.detected_gaps[1].includes('51-99'));
  } finally {
    cleanup(filePath);
  }
});

test('combine throws if no Turn 1 found', async () => {
  const content = `== Test Story ==

-- Turn 5 --
Outcome
-------
Fifth turn only.
`;
  const filePath = createTempFile(content);
  try {
    assert.rejects(async () => {
      await combine([filePath]);
    }, /No Turn 1 found/);
  } finally {
    cleanup(filePath);
  }
});

test('combine handles multiple files', async () => {
  const file1Content = `== Test Story ==

-- Story Background --
Original background.

-- Turn 1 --
Outcome
-------
Turn 1.

-- Turn 2 --
Outcome
-------
Turn 2.

-- Turn 3 --
Outcome
-------
Turn 3.
`;

  const file1 = createTempFile(file1Content);

  try {
    const result = await combine([file1]);
    assert.strictEqual(result.turns.length, 3);
    assert.strictEqual(result.turns[0].number, 1);
    assert.strictEqual(result.turns[1].number, 2);
    assert.strictEqual(result.turns[2].number, 3);
  } finally {
    cleanup(file1);
  }
});

test('combine returns correct manifest structure', async () => {
  const content = `== Test Story ==

-- Turn 1 --
Outcome
-------
Turn 1.

-- Turn 2 --
Outcome
-------
Turn 2.
`;
  const filePath = createTempFile(content);
  try {
    const result = await combine([filePath]);
    assert.ok(result.manifest.source_files);
    assert.ok(result.manifest.header_source);
    assert.strictEqual(result.manifest.total_turns, 2);
  } finally {
    cleanup(filePath);
  }
});
