import { test } from 'node:test';
import assert from 'node:assert';
import { parseTrackedItems, generateSnapshots } from '../../lib/parsers/phase4-tracked-items.js';

test('parseTrackedItems - null input returns null', () => {
  assert.equal(parseTrackedItems(null), null);
});

test('parseTrackedItems - empty string returns null', () => {
  assert.equal(parseTrackedItems(''), null);
});

test('parseTrackedItems - whitespace-only returns null', () => {
  assert.equal(parseTrackedItems('   \n  \t  \n  '), null);
});

test('parseTrackedItems - simple single-line items', () => {
  const text = `Item1:
value1

Item2:
value2`;

  const result = parseTrackedItems(text);
  assert.deepEqual(result, {
    Item1: 'value1',
    Item2: 'value2',
  });
});

test('parseTrackedItems - multi-line item values', () => {
  const text = `Item1:
line1
line2
line3

Item2:
value2`;

  const result = parseTrackedItems(text);
  assert.deepEqual(result, {
    Item1: 'line1\nline2\nline3',
    Item2: 'value2',
  });
});

test('parseTrackedItems - empty item value (header at end)', () => {
  const text = `Item1:
value1

Item2:`;

  const result = parseTrackedItems(text);
  assert.deepEqual(result, {
    Item1: 'value1',
    Item2: '',
  });
});

test('parseTrackedItems - rejects false positives like "URL: http://example.com"', () => {
  const text = `Item1:
value1
MoreText:
somevalue`;

  const result = parseTrackedItems(text);
  // "MoreText:" IS a valid item header (colon with no content after)
  // "Item1:" is a valid header
  // Anything with content after the colon is NOT a header
  assert.deepEqual(result, {
    Item1: 'value1',
    MoreText: 'somevalue',
  });
});

test('parseTrackedItems - non-header lines are included in values', () => {
  const text = `Item1:
value1
URL: http://example.com
MoreText:
somevalue`;

  const result = parseTrackedItems(text);
  // "URL: http://example.com" is NOT a header (has content after colon)
  // So it gets included in Item1's value
  assert.deepEqual(result, {
    Item1: 'value1\nURL: http://example.com',
    MoreText: 'somevalue',
  });
});

test('parseTrackedItems - complex real-world example', () => {
  const text = `ViviDevelopment:
0

VivianPersonality:
Vivian-dominant`;

  const result = parseTrackedItems(text);
  assert.deepEqual(result, {
    ViviDevelopment: '0',
    VivianPersonality: 'Vivian-dominant',
  });
});

test('parseTrackedItems - item with indented continuation lines', () => {
  const text = `Item1:
value part 1
  indented part 2
  indented part 3`;

  const result = parseTrackedItems(text);
  assert.deepEqual(result, {
    Item1: 'value part 1\n  indented part 2\n  indented part 3',
  });
});

test('generateSnapshots - all turns with null tracked items', () => {
  const turns = [
    { number: 1, trackedItems: null, hiddenTrackedItems: null },
    { number: 2, trackedItems: null, hiddenTrackedItems: null },
    { number: 3, trackedItems: null, hiddenTrackedItems: null },
  ];

  const snapshots = generateSnapshots(turns);
  assert.equal(snapshots.length, 1);
  assert.deepEqual(snapshots[0], {
    fromTurn: 1,
    toTurn: 3,
    trackedItems: null,
    hiddenTrackedItems: null,
  });
});

test('generateSnapshots - state change in tracked items', () => {
  const turns = [
    { number: 1, trackedItems: null, hiddenTrackedItems: null },
    { number: 2, trackedItems: null, hiddenTrackedItems: null },
    { number: 3, trackedItems: { Gold: '50' }, hiddenTrackedItems: null },
    { number: 4, trackedItems: { Gold: '50' }, hiddenTrackedItems: null },
  ];

  const snapshots = generateSnapshots(turns);
  assert.equal(snapshots.length, 2);
  assert.deepEqual(snapshots[0], {
    fromTurn: 1,
    toTurn: 2,
    trackedItems: null,
    hiddenTrackedItems: null,
  });
  assert.deepEqual(snapshots[1], {
    fromTurn: 3,
    toTurn: 4,
    trackedItems: { Gold: '50' },
    hiddenTrackedItems: null,
  });
});

test('generateSnapshots - value change in tracked items', () => {
  const turns = [
    { number: 1, trackedItems: { Gold: '50' }, hiddenTrackedItems: null },
    { number: 2, trackedItems: { Gold: '75' }, hiddenTrackedItems: null },
    { number: 3, trackedItems: { Gold: '75' }, hiddenTrackedItems: null },
  ];

  const snapshots = generateSnapshots(turns);
  assert.equal(snapshots.length, 2);
  assert.deepEqual(snapshots[0], {
    fromTurn: 1,
    toTurn: 1,
    trackedItems: { Gold: '50' },
    hiddenTrackedItems: null,
  });
  assert.deepEqual(snapshots[1], {
    fromTurn: 2,
    toTurn: 3,
    trackedItems: { Gold: '75' },
    hiddenTrackedItems: null,
  });
});

test('generateSnapshots - state change in hidden tracked items', () => {
  const turns = [
    { number: 1, trackedItems: null, hiddenTrackedItems: null },
    { number: 2, trackedItems: null, hiddenTrackedItems: { Secret: 'yes' } },
    { number: 3, trackedItems: null, hiddenTrackedItems: { Secret: 'yes' } },
  ];

  const snapshots = generateSnapshots(turns);
  assert.equal(snapshots.length, 2);
  assert.deepEqual(snapshots[0], {
    fromTurn: 1,
    toTurn: 1,
    trackedItems: null,
    hiddenTrackedItems: null,
  });
  assert.deepEqual(snapshots[1], {
    fromTurn: 2,
    toTurn: 3,
    trackedItems: null,
    hiddenTrackedItems: { Secret: 'yes' },
  });
});

test('generateSnapshots - complex multi-state transitions', () => {
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
  assert.equal(snapshots.length, 4);
  assert.deepEqual(snapshots[0], {
    fromTurn: 1,
    toTurn: 2,
    trackedItems: null,
    hiddenTrackedItems: null,
  });
  assert.deepEqual(snapshots[1], {
    fromTurn: 3,
    toTurn: 4,
    trackedItems: { Gold: '50' },
    hiddenTrackedItems: null,
  });
  assert.deepEqual(snapshots[2], {
    fromTurn: 5,
    toTurn: 6,
    trackedItems: { Gold: '75' },
    hiddenTrackedItems: { Secret: 'yes' },
  });
  assert.deepEqual(snapshots[3], {
    fromTurn: 7,
    toTurn: 7,
    trackedItems: null,
    hiddenTrackedItems: null,
  });
});

test('generateSnapshots - every turn falls within exactly one snapshot range', () => {
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
    assert.equal(matching.length, 1, `Turn ${turnNum} should fall in exactly 1 snapshot`);
  }
});

test('generateSnapshots - sorted output', () => {
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
    assert(snapshots[i].fromTurn <= snapshots[i + 1].fromTurn);
  }

  assert.equal(snapshots.length, 3);
  assert.equal(snapshots[0].fromTurn, 1);
  assert.equal(snapshots[1].fromTurn, 2);
  assert.equal(snapshots[2].fromTurn, 3);
});

test('generateSnapshots - consecutive unchanged turns produce single snapshot', () => {
  const turns = [
    { number: 1, trackedItems: { Item: 'value' }, hiddenTrackedItems: null },
    { number: 2, trackedItems: { Item: 'value' }, hiddenTrackedItems: null },
    { number: 3, trackedItems: { Item: 'value' }, hiddenTrackedItems: null },
    { number: 4, trackedItems: { Item: 'value' }, hiddenTrackedItems: null },
  ];

  const snapshots = generateSnapshots(turns);
  assert.equal(snapshots.length, 1);
  assert.deepEqual(snapshots[0], {
    fromTurn: 1,
    toTurn: 4,
    trackedItems: { Item: 'value' },
    hiddenTrackedItems: null,
  });
});

test('generateSnapshots - empty array returns empty array', () => {
  const snapshots = generateSnapshots([]);
  assert.deepEqual(snapshots, []);
});

test('generateSnapshots - multiple key changes', () => {
  const turns = [
    { number: 1, trackedItems: { A: '1', B: '2' }, hiddenTrackedItems: null },
    { number: 2, trackedItems: { A: '1', B: '3' }, hiddenTrackedItems: null },
  ];

  const snapshots = generateSnapshots(turns);
  assert.equal(snapshots.length, 2);
  assert.deepEqual(snapshots[0], {
    fromTurn: 1,
    toTurn: 1,
    trackedItems: { A: '1', B: '2' },
    hiddenTrackedItems: null,
  });
  assert.deepEqual(snapshots[1], {
    fromTurn: 2,
    toTurn: 2,
    trackedItems: { A: '1', B: '3' },
    hiddenTrackedItems: null,
  });
});
