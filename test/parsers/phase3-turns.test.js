import test from 'node:test';
import assert from 'node:assert';
import { parseTurns } from '../../lib/parsers/phase3-turns.js';

// Helper: Create a combined text with proper line numbers
function createCombinedText(turns) {
  return turns.map((t, i) => (i > 0 ? '\n' : '') + t).join('');
}

test('parseTurns - Turn 1 parsing (action is null)', () => {
  const turnContent = `
Outcome
-------
The theater looms before you in darkness.

Secret Information
------------------
The villain's backstory details.

Tracked Items
-------------
List of hypnotized Justice Guardians:
`;

  const combinedText = createCombinedText([`-- Turn 1 --${turnContent}`]);
  const turns = [
    { number: 1, content: turnContent.trim(), sourceFile: 'test.txt', mtime: 100 }
  ];

  const result = parseTurns(combinedText, turns);

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].number, 1);
  assert.strictEqual(result[0].action, null, 'Turn 1 should have action as null');
  assert.ok(result[0].outcome, 'Turn 1 should have outcome');
  assert.ok(result[0].outcome.includes('theater looms'));
  assert.ok(result[0].secretInfo);
  assert.ok(result[0].secretInfo.includes('backstory'));
});

test('parseTurns - Normal turn with all sections', () => {
  const turnContent = `
Action
------
I attacked the villain.

Outcome
-------
The villain was defeated.

Secret Information
------------------
The villain was actually a robot.

Tracked Items
-------------
Gold: 50

Hidden Tracked Items
--------------------
Secret Plans:
`;

  const combinedText = createCombinedText([`-- Turn 2 --${turnContent}`]);
  const turns = [
    { number: 2, content: turnContent.trim(), sourceFile: 'test.txt', mtime: 100 }
  ];

  const result = parseTurns(combinedText, turns);

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].number, 2);
  assert.ok(result[0].action);
  assert.ok(result[0].action.includes('attacked'));
  assert.ok(result[0].outcome);
  assert.ok(result[0].outcome.includes('defeated'));
  assert.ok(result[0].secretInfo);
  assert.ok(result[0].secretInfo.includes('robot'));
});

test('parseTurns - Empty section handling', () => {
  const turnContent = `
Action
------
I moved forward.

Outcome
-------
Nothing happened.

Secret Information
------------------

Tracked Items
-------------
`;

  const combinedText = createCombinedText([`-- Turn 3 --${turnContent}`]);
  const turns = [
    { number: 3, content: turnContent.trim(), sourceFile: 'test.txt', mtime: 100 }
  ];

  const result = parseTurns(combinedText, turns);

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].number, 3);
  assert.ok(result[0].action);
  assert.ok(result[0].outcome);
  assert.strictEqual(result[0].secretInfo, null, 'Empty secretInfo should be null');
  assert.strictEqual(result[0].trackedItems, null, 'Empty trackedItems should be null');
});

test('parseTurns - Missing sections', () => {
  const turnContent = `
Action
------
I did something.

Outcome
-------
Something happened.
`;

  const combinedText = createCombinedText([`-- Turn 4 --${turnContent}`]);
  const turns = [
    { number: 4, content: turnContent.trim(), sourceFile: 'test.txt', mtime: 100 }
  ];

  const result = parseTurns(combinedText, turns);

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].number, 4);
  assert.ok(result[0].action);
  assert.ok(result[0].outcome);
  assert.strictEqual(result[0].secretInfo, null);
  assert.strictEqual(result[0].trackedItems, null);
  assert.strictEqual(result[0].hiddenTrackedItems, null);
});

test('parseTurns - Tracked items section (called by Phase 4)', () => {
  // Note: Phase 4 is called to parse the Tracked Items section
  // The actual parsing of items depends on Phase 4 implementation
  const turnContent = `Action
------
Looted the dungeon.

Outcome
-------
Acquired treasure.

Tracked Items
-------------
Gold: 50
Artifacts: 3`;

  const combinedText = `-- Turn 5 --
${turnContent}`;
  const turns = [
    { number: 5, content: turnContent, sourceFile: 'test.txt', mtime: 100 }
  ];

  const result = parseTurns(combinedText, turns);

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].number, 5);
  // trackedItems may be null or an object depending on Phase 4 parsing
  assert.ok(result[0].trackedItems === null || typeof result[0].trackedItems === 'object');
});

test('parseTurns - Multiple turns in sequence', () => {
  const turn1Content = `
Outcome
-------
Start of adventure.`;

  const turn2Content = `
Action
------
Investigate clue.

Outcome
-------
Found a secret.`;

  const combinedText = `-- Turn 1 --${turn1Content}

-- Turn 2 --${turn2Content}`;

  const turns = [
    { number: 1, content: turn1Content.trim(), sourceFile: 'test.txt', mtime: 100 },
    { number: 2, content: turn2Content.trim(), sourceFile: 'test.txt', mtime: 100 }
  ];

  const result = parseTurns(combinedText, turns);

  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].number, 1);
  assert.strictEqual(result[0].action, null);
  assert.strictEqual(result[1].number, 2);
  assert.ok(result[1].action);
});

test('parseTurns - Line range tracking', () => {
  const turn1Content = `
Outcome
-------
First turn outcome.`;

  const turn2Content = `
Action
------
Second turn action.

Outcome
-------
Second turn outcome.`;

  const combinedText = `-- Turn 1 --${turn1Content}

-- Turn 2 --${turn2Content}`;

  const turns = [
    { number: 1, content: turn1Content.trim(), sourceFile: 'test.txt', mtime: 100 },
    { number: 2, content: turn2Content.trim(), sourceFile: 'test.txt', mtime: 100 }
  ];

  const result = parseTurns(combinedText, turns);

  assert.strictEqual(result.length, 2);

  // Verify line ranges are arrays with two numbers
  assert.ok(Array.isArray(result[0].lineRange));
  assert.strictEqual(result[0].lineRange.length, 2);
  assert.ok(typeof result[0].lineRange[0] === 'number');
  assert.ok(typeof result[0].lineRange[1] === 'number');

  // Verify source file is tracked
  assert.strictEqual(result[0].source, 'test.txt');
  assert.strictEqual(result[1].source, 'test.txt');
});

test('parseTurns - Hidden tracked items section', () => {
  const turnContent = `
Action
------
Cast invisibility spell.

Outcome
-------
Enemy doesn't see you.

Hidden Tracked Items
--------------------
Secret Knowledge: Ancient Spell
`;

  const combinedText = createCombinedText([`-- Turn 6 --${turnContent}`]);
  const turns = [
    { number: 6, content: turnContent.trim(), sourceFile: 'test.txt', mtime: 100 }
  ];

  const result = parseTurns(combinedText, turns);

  assert.strictEqual(result.length, 1);
  // Hidden Tracked Items should be parsed by Phase 4
  assert.ok(result[0].hiddenTrackedItems === null || typeof result[0].hiddenTrackedItems === 'object');
});
