import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
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

describe('combine', () => {
  it('extracts header from newest file', async () => {
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
      expect(result.header).toContain('Test Story');
      expect(result.header).toContain('Story Background');
      expect(result.turns.length).toBe(1);
      expect(result.turns[0].number).toBe(1);
    } finally {
      cleanup(filePath);
    }
  });

  it('detects gaps in turn numbers', async () => {
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
      expect(result.manifest.detected_gaps.length).toBeGreaterThan(0);
      expect(result.manifest.detected_gaps[0]).toContain('2-49');
      expect(result.manifest.detected_gaps[1]).toContain('51-99');
    } finally {
      cleanup(filePath);
    }
  });

  it('throws if no Turn 1 found', async () => {
    const content = `== Test Story ==

-- Turn 5 --
Outcome
-------
Fifth turn only.
`;
    const filePath = createTempFile(content);
    try {
      await expect(combine([filePath])).rejects.toThrow(/No Turn 1 found/);
    } finally {
      cleanup(filePath);
    }
  });

  it('handles multiple files', async () => {
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
      expect(result.turns.length).toBe(3);
      expect(result.turns[0].number).toBe(1);
      expect(result.turns[1].number).toBe(2);
      expect(result.turns[2].number).toBe(3);
    } finally {
      cleanup(file1);
    }
  });

  it('returns correct manifest structure', async () => {
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
      expect(result.manifest.source_files).toBeTruthy();
      expect(result.manifest.header_source).toBeTruthy();
      expect(result.manifest.total_turns).toBe(2);
    } finally {
      cleanup(filePath);
    }
  });

  it('populates manifest files array with single file', async () => {
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
      expect(result.manifest.files).toBeTruthy();
      expect(result.manifest.files.length).toBe(1);
      expect(result.manifest.files[0]).toBe(filePath);
    } finally {
      cleanup(filePath);
    }
  });

  it('populates manifest files array with multiple files', async () => {
    const content1 = `== Test Story ==

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
`;

    const content2 = `== Test Story ==

-- Turn 3 --
Outcome
-------
Turn 3.

-- Turn 4 --
Outcome
-------
Turn 4.
`;

    const file1 = createTempFile(content1);
    const file2 = createTempFile(content2);

    try {
      const result = await combine([file1, file2]);
      expect(result.manifest.files).toBeTruthy();
      expect(result.manifest.files.length).toBe(2);
      expect(result.manifest.files).toContain(file1);
      expect(result.manifest.files).toContain(file2);
    } finally {
      cleanup(file1);
      cleanup(file2);
    }
  });

  it('files array contains exact filepaths', async () => {
    const content = `== Test Story ==

-- Turn 1 --
Outcome
-------
Turn 1.
`;
    const filePath = createTempFile(content);
    try {
      const result = await combine([filePath]);
      expect(typeof result.manifest.files).toBe('object');
      expect(Array.isArray(result.manifest.files)).toBe(true);
      expect(result.manifest.files[0]).toBe(filePath);
    } finally {
      cleanup(filePath);
    }
  });
});
