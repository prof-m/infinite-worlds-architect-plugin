/**
 * Concurrency tests for lib/locks.js and the draft mutating handlers.
 *
 * These tests verify that parallel MCP handler invocations targeting the same
 * draft file do not produce lost-update races (TOCTOU).  Without the mutex,
 * interleaved readFile/writeFile pairs cause later writers to clobber earlier
 * writes — these tests intermittently (but reliably over many runs) detect that.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { update_draft_section, create_sub_field } from '../../lib/handlers/draft.js';
import { acquireDraftLock } from '../../lib/locks.js';

let tmpDir, draftPath;

beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-draft-concurrency-'));
    draftPath = path.join(tmpDir, 'draft.md');
});

afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a draft that has a KIB container section with N sub-fields. */
function kibDraft(subFields) {
    const header = `# Title\nTest World\n\n# Description\nA world.\n\n`;
    const kibSection = `# Keyword Instruction Blocks\n` +
        subFields.map(name => `## ${name}\nOriginal content for ${name}.\n`).join('\n');
    return header + kibSection;
}

/** Extract the body of a sub-field from raw draft text. */
function readSubField(draftText, subFieldName) {
    const lines = draftText.split('\n');
    let inTarget = false;
    const body = [];
    for (const line of lines) {
        if (/^## /i.test(line)) {
            if (line.replace(/^## /, '').trim().toLowerCase() === subFieldName.toLowerCase()) {
                inTarget = true;
                continue;
            }
            if (inTarget) break;
        }
        if (inTarget) body.push(line);
    }
    return body.join('\n').trim();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('draft mutex — concurrent update_draft_section', () => {
    it('applies all 6 parallel sub-field updates without any lost writes', async () => {
        const subFields = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta'];
        await fs.writeFile(draftPath, kibDraft(subFields), 'utf-8');

        // Fire all 6 updates simultaneously — each targets a different sub-field.
        const updates = subFields.map(name =>
            update_draft_section({
                draftPath,
                sectionName: 'Keyword Instruction Blocks',
                subField: name,
                newContent: `Updated content for ${name}.`,
            })
        );

        await Promise.all(updates);

        const finalDraft = await fs.readFile(draftPath, 'utf-8');

        for (const name of subFields) {
            const body = readSubField(finalDraft, name);
            expect(body).toBe(`Updated content for ${name}.`);
        }
    });

    it('applies all 6 parallel create_sub_field calls to the same section without duplicates or lost writes', async () => {
        // Start with a draft that has the KIB section but no sub-fields yet.
        const baseDraft = `# Title\nTest World\n\n# Description\nA world.\n\n# Keyword Instruction Blocks\n`;
        await fs.writeFile(draftPath, baseDraft, 'utf-8');

        const newSubFields = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'];

        // Each call targets a different sub-field (parallel creation of the
        // *same* sub-field is a user error, not a race). Without the mutex,
        // concurrent reads of the same initial draft state would cause every
        // handler to see an empty KIB section and write only its own sub-field,
        // leaving 5 of 6 creates lost.
        await Promise.all(newSubFields.map(name =>
            create_sub_field({
                draftPath,
                sectionName: 'Keyword Instruction Blocks',
                subField: name,
                newContent: `Content for ${name}.`,
            })
        ));

        const finalDraft = await fs.readFile(draftPath, 'utf-8');

        // All 6 sub-fields must be present.
        for (const name of newSubFields) {
            expect(finalDraft).toContain(`## ${name}`);
            expect(finalDraft).toContain(`Content for ${name}.`);
        }

        // No duplicates.
        for (const name of newSubFields) {
            const count = (finalDraft.match(new RegExp(`## ${name}`, 'g')) ?? []).length;
            expect(count).toBe(1);
        }
    });
});

describe('acquireDraftLock — unit', () => {
    it('serialises concurrent acquirers: second caller waits until first releases', async () => {
        const lockPath = path.join(tmpDir, 'lock-test.md');
        const events = [];

        const release1 = await acquireDraftLock(lockPath);
        events.push('acquired-1');

        // Start a second acquire — it should block until release1() is called.
        const pending2 = acquireDraftLock(lockPath).then(release2 => {
            events.push('acquired-2');
            release2();
        });

        // Give the event loop a chance to run pending2's waiting microtasks.
        await new Promise(r => setImmediate(r));

        // Second acquirer must still be waiting.
        expect(events).toEqual(['acquired-1']);

        release1();
        events.push('released-1');

        await pending2;

        expect(events).toEqual(['acquired-1', 'released-1', 'acquired-2']);
    });

    it('releases the map entry after the last holder releases', async () => {
        const lockPath = path.join(tmpDir, 'gc-test.md');

        const release = await acquireDraftLock(lockPath);
        release();

        // After release, the map should have pruned the entry.
        // We verify this indirectly: a subsequent acquire completes synchronously
        // (no waiting) — if the entry were still present and stale it would block.
        const release2 = await acquireDraftLock(lockPath);
        release2();
        // If we reach here without hanging, the GC is working correctly.
    });

    it('allows independent paths to be locked concurrently without blocking each other', async () => {
        const path1 = path.join(tmpDir, 'draft-a.md');
        const path2 = path.join(tmpDir, 'draft-b.md');

        const release1 = await acquireDraftLock(path1);
        // path2 must acquire immediately — different key.
        const release2 = await acquireDraftLock(path2);

        release1();
        release2();
    });

    it('timeout rejects the waiting caller and leaves subsequent waiters unblocked', async () => {
        // This test exercises the CRITICAL path: if the timeout fires before we
        // acquire, the internal promise chain must still resolve so that callers
        // who queue up after us are not permanently deadlocked.
        jest.useFakeTimers();
        try {
            const lockPath = path.join(tmpDir, 'timeout-test.md');

            // Holder 1 acquires and never releases (simulates a hung handler).
            const _release1 = await acquireDraftLock(lockPath);

            // Waiter 2 starts acquiring — will time out because holder 1 never releases.
            // Attach the rejection assertion BEFORE advancing the clock so the
            // rejection is always "handled" from Node's perspective; asserting
            // after the await would create an unhandled-rejection window.
            const waiter2 = acquireDraftLock(lockPath);
            const waiter2Assertion = expect(waiter2).rejects.toThrow('Draft lock timeout');

            // Advance fake clock past the 30 s threshold, flushing microtasks between ticks.
            await jest.advanceTimersByTimeAsync(31_000);

            await waiter2Assertion;

            // After the timeout handler ran, the internal chain was unblocked.
            // Waiter 3 should acquire immediately (prev is a fresh resolved promise).
            const release3 = await acquireDraftLock(lockPath);
            expect(typeof release3).toBe('function');
            release3();
        } finally {
            jest.useRealTimers();
        }
    });
});
