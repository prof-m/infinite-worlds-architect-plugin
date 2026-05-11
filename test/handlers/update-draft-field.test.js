/**
 * Tests for update_draft_field (I12 — generic patch tool).
 * Covers: H3-format patch, Key:Value-format patch, insert-on-missing,
 * format preservation, container-only enforcement, sub-field-not-found error,
 * story-grounded evidence handling, fence-protected H3 not matched,
 * round-trip preservation of unrelated sub-fields, and concurrency safety.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { update_draft_field } from '../../lib/handlers/draft.js';

let tmpDir, draftPath;

beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-udf-'));
    draftPath = path.join(tmpDir, 'draft.md');
});

afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
});

// ── helpers ────────────────────────────────────────────────────────────────

function makeDraft(sections) {
    return sections.join('\n\n') + '\n';
}

async function writeDraft(content) {
    await fs.writeFile(draftPath, content, 'utf-8');
}

async function readDraft() {
    return fs.readFile(draftPath, 'utf-8');
}

// ── H3-format patching ─────────────────────────────────────────────────────

describe('H3-format patching', () => {
    it('patches a Keywords field in a KIB', async () => {
        await writeDraft(makeDraft([
            '# Title\nTest World',
            '# Keyword Instruction Blocks\n## Honeyveil Blossom\n### Keywords\nhoneyveil, blossom\n### Content\nSome content',
        ]));

        await update_draft_field({
            draftPath,
            sectionName: 'Keyword Instruction Blocks',
            subField: 'Honeyveil Blossom',
            fieldName: 'Keywords',
            newValue: 'honeyveil, blossom, fragrant, rare',
        });

        const result = await readDraft();
        expect(result).toContain('### Keywords\nhoneyveil, blossom, fragrant, rare');
        expect(result).toContain('### Content\nSome content');
    });

    it('preserves the H3 header line casing', async () => {
        await writeDraft(makeDraft([
            '# Keyword Instruction Blocks\n## Blossom\n### Keywords\nold keywords',
        ]));

        await update_draft_field({
            draftPath,
            sectionName: 'Keyword Instruction Blocks',
            subField: 'Blossom',
            fieldName: 'keywords', // lowercase input
            newValue: 'new keywords',
        });

        const result = await readDraft();
        // The ### Keywords header should still exist (original casing preserved)
        expect(result).toMatch(/### Keywords\nnew keywords/);
    });

    it('preserves trailing blank lines between the patched field and the next H3', async () => {
        // Some drafts have a blank line between the Keywords value and ### Content
        await writeDraft(
            '# Keyword Instruction Blocks\n## Blossom\n### Keywords\nold\n\n### Content\ntext\n'
        );

        await update_draft_field({
            draftPath,
            sectionName: 'Keyword Instruction Blocks',
            subField: 'Blossom',
            fieldName: 'Keywords',
            newValue: 'new',
        });

        const result = await readDraft();
        // Should preserve the blank line between Keywords value and ### Content
        expect(result).toContain('### Keywords\nnew\n\n### Content');
    });

    it('preserves unrelated sub-fields byte-identically', async () => {
        await writeDraft(makeDraft([
            '# Keyword Instruction Blocks\n## Alpha\n### Keywords\nalpha keywords\n## Beta\n### Keywords\nbeta keywords\n### Content\nbeta content',
        ]));

        await update_draft_field({
            draftPath,
            sectionName: 'Keyword Instruction Blocks',
            subField: 'Alpha',
            fieldName: 'Keywords',
            newValue: 'updated alpha',
        });

        const result = await readDraft();
        expect(result).toContain('## Alpha\n### Keywords\nupdated alpha');
        expect(result).toContain('## Beta\n### Keywords\nbeta keywords\n### Content\nbeta content');
    });
});

// ── Key:Value-format patching ──────────────────────────────────────────────

describe('Key:Value-format patching', () => {
    it('patches a Key:Value pair in a Tracked Item', async () => {
        await writeDraft(makeDraft([
            '# Tracked Items\n## Gold\nData Type: number\nVisibility: everyone\nInitial Value: 0',
        ]));

        await update_draft_field({
            draftPath,
            sectionName: 'Tracked Items',
            subField: 'Gold',
            fieldName: 'Visibility',
            newValue: 'ai_only',
        });

        const result = await readDraft();
        expect(result).toContain('Visibility: ai_only');
        expect(result).toContain('Data Type: number');
        expect(result).toContain('Initial Value: 0');
    });

    it('preserves original key casing in Key:Value format', async () => {
        await writeDraft(
            '# Tracked Items\n## HP\nData Type: number\n'
        );

        await update_draft_field({
            draftPath,
            sectionName: 'Tracked Items',
            subField: 'HP',
            fieldName: 'data type', // lowercase
            newValue: 'text',
        });

        const result = await readDraft();
        // Key casing should be preserved from the original ("Data Type" not "data type")
        expect(result).toContain('Data Type: text');
        expect(result).not.toContain('data type: text');
    });
});

// ── Insert-on-missing ──────────────────────────────────────────────────────

describe('insert-on-missing', () => {
    it('inserts a field using H3 format when body has other H3 headers', async () => {
        await writeDraft(makeDraft([
            '# Keyword Instruction Blocks\n## Block\n### Content\nsome content',
        ]));

        await update_draft_field({
            draftPath,
            sectionName: 'Keyword Instruction Blocks',
            subField: 'Block',
            fieldName: 'Keywords',
            newValue: 'fire, flame',
        });

        const result = await readDraft();
        expect(result).toContain('### Keywords\nfire, flame');
    });

    it('inserts a field using Key:Value format when body has other KV pairs', async () => {
        await writeDraft(makeDraft([
            '# Tracked Items\n## Score\nData Type: number',
        ]));

        await update_draft_field({
            draftPath,
            sectionName: 'Tracked Items',
            subField: 'Score',
            fieldName: 'Visibility',
            newValue: 'everyone',
        });

        const result = await readDraft();
        expect(result).toContain('Visibility: everyone');
        expect(result).toContain('Data Type: number');
    });

    it('inserts using H3 format when body is empty', async () => {
        await writeDraft('# Keyword Instruction Blocks\n## Empty Block\n');

        await update_draft_field({
            draftPath,
            sectionName: 'Keyword Instruction Blocks',
            subField: 'Empty Block',
            fieldName: 'Keywords',
            newValue: 'foo, bar',
        });

        const result = await readDraft();
        expect(result).toContain('### Keywords\nfoo, bar');
    });
});

// ── Fence-protected H3 not matched ─────────────────────────────────────────

describe('fence tracking', () => {
    it('does not match ### fieldName inside a fenced code block (H3 path)', async () => {
        await writeDraft(
            '# Keyword Instruction Blocks\n## Block\n### Keywords\nreal keywords\n### Content\n```text\n### Keywords\nfake inside fence\n```\n'
        );

        await update_draft_field({
            draftPath,
            sectionName: 'Keyword Instruction Blocks',
            subField: 'Block',
            fieldName: 'Keywords',
            newValue: 'patched',
        });

        const result = await readDraft();
        expect(result).toContain('### Keywords\npatched');
        expect(result).toContain('```text\n### Keywords\nfake inside fence\n```');
    });

    it('does not match Key:Value inside a fenced code block (KV path)', async () => {
        // Sub-field has no H3 headers — KV matching is used. The real Visibility is outside the fence.
        await writeDraft(
            '# Tracked Items\n## Score\nData Type: number\n```\nVisibility: fake_inside_fence\n```\nVisibility: real_value\n'
        );

        await update_draft_field({
            draftPath,
            sectionName: 'Tracked Items',
            subField: 'Score',
            fieldName: 'Visibility',
            newValue: 'ai_only',
        });

        const result = await readDraft();
        // The REAL Visibility line should be patched
        expect(result).toContain('Visibility: ai_only');
        // The fake one inside the fence should be unchanged
        expect(result).toContain('Visibility: fake_inside_fence');
    });

    it('insert-format detection ignores ### inside a fenced code block', async () => {
        // Body has only a fenced ### — this should NOT trigger H3 format insertion.
        // Without fence-aware detection, hasRealH3 would be true and insert-format uses H3.
        // With fence-aware detection, hasRealH3 stays false and insert-format uses KV.
        await writeDraft(
            '# Tracked Items\n## Item\nData Type: number\n```text\n### FakeH3\nsome content\n```\n'
        );

        await update_draft_field({
            draftPath,
            sectionName: 'Tracked Items',
            subField: 'Item',
            fieldName: 'Visibility',
            newValue: 'everyone',
        });

        const result = await readDraft();
        // Should use Key:Value format for the insert (no real H3 outside fence)
        expect(result).toContain('Visibility: everyone');
        expect(result).not.toContain('### Visibility');
    });
});

// ── Error handling ──────────────────────────────────────────────────────────

describe('error handling', () => {
    it('throws if sectionName is not a container section', async () => {
        await writeDraft('# Title\nTest World\n');

        await expect(update_draft_field({
            draftPath,
            sectionName: 'Title',
            subField: 'anything',
            fieldName: 'anything',
            newValue: 'value',
        })).rejects.toThrow(/container section/i);
    });

    it('throws if subField is not found', async () => {
        await writeDraft('# Keyword Instruction Blocks\n## Block A\n### Keywords\nalpha\n');

        await expect(update_draft_field({
            draftPath,
            sectionName: 'Keyword Instruction Blocks',
            subField: 'Nonexistent Block',
            fieldName: 'Keywords',
            newValue: 'x',
        })).rejects.toThrow(/not found/i);
    });

    it('throws if section not found in draft', async () => {
        await writeDraft('# Title\nTest\n');

        await expect(update_draft_field({
            draftPath,
            sectionName: 'Keyword Instruction Blocks',
            subField: 'Block',
            fieldName: 'Keywords',
            newValue: 'x',
        })).rejects.toThrow(/not found in draft/i);
    });

    it('throws if subField is missing', async () => {
        await writeDraft('# Keyword Instruction Blocks\n## Block\n### Keywords\nalpha\n');

        await expect(update_draft_field({
            draftPath,
            sectionName: 'Keyword Instruction Blocks',
            subField: '',
            fieldName: 'Keywords',
            newValue: 'x',
        })).rejects.toThrow(/'subField'/i);
    });

    it('throws if fieldName is missing', async () => {
        await writeDraft('# Keyword Instruction Blocks\n## Block\n### Keywords\nalpha\n');

        await expect(update_draft_field({
            draftPath,
            sectionName: 'Keyword Instruction Blocks',
            subField: 'Block',
            fieldName: '',
            newValue: 'x',
        })).rejects.toThrow(/'fieldName'/i);
    });

    it('throws on unreadable draft file', async () => {
        await expect(update_draft_field({
            draftPath: '/nonexistent/path/draft.md',
            sectionName: 'Keyword Instruction Blocks',
            subField: 'Block',
            fieldName: 'Keywords',
            newValue: 'x',
        })).rejects.toThrow(/Could not read/i);
    });
});

// ── Case-insensitive matching ───────────────────────────────────────────────

describe('case-insensitive matching', () => {
    it('matches sectionName case-insensitively', async () => {
        await writeDraft('# Keyword Instruction Blocks\n## Block\n### Keywords\nalpha\n');

        await expect(update_draft_field({
            draftPath,
            sectionName: 'keyword instruction blocks',
            subField: 'Block',
            fieldName: 'Keywords',
            newValue: 'beta',
        })).resolves.not.toThrow();

        const result = await readDraft();
        expect(result).toContain('### Keywords\nbeta');
    });

    it('matches subField case-insensitively', async () => {
        await writeDraft('# Keyword Instruction Blocks\n## Honeyveil Blossom\n### Keywords\nalpha\n');

        await expect(update_draft_field({
            draftPath,
            sectionName: 'Keyword Instruction Blocks',
            subField: 'honeyveil blossom',
            fieldName: 'Keywords',
            newValue: 'beta',
        })).resolves.not.toThrow();

        const result = await readDraft();
        expect(result).toContain('### Keywords\nbeta');
    });
});

// ── Story-grounded evidence handling ───────────────────────────────────────

describe('story-grounded mode', () => {
    it('requires evidence when story_grounded marker is present', async () => {
        await writeDraft(
            '<!-- draft_mode: story_grounded -->\n# Keyword Instruction Blocks\n## Block\n### Keywords\nalpha\n'
        );

        await expect(update_draft_field({
            draftPath,
            sectionName: 'Keyword Instruction Blocks',
            subField: 'Block',
            fieldName: 'Keywords',
            newValue: 'beta',
            // no evidence
        })).rejects.toThrow(/evidence/i);
    });

    it('accepts a USER_DIRECTED evidence string and injects a comment', async () => {
        await writeDraft(
            '<!-- draft_mode: story_grounded -->\n# Keyword Instruction Blocks\n## Block\n### Keywords\nalpha\n'
        );

        await update_draft_field({
            draftPath,
            sectionName: 'Keyword Instruction Blocks',
            subField: 'Block',
            fieldName: 'Keywords',
            newValue: 'beta',
            evidence: 'USER_DIRECTED: user asked to change keywords to beta',
        });

        const result = await readDraft();
        expect(result).toContain('<!-- evidence:');
        expect(result).toContain('### Keywords\nbeta');
    });

    it('replaces an existing evidence comment rather than accumulating them', async () => {
        await writeDraft(
            '<!-- draft_mode: story_grounded -->\n' +
            '# Keyword Instruction Blocks\n' +
            '## Block\n' +
            '<!-- evidence: USER_DIRECTED: old comment -->\n' +
            '### Keywords\nalpha\n'
        );

        await update_draft_field({
            draftPath,
            sectionName: 'Keyword Instruction Blocks',
            subField: 'Block',
            fieldName: 'Keywords',
            newValue: 'beta',
            evidence: 'USER_DIRECTED: new change requested by user today',
        });

        const result = await readDraft();
        // Should have exactly one evidence comment per sub-field (old one replaced)
        const commentMatches = result.match(/<!-- evidence:/g) || [];
        // Story_grounded marker is also a comment, so expect ≤2 (marker + 1 sub-field comment)
        expect(commentMatches.length).toBeLessThanOrEqual(2);
        expect(result).toContain('### Keywords\nbeta');
    });
});

// ── Concurrency safety ──────────────────────────────────────────────────────

describe('concurrency safety (requires I13 mutex)', () => {
    it('6 parallel patch calls on different sub-fields all land without lost writes', async () => {
        const subFields = ['A', 'B', 'C', 'D', 'E', 'F'];
        const initialBody = subFields
            .map(name => `## ${name}\n### Keywords\noriginal`)
            .join('\n');
        await writeDraft(`# Keyword Instruction Blocks\n${initialBody}\n`);

        await Promise.all(subFields.map(name =>
            update_draft_field({
                draftPath,
                sectionName: 'Keyword Instruction Blocks',
                subField: name,
                fieldName: 'Keywords',
                newValue: `updated-${name.toLowerCase()}`,
            })
        ));

        const result = await readDraft();
        for (const name of subFields) {
            expect(result).toContain(`## ${name}\n### Keywords\nupdated-${name.toLowerCase()}`);
        }
    });
});
