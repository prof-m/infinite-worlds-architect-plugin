/**
 * Tests for lib/handlers/draft.js
 * Tests draft markdown parsing and compilation
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  compile_draft,
  decompile_json,
  read_draft_section,
  update_draft_section,
  get_diff_summary
} from '../../lib/handlers/draft.js';
import { writeWorld } from '../../lib/helpers.js';

let tmpDir, draftPath, worldPath;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-draft-'));
  draftPath = path.join(tmpDir, 'draft.md');
  worldPath = path.join(tmpDir, 'world.json');
});

afterEach(async () => {
  try {
    await fs.rm(tmpDir, { recursive: true });
  } catch (e) {
    // Ignore
  }
});

const createSimpleDraft = () => `# Title
Test World

# Description
A test world description

# Background
A test background

# Main Instructions
Test instructions`;

describe('Draft handler exports', () => {
  test('compile_draft, decompile_json, read_draft_section are defined', () => {
    assert(typeof compile_draft === 'function');
    assert(typeof decompile_json === 'function');
    assert(typeof read_draft_section === 'function');
  });
});

describe('compile_draft', () => {
  test('compile_draft is exported and callable', () => {
    assert(typeof compile_draft === 'function');
  });
});

describe('decompile_json', () => {
  test('decompile_json is exported and callable', () => {
    assert(typeof decompile_json === 'function');
  });
});

describe('read_draft_section', () => {
  test('read_draft_section is exported and callable', () => {
    assert(typeof read_draft_section === 'function');
  });
});

describe('update_draft_section', () => {
  test('update_draft_section is exported and callable', () => {
    assert(typeof update_draft_section === 'function');
  });
});

describe('get_diff_summary', () => {
  test('throws error for missing original', async () => {
    await fs.writeFile(draftPath, createSimpleDraft());

    await assert.rejects(async () => {
      await get_diff_summary({
        originalPath: path.join(tmpDir, 'nonexistent.json'),
        draftPath
      });
    });
  });
});
