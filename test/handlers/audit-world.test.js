/**
 * Tests for audit_world in lib/handlers/validation.js — previously 0% covered.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { audit_world } from '../../lib/handlers/validation.js';
import { writeWorld } from '../../lib/helpers.js';

let tmpDir, worldPath;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-audit-'));
  worldPath = path.join(tmpDir, 'world.json');
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

const repeat = (str, n) => str.repeat(n);

const base = (overrides = {}) => ({
  title: 'Audit World',
  description: 'A description',
  background: 'Short background',
  instructions: 'Short instructions',
  authorStyle: 'Neutral',
  objective: 'Explore',
  descriptionRequest: 'First person',
  summaryRequest: '',
  possibleCharacters: [],
  NPCs: [],
  instructionBlocks: [],
  loreBookEntries: [],
  trackedItems: [],
  triggerEvents: [],
  ...overrides,
});

describe('audit_world - response structure', () => {
  it('returns MCP response with report text', async () => {
    await writeWorld(worldPath, base());
    const result = await audit_world({ path: worldPath });
    expect(result.content[0].type).toBe('text');
    const text = result.content[0].text;
    expect(text).toContain('Audit World');
    expect(text).toContain('Token Cost Estimate');
    expect(text).toContain('Instruction Density');
    expect(text).toContain('Keyword Block Analysis');
    expect(text).toContain('Tracked Items');
    expect(text).toContain('Trigger Dependencies');
    expect(text).toContain('NPC Redundancy');
    expect(text).toContain('Image Instructions');
    expect(text).toContain('Recommendations');
    expect(text).toContain('Summary');
  });

  it('throws for non-existent file', async () => {
    await expect(audit_world({ path: path.join(tmpDir, 'missing.json') })).rejects.toThrow();
  });
});

describe('audit_world - token cost tiers', () => {
  it('Light tier for small worlds', async () => {
    await writeWorld(worldPath, base({ instructions: 'Go.', background: 'Here.', objective: '', descriptionRequest: '', authorStyle: '', summaryRequest: '' }));
    const text = (await audit_world({ path: worldPath })).content[0].text;
    expect(text).toContain('Light');
  });

  it('Very Heavy tier and recommendation for >10000 char worlds', async () => {
    await writeWorld(worldPath, base({ instructions: repeat('verbose instruction text here ', 400) }));
    const text = (await audit_world({ path: worldPath })).content[0].text;
    expect(text).toContain('Very Heavy');
  });
});

describe('audit_world - instruction density', () => {
  it('reports all within limits for short fields', async () => {
    await writeWorld(worldPath, base());
    const text = (await audit_world({ path: worldPath })).content[0].text;
    expect(text).toContain('All fields within recommended limits');
  });

  it('flags field with >500 words', async () => {
    await writeWorld(worldPath, base({ instructions: repeat('word ', 600) }));
    const text = (await audit_world({ path: worldPath })).content[0].text;
    expect(text).toContain('instructions');
    expect(text).toContain('500-word limit');
  });
});

describe('audit_world - keyword block analysis', () => {
  it('flags single-keyword block', async () => {
    await writeWorld(worldPath, base({
      loreBookEntries: [{ id: 'lb1', name: 'Dragon Lore', keywords: ['dragon'], content: 'Old.' }],
    }));
    const text = (await audit_world({ path: worldPath })).content[0].text;
    expect(text).toContain('Dragon Lore');
    expect(text).toContain('Only 1 keyword');
  });

  it('does not flag multi-keyword blocks', async () => {
    await writeWorld(worldPath, base({
      loreBookEntries: [{ id: 'lb1', name: 'Lore', keywords: ['a', 'b', 'c'], content: 'Text.' }],
    }));
    const text = (await audit_world({ path: worldPath })).content[0].text;
    expect(text).not.toContain('Only 1 keyword');
  });
});

describe('audit_world - tracked items', () => {
  it('flags item with no references', async () => {
    await writeWorld(worldPath, base({
      trackedItems: [{ id: 'ti1', name: 'Mystery Counter', description: '', updateInstructions: '', initialValue: '0' }],
      instructions: 'Nothing relevant.',
    }));
    const text = (await audit_world({ path: worldPath })).content[0].text;
    expect(text).toContain('Mystery Counter');
    expect(text).toContain('No matching reference');
  });

  it('does not flag item referenced in always-on field (instructions)', async () => {
    await writeWorld(worldPath, base({
      trackedItems: [{ id: 'ti1', name: 'Gold Coins', description: '', updateInstructions: '', initialValue: '0' }],
      instructions: 'Track Gold Coins when player finds treasure.',
    }));
    const text = (await audit_world({ path: worldPath })).content[0].text;
    expect(text).not.toContain('No matching reference');
  });

  it('does not flag item referenced in an instruction block', async () => {
    await writeWorld(worldPath, base({
      trackedItems: [{ id: 'ti1', name: 'Gold Coins', description: '', updateInstructions: '', initialValue: '0' }],
      instructionBlocks: [{ id: 'ib1', name: 'Economy', content: 'Track Gold Coins when the player earns money.' }],
    }));
    const text = (await audit_world({ path: worldPath })).content[0].text;
    expect(text).not.toContain('No matching reference');
  });

  it('does not flag item referenced in a lore entry', async () => {
    await writeWorld(worldPath, base({
      trackedItems: [{ id: 'ti1', name: 'Reputation', description: '', updateInstructions: '', initialValue: '0' }],
      loreBookEntries: [{ id: 'lb1', name: 'Faction', keywords: ['faction'], content: 'Adjust Reputation based on faction interactions.' }],
    }));
    const text = (await audit_world({ path: worldPath })).content[0].text;
    expect(text).not.toContain('No matching reference');
  });

  it('flags oversized tracked item', async () => {
    await writeWorld(worldPath, base({
      trackedItems: [{ id: 'ti1', name: 'BigItem', description: repeat('x', 5001), updateInstructions: '', initialValue: '' }],
    }));
    const text = (await audit_world({ path: worldPath })).content[0].text;
    expect(text).toContain('exceeds 5,000 char warning threshold');
  });
});

describe('audit_world - trigger dependencies', () => {
  it('reports no dependencies for standalone triggers', async () => {
    await writeWorld(worldPath, base({
      triggerEvents: [{ id: 't1', name: 'Start', triggerConditions: [], triggerEffects: [] }],
    }));
    const text = (await audit_world({ path: worldPath })).content[0].text;
    expect(text).toContain('No prerequisite/blocker chains found');
  });

  it('detects cycle in prerequisites', async () => {
    await writeWorld(worldPath, base({
      triggerEvents: [
        { id: 't1', name: 'A', triggerConditions: [], triggerEffects: [], prerequisites: ['t2'] },
        { id: 't2', name: 'B', triggerConditions: [], triggerEffects: [], prerequisites: ['t1'] },
      ],
    }));
    const text = (await audit_world({ path: worldPath })).content[0].text;
    expect(text).toContain('Cycle detected');
  });

  it('reports prerequisite chains', async () => {
    await writeWorld(worldPath, base({
      triggerEvents: [
        { id: 't1', name: 'First', triggerConditions: [], triggerEffects: [] },
        { id: 't2', name: 'Second', triggerConditions: [], triggerEffects: [], prerequisites: ['t1'] },
      ],
    }));
    const text = (await audit_world({ path: worldPath })).content[0].text;
    expect(text).toContain('Second');
    expect(text).toContain('Prerequisites');
  });

  it('reports max depth of 0 with no chain', async () => {
    await writeWorld(worldPath, base({
      triggerEvents: [{ id: 't1', name: 'Solo', triggerConditions: [], triggerEffects: [] }],
    }));
    const text = (await audit_world({ path: worldPath })).content[0].text;
    expect(text).toContain('Max chain depth: 0');
  });

  it('flags >10 triggerOnEvent conditions with platform limit warning', async () => {
    const triggers = Array.from({ length: 11 }, (_, i) => ({
      id: `t${i}`, name: `T${i}`,
      triggerConditions: [{ id: `c${i}`, type: 'triggerOnEvent', data: `event${i}`, category: 'condition' }],
      triggerEffects: [],
    }));
    await writeWorld(worldPath, base({ triggerEvents: triggers }));
    const text = (await audit_world({ path: worldPath })).content[0].text;
    expect(text).toContain('platform limit is 10');
    expect(text).toContain('11 triggerOnEvent');
  });

  it('reports max chain depth', async () => {
    await writeWorld(worldPath, base({
      triggerEvents: [
        { id: 't1', name: 'A', triggerConditions: [], triggerEffects: [] },
        { id: 't2', name: 'B', triggerConditions: [], triggerEffects: [], prerequisites: ['t1'] },
        { id: 't3', name: 'C', triggerConditions: [], triggerEffects: [], prerequisites: ['t2'] },
      ],
    }));
    const text = (await audit_world({ path: worldPath })).content[0].text;
    expect(text).toContain('Max chain depth: 2');
  });
});

describe('audit_world - NPC redundancy', () => {
  it('reports no redundancy when NPC not in always-on fields', async () => {
    await writeWorld(worldPath, base({ NPCs: [{ id: 'n1', name: 'Alice' }], instructions: 'Do something.' }));
    const text = (await audit_world({ path: worldPath })).content[0].text;
    expect(text).toContain('No redundant NPC references');
  });

  it('flags NPC name found in instructions', async () => {
    await writeWorld(worldPath, base({
      NPCs: [{ id: 'n1', name: 'Malekar' }],
      instructions: 'Malekar is the main villain.',
    }));
    const text = (await audit_world({ path: worldPath })).content[0].text;
    expect(text).toContain('Malekar');
    expect(text).toContain('double-charging');
  });
});

describe('audit_world - image instructions', () => {
  it('reports all within limits for short image fields', async () => {
    await writeWorld(worldPath, base({ imageStyleCharacterPre: 'portrait of', imageStyleCharacterPost: 'hd' }));
    const text = (await audit_world({ path: worldPath })).content[0].text;
    expect(text).toContain('All image instruction fields within recommended limits');
  });

  it('flags image field >200 chars', async () => {
    await writeWorld(worldPath, base({ imageStyleCharacterPre: repeat('very detailed artistic style ', 10) }));
    const text = (await audit_world({ path: worldPath })).content[0].text;
    expect(text).toContain('imageStyleCharacterPre');
    expect(text).toContain('200-char recommendation');
  });
});

describe('audit_world - overall rating', () => {
  it('rates clean world as Good', async () => {
    await writeWorld(worldPath, base());
    const text = (await audit_world({ path: worldPath })).content[0].text;
    expect(text).toContain('Good');
  });
});
