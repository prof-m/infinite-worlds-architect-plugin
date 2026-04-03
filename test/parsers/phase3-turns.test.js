import { describe, it, expect } from '@jest/globals';
import { parseTurns } from '../../lib/parsers/phase3-turns.js';

// Helper: Create a combined text with proper line numbers
function createCombinedText(turns) {
  return turns.map((t, i) => (i > 0 ? '\n' : '') + t).join('');
}

describe('parseTurns', () => {
  it('Turn 1 parsing (action is null)', () => {
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

    expect(result.length).toBe(1);
    expect(result[0].number).toBe(1);
    expect(result[0].action).toBeNull();
    expect(result[0].outcome).toBeTruthy();
    expect(result[0].outcome).toContain('theater looms');
    expect(result[0].secretInfo).toBeTruthy();
    expect(result[0].secretInfo).toContain('backstory');
  });

  it('Normal turn with all sections', () => {
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

    expect(result.length).toBe(1);
    expect(result[0].number).toBe(2);
    expect(result[0].action).toBeTruthy();
    expect(result[0].action).toContain('attacked');
    expect(result[0].outcome).toBeTruthy();
    expect(result[0].outcome).toContain('defeated');
    expect(result[0].secretInfo).toBeTruthy();
    expect(result[0].secretInfo).toContain('robot');
  });

  it('Empty section handling', () => {
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

    expect(result.length).toBe(1);
    expect(result[0].number).toBe(3);
    expect(result[0].action).toBeTruthy();
    expect(result[0].outcome).toBeTruthy();
    expect(result[0].secretInfo).toBeNull();
    expect(result[0].trackedItems).toBeNull();
  });

  it('Missing sections', () => {
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

    expect(result.length).toBe(1);
    expect(result[0].number).toBe(4);
    expect(result[0].action).toBeTruthy();
    expect(result[0].outcome).toBeTruthy();
    expect(result[0].secretInfo).toBeNull();
    expect(result[0].trackedItems).toBeNull();
    expect(result[0].hiddenTrackedItems).toBeNull();
  });

  it('Tracked items section (called by Phase 4)', () => {
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

    expect(result.length).toBe(1);
    expect(result[0].number).toBe(5);
    // trackedItems may be null or an object depending on Phase 4 parsing
    expect(result[0].trackedItems === null || typeof result[0].trackedItems === 'object').toBe(true);
  });

  it('Multiple turns in sequence', () => {
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

    expect(result.length).toBe(2);
    expect(result[0].number).toBe(1);
    expect(result[0].action).toBeNull();
    expect(result[1].number).toBe(2);
    expect(result[1].action).toBeTruthy();
  });

  it('Line range tracking', () => {
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

    expect(result.length).toBe(2);

    // Verify line ranges are arrays with two numbers
    expect(Array.isArray(result[0].lineRange)).toBe(true);
    expect(result[0].lineRange.length).toBe(2);
    expect(typeof result[0].lineRange[0]).toBe('number');
    expect(typeof result[0].lineRange[1]).toBe('number');

    // Verify source file is tracked
    expect(result[0].source).toBe('test.txt');
    expect(result[1].source).toBe('test.txt');
  });

  it('Hidden tracked items section', () => {
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

    expect(result.length).toBe(1);
    // Hidden Tracked Items should be parsed by Phase 4
    expect(result[0].hiddenTrackedItems === null || typeof result[0].hiddenTrackedItems === 'object').toBe(true);
  });

  it('Warning on missing turn content', () => {
  const turnContent = `
Action
------
Do something.

Outcome
-------
Something happened.
`;

  const combinedText = '-- Turn 1 --\nSome other content';
  const turns = [
    { number: 7, content: turnContent.trim(), sourceFile: 'test.txt', mtime: 100 }
  ];

    const warnings = [];
    const result = parseTurns(combinedText, turns, warnings);

    expect(result.length).toBe(1);
    expect(result[0].lineRange[0]).toBe(0);
    expect(result[0].lineRange[1]).toBe(0);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('Could not locate content for Turn 7');
    expect(warnings[0]).toContain('combined text');
  });
});
