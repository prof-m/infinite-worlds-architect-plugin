import { describe, it, expect } from '@jest/globals';
import { parseTrackedItems, generateSnapshots } from '../../lib/parsers/phase4-tracked-items.js';

describe('parseTrackedItems', () => {
  it('null input returns null', () => {
    expect(parseTrackedItems(null)).toBeNull();
  });

  it('empty string returns null', () => {
    expect(parseTrackedItems('')).toBeNull();
  });

  it('whitespace-only returns null', () => {
    expect(parseTrackedItems('   \n  \t  \n  ')).toBeNull();
  });

  it('simple single-line items', () => {
  const text = `Item1:
value1

Item2:
value2`;

    const result = parseTrackedItems(text);
    expect(result).toEqual({
      Item1: 'value1',
      Item2: 'value2',
    });
  });

  it('multi-line item values', () => {
  const text = `Item1:
line1
line2
line3

Item2:
value2`;

    const result = parseTrackedItems(text);
    expect(result).toEqual({
      Item1: 'line1\nline2\nline3',
      Item2: 'value2',
    });
  });

  it('empty item value (header at end)', () => {
  const text = `Item1:
value1

Item2:`;

    const result = parseTrackedItems(text);
    expect(result).toEqual({
      Item1: 'value1',
      Item2: '',
    });
  });

  it('rejects false positives like "URL: http://example.com"', () => {
  const text = `Item1:
value1
MoreText:
somevalue`;

    const result = parseTrackedItems(text);
    // "MoreText:" IS a valid item header (colon with no content after)
    // "Item1:" is a valid header
    // Anything with content after the colon is NOT a header
    expect(result).toEqual({
      Item1: 'value1',
      MoreText: 'somevalue',
    });
  });

  it('non-header lines are included in values', () => {
  const text = `Item1:
value1
URL: http://example.com
MoreText:
somevalue`;

    const result = parseTrackedItems(text);
    // "URL: http://example.com" is NOT a header (has content after colon)
    // So it gets included in Item1's value
    expect(result).toEqual({
      Item1: 'value1\nURL: http://example.com',
      MoreText: 'somevalue',
    });
  });

  it('complex real-world example', () => {
  const text = `ViviDevelopment:
0

VivianPersonality:
Vivian-dominant`;

    const result = parseTrackedItems(text);
    expect(result).toEqual({
      ViviDevelopment: '0',
      VivianPersonality: 'Vivian-dominant',
    });
  });

  it('item with indented continuation lines', () => {
  const text = `Item1:
value part 1
  indented part 2
  indented part 3`;

    const result = parseTrackedItems(text);
    expect(result).toEqual({
      Item1: 'value part 1\n  indented part 2\n  indented part 3',
    });
  });
});

describe('generateSnapshots', () => {
  it('all turns with null tracked items', () => {
  const turns = [
    { number: 1, trackedItems: null, hiddenTrackedItems: null },
    { number: 2, trackedItems: null, hiddenTrackedItems: null },
    { number: 3, trackedItems: null, hiddenTrackedItems: null },
  ];

    const snapshots = generateSnapshots(turns);
    expect(snapshots.length).toBe(1);
    expect(snapshots[0]).toEqual({
      fromTurn: 1,
      toTurn: 3,
      trackedItems: null,
      hiddenTrackedItems: null,
    });
  });

  it('state change in tracked items', () => {
  const turns = [
    { number: 1, trackedItems: null, hiddenTrackedItems: null },
    { number: 2, trackedItems: null, hiddenTrackedItems: null },
    { number: 3, trackedItems: { Gold: '50' }, hiddenTrackedItems: null },
    { number: 4, trackedItems: { Gold: '50' }, hiddenTrackedItems: null },
  ];

    const snapshots = generateSnapshots(turns);
    expect(snapshots.length).toBe(2);
    expect(snapshots[0]).toEqual({
      fromTurn: 1,
      toTurn: 2,
      trackedItems: null,
      hiddenTrackedItems: null,
    });
    expect(snapshots[1]).toEqual({
      fromTurn: 3,
      toTurn: 4,
      trackedItems: { Gold: '50' },
      hiddenTrackedItems: null,
    });
  });

  it('value change in tracked items', () => {
  const turns = [
    { number: 1, trackedItems: { Gold: '50' }, hiddenTrackedItems: null },
    { number: 2, trackedItems: { Gold: '75' }, hiddenTrackedItems: null },
    { number: 3, trackedItems: { Gold: '75' }, hiddenTrackedItems: null },
  ];

    const snapshots = generateSnapshots(turns);
    expect(snapshots.length).toBe(2);
    expect(snapshots[0]).toEqual({
      fromTurn: 1,
      toTurn: 1,
      trackedItems: { Gold: '50' },
      hiddenTrackedItems: null,
    });
    expect(snapshots[1]).toEqual({
      fromTurn: 2,
      toTurn: 3,
      trackedItems: { Gold: '75' },
      hiddenTrackedItems: null,
    });
  });

  it('state change in hidden tracked items', () => {
  const turns = [
    { number: 1, trackedItems: null, hiddenTrackedItems: null },
    { number: 2, trackedItems: null, hiddenTrackedItems: { Secret: 'yes' } },
    { number: 3, trackedItems: null, hiddenTrackedItems: { Secret: 'yes' } },
  ];

    const snapshots = generateSnapshots(turns);
    expect(snapshots.length).toBe(2);
    expect(snapshots[0]).toEqual({
      fromTurn: 1,
      toTurn: 1,
      trackedItems: null,
      hiddenTrackedItems: null,
    });
    expect(snapshots[1]).toEqual({
      fromTurn: 2,
      toTurn: 3,
      trackedItems: null,
      hiddenTrackedItems: { Secret: 'yes' },
    });
  });

  it('complex multi-state transitions', () => {
  const turns = [
    { number: 1, trackedItems: null, hiddenTrackedItems: null },
    { number: 2, trackedItems: null, hiddenTrackedItems: null },
    { number: 3, trackedItems: { Gold: '50' }, hiddenTrackedItems: null },
    { number: 4, trackedItems: { Gold: '50' }, hiddenTrackedItems: null },
    { number: 5, trackedItems: { Gold: '75' }, hiddenTrackedItems: { Secret: 'yes' } },
    { number: 6, trackedItems: { Gold: '75' }, hiddenTrackedItems: { Secret: 'yes' } },
    { number: 7, trackedItems: null, hiddenTrackedItems: null },
  ];

    const snapshots = generateSnapshots(turns);
    expect(snapshots.length).toBe(4);
    expect(snapshots[0]).toEqual({
      fromTurn: 1,
      toTurn: 2,
      trackedItems: null,
      hiddenTrackedItems: null,
    });
    expect(snapshots[1]).toEqual({
      fromTurn: 3,
      toTurn: 4,
      trackedItems: { Gold: '50' },
      hiddenTrackedItems: null,
    });
    expect(snapshots[2]).toEqual({
      fromTurn: 5,
      toTurn: 6,
      trackedItems: { Gold: '75' },
      hiddenTrackedItems: { Secret: 'yes' },
    });
    expect(snapshots[3]).toEqual({
      fromTurn: 7,
      toTurn: 7,
      trackedItems: null,
      hiddenTrackedItems: null,
    });
  });

  it('every turn falls within exactly one snapshot range', () => {
  const turns = [
    { number: 1, trackedItems: null, hiddenTrackedItems: null },
    { number: 2, trackedItems: { A: '1' }, hiddenTrackedItems: null },
    { number: 3, trackedItems: { A: '2' }, hiddenTrackedItems: null },
    { number: 4, trackedItems: { A: '2' }, hiddenTrackedItems: null },
    { number: 5, trackedItems: null, hiddenTrackedItems: null },
  ];

  const snapshots = generateSnapshots(turns);

    // Verify every turn number falls within exactly one snapshot
    for (let turnNum = 1; turnNum <= 5; turnNum++) {
      const matching = snapshots.filter(
        s => s.fromTurn <= turnNum && turnNum <= s.toTurn
      );
      expect(matching.length).toBe(1);
    }
  });

  it('sorted output', () => {
  // Input turns are unsorted to test that snapshots are still in order
  const turns = [
    { number: 3, trackedItems: { X: '3' }, hiddenTrackedItems: null },
    { number: 1, trackedItems: null, hiddenTrackedItems: null },
    { number: 4, trackedItems: { X: '3' }, hiddenTrackedItems: null },
    { number: 2, trackedItems: { X: '1' }, hiddenTrackedItems: null },
  ];

    const snapshots = generateSnapshots(turns);

    // Verify snapshots are in order
    for (let i = 0; i < snapshots.length - 1; i++) {
      expect(snapshots[i].fromTurn <= snapshots[i + 1].fromTurn).toBe(true);
    }

    expect(snapshots.length).toBe(3);
    expect(snapshots[0].fromTurn).toBe(1);
    expect(snapshots[1].fromTurn).toBe(2);
    expect(snapshots[2].fromTurn).toBe(3);
  });

  it('consecutive unchanged turns produce single snapshot', () => {
  const turns = [
    { number: 1, trackedItems: { Item: 'value' }, hiddenTrackedItems: null },
    { number: 2, trackedItems: { Item: 'value' }, hiddenTrackedItems: null },
    { number: 3, trackedItems: { Item: 'value' }, hiddenTrackedItems: null },
    { number: 4, trackedItems: { Item: 'value' }, hiddenTrackedItems: null },
  ];

    const snapshots = generateSnapshots(turns);
    expect(snapshots.length).toBe(1);
    expect(snapshots[0]).toEqual({
      fromTurn: 1,
      toTurn: 4,
      trackedItems: { Item: 'value' },
      hiddenTrackedItems: null,
    });
  });

  it('empty array returns empty array', () => {
    const snapshots = generateSnapshots([]);
    expect(snapshots).toEqual([]);
  });

  it('multiple key changes', () => {
  const turns = [
    { number: 1, trackedItems: { A: '1', B: '2' }, hiddenTrackedItems: null },
    { number: 2, trackedItems: { A: '1', B: '3' }, hiddenTrackedItems: null },
  ];

    const snapshots = generateSnapshots(turns);
    expect(snapshots.length).toBe(2);
    expect(snapshots[0]).toEqual({
      fromTurn: 1,
      toTurn: 1,
      trackedItems: { A: '1', B: '2' },
      hiddenTrackedItems: null,
    });
    expect(snapshots[1]).toEqual({
      fromTurn: 2,
      toTurn: 2,
      trackedItems: { A: '1', B: '3' },
      hiddenTrackedItems: null,
    });
  });
});
