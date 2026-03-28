import test from 'node:test';
import assert from 'node:assert';
import { parseHeaders } from '../../lib/parsers/phase2-headers.js';

// Test 1: Real export header parsing (from TheWorldsAStageTurn4.txt format)
test('parseHeaders: real export header with all sections', () => {
  const headerText = `== The World is a Stage ==


-- Story Background --

You were once a respected stage magician, known for your incredible skills in hypnosis, sleight of hand, and captivating stage presence. However, your life took a dark turn when a venue refused to pay you after a performance. Feeling wronged and desperate, you decided to use your talents for more nefarious purposes, embarking on a thrilling life of crime.


-- Character --

Name
----
Victor Ashecroft

Background
----------
A charismatic stage magician nicknamed "the Maestro of Mystery", Victor Ashecroft uses their incredible skills in hypnosis, sleight of hand, and showmanship to commit daring heists and evade capture. Their hypnotic abilities allow him to control the minds of his enemies, turning them into his loyal assistants.

Skills
------
Gadgetry: 4 (Highly skilled)
Hypnosis: 5 (Exceptional)
Stage Presence: 5 (Exceptional)
Escape Artistry: 3 (Competent)
Sleight of Hand: 4 (Highly skilled)`;

  const turn1Text = `Outcome
-------
The theater looms before you...

- - - - -

Your objective for this adventure is: To use your skills in hypnosis, sleight of hand, and stage presence, to execute a series of daring heists.

- - - - -

Secret Information
------------------
Some secret info here.`;

  const result = parseHeaders(headerText, turn1Text);

  assert.strictEqual(result.title, 'The World is a Stage');
  assert.ok(result.storyBackground.includes('stage magician'));
  assert.ok(result.storyBackground.includes('nefarious purposes'));

  assert.ok(result.character);
  assert.strictEqual(result.character.name, 'Victor Ashecroft');
  assert.ok(result.character.background.includes('charismatic'));
  assert.ok(Array.isArray(result.character.skills));
  assert.strictEqual(result.character.skills.length, 5);

  // Check first skill
  assert.strictEqual(result.character.skills[0].name, 'Gadgetry');
  assert.strictEqual(result.character.skills[0].rating, 4);
  assert.strictEqual(result.character.skills[0].level, 'Highly skilled');

  // Check objective
  assert.ok(result.objective.includes('hypnosis'));
  assert.ok(result.objective.includes('daring heists'));
});

// Test 2: Continuation export (no header, only Turn 1 with objective)
test('parseHeaders: continuation export with no header section', () => {
  const headerText = ''; // Empty header for continuation export

  const turn1Text = `Action
------
I approach the enemy carefully.

Outcome
-------
The battle begins...

- - - - -

Your objective for this adventure is: Defeat the dragon and save the kingdom.

- - - - -

Secret Information
------------------
Dragon is weak to ice magic.`;

  const result = parseHeaders(headerText, turn1Text);

  assert.strictEqual(result.title, null);
  assert.strictEqual(result.storyBackground, null);
  assert.strictEqual(result.character, null);

  // Objective should still be parsed
  assert.ok(result.objective);
  assert.ok(result.objective.includes('dragon'));
  assert.ok(result.objective.includes('kingdom'));
});

// Test 3: Missing objective section
test('parseHeaders: missing objective divider in Turn 1', () => {
  const headerText = `== Test Story ==

-- Story Background --
A test story background.

-- Character --

Name
----
Test Character`;

  const turn1Text = `Outcome
-------
Turn 1 outcome text.

Secret Information
------------------
No objective dividers here.`;

  const result = parseHeaders(headerText, turn1Text);

  assert.strictEqual(result.title, 'Test Story');
  assert.ok(result.storyBackground);
  assert.strictEqual(result.objective, null); // No objective found
});

// Test 4: Empty character section (header exists but no content)
test('parseHeaders: empty character section', () => {
  const headerText = `== Test Story ==

-- Story Background --
Background text.

-- Character --


`;

  const turn1Text = `Outcome
-------
Outcome.

- - - - -

Your objective for this adventure is: Test objective.

- - - - -`;

  const result = parseHeaders(headerText, turn1Text);

  assert.strictEqual(result.title, 'Test Story');
  assert.ok(result.storyBackground);
  assert.strictEqual(result.character, null); // Empty character section returns null
  assert.ok(result.objective);
});

// Test 5: Character with skills but no name/background
test('parseHeaders: character with only skills subsection', () => {
  const headerText = `== Magic System ==

-- Story Background --
A magical world.

-- Character --

Skills
------
Pyromancy: 3 (Competent)
Transmutation: 2 (Basic)

`;

  const turn1Text = `Outcome
-------
You cast a spell.

- - - - -

Your objective for this adventure is: Master all magical disciplines.

- - - - -`;

  const result = parseHeaders(headerText, turn1Text);

  assert.ok(result.character);
  assert.strictEqual(result.character.name, undefined); // Not present
  assert.strictEqual(result.character.background, undefined); // Not present
  assert.ok(Array.isArray(result.character.skills));
  assert.strictEqual(result.character.skills.length, 2);
  assert.strictEqual(result.character.skills[0].name, 'Pyromancy');
  assert.strictEqual(result.character.skills[1].rating, 2);
});

// Test 6: Missing story background section
test('parseHeaders: missing story background section', () => {
  const headerText = `== Minimal Story ==

-- Character --

Name
----
Bob

`;

  const turn1Text = `Outcome
-------
Something happens.

- - - - -

Your objective for this adventure is: Survive the day.

- - - - -`;

  const result = parseHeaders(headerText, turn1Text);

  assert.strictEqual(result.title, 'Minimal Story');
  assert.strictEqual(result.storyBackground, null); // No background section
  assert.ok(result.character);
  assert.strictEqual(result.character.name, 'Bob');
  assert.ok(result.objective.includes('Survive'));
});

// Test 7: Objective with multi-line text
test('parseHeaders: objective spanning multiple lines', () => {
  const headerText = '';

  const turn1Text = `Outcome
-------
The scene is set.

- - - - -

Your objective for this adventure is: Gather the five sacred artifacts, unite the scattered kingdoms, and prevent the apocalypse before the moon eclipse.

- - - - -`;

  const result = parseHeaders(headerText, turn1Text);

  assert.ok(result.objective);
  assert.ok(result.objective.includes('sacred artifacts'));
  assert.ok(result.objective.includes('apocalypse'));
  assert.ok(result.objective.includes('eclipse'));
});

// Test 8: Title with special characters and spaces
test('parseHeaders: title with spaces and punctuation', () => {
  const headerText = `==   The Final Battle: A Story of Redemption   ==

-- Story Background --
Epic background.

`;

  const turn1Text = `Outcome
-------
Beginning.

- - - - -

Your objective for this adventure is: Win the final battle.

- - - - -`;

  const result = parseHeaders(headerText, turn1Text);

  assert.strictEqual(result.title, 'The Final Battle: A Story of Redemption');
});

// Test 9: Character section with all three subsections
test('parseHeaders: character with name, background, and multiple skills', () => {
  const headerText = `== Character Test ==

-- Story Background --
Test background.

-- Character --

Name
----
Alice Wonder

Background
----------
A curious adventurer who explores mysterious lands. Her keen intellect and bravery make her a formidable explorer.

Skills
------
Investigation: 4 (Highly skilled)
Climbing: 3 (Competent)
Languages: 5 (Exceptional)
Stealth: 2 (Basic)

`;

  const turn1Text = `Outcome
-------
Alice begins her journey.

- - - - -

Your objective for this adventure is: Find the lost city.

- - - - -`;

  const result = parseHeaders(headerText, turn1Text);

  assert.ok(result.character);
  assert.strictEqual(result.character.name, 'Alice Wonder');
  assert.ok(result.character.background.includes('curious'));
  assert.ok(result.character.background.includes('explorer'));
  assert.strictEqual(result.character.skills.length, 4);

  // Verify all skills parsed correctly
  const skillNames = result.character.skills.map(s => s.name);
  assert.ok(skillNames.includes('Investigation'));
  assert.ok(skillNames.includes('Languages'));
});

// Test 10: Empty input handling
test('parseHeaders: empty header and turn1 text', () => {
  const result = parseHeaders('', '');

  assert.strictEqual(result.title, null);
  assert.strictEqual(result.storyBackground, null);
  assert.strictEqual(result.character, null);
  assert.strictEqual(result.objective, null);
});

// Test 11: Objective case insensitivity for header
test('parseHeaders: objective header with different case', () => {
  const headerText = '';

  const turn1Text = `Outcome
-------
Something.

- - - - -

YOUR OBJECTIVE FOR THIS ADVENTURE IS: Test objective here.

- - - - -`;

  const result = parseHeaders(headerText, turn1Text);

  // Should still match (case insensitive check in implementation)
  assert.ok(result.objective);
});

// Test 12: Whitespace handling in sections
test('parseHeaders: sections with excess whitespace', () => {
  const headerText = `==  Whitespace Test  ==

-- Story Background --

Some background text with

multiple line breaks.


-- Character --

Name
----
Test

`;

  const turn1Text = `Outcome
-------
Test outcome.

- - - - -

Your objective for this adventure is: Whitespace test objective.

- - - - -`;

  const result = parseHeaders(headerText, turn1Text);

  assert.strictEqual(result.title, 'Whitespace Test');
  assert.ok(result.storyBackground.includes('background'));
  assert.ok(result.objective.includes('Whitespace'));
});
