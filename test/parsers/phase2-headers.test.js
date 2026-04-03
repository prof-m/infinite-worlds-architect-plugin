import { describe, it, expect } from '@jest/globals';
import { parseHeaders } from '../../lib/parsers/phase2-headers.js';

describe('parseHeaders', () => {
  it('real export header with all sections', () => {
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

    expect(result.title).toBe('The World is a Stage');
    expect(result.storyBackground).toContain('stage magician');
    expect(result.storyBackground).toContain('nefarious purposes');

    expect(result.character).toBeTruthy();
    expect(result.character.name).toBe('Victor Ashecroft');
    expect(result.character.background).toContain('charismatic');
    expect(Array.isArray(result.character.skills)).toBe(true);
    expect(result.character.skills.length).toBe(5);

    // Check first skill
    expect(result.character.skills[0].name).toBe('Gadgetry');
    expect(result.character.skills[0].rating).toBe(4);
    expect(result.character.skills[0].level).toBe('Highly skilled');

    // Check objective
    expect(result.objective).toContain('hypnosis');
    expect(result.objective).toContain('daring heists');
  });

  it('continuation export with no header section', () => {
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

    expect(result.title).toBeNull();
    expect(result.storyBackground).toBeNull();
    expect(result.character).toBeNull();

    // Objective should still be parsed
    expect(result.objective).toBeTruthy();
    expect(result.objective).toContain('dragon');
    expect(result.objective).toContain('kingdom');
  });

  it('missing objective divider in Turn 1', () => {
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

    expect(result.title).toBe('Test Story');
    expect(result.storyBackground).toBeTruthy();
    expect(result.objective).toBeNull(); // No objective found
  });

  it('empty character section', () => {
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

    expect(result.title).toBe('Test Story');
    expect(result.storyBackground).toBeTruthy();
    expect(result.character).toBeNull(); // Empty character section returns null
    expect(result.objective).toBeTruthy();
  });

  it('character with only skills subsection', () => {
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

    expect(result.character).toBeTruthy();
    expect(result.character.name).toBeUndefined(); // Not present
    expect(result.character.background).toBeUndefined(); // Not present
    expect(Array.isArray(result.character.skills)).toBe(true);
    expect(result.character.skills.length).toBe(2);
    expect(result.character.skills[0].name).toBe('Pyromancy');
    expect(result.character.skills[1].rating).toBe(2);
  });

  it('missing story background section', () => {
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

    expect(result.title).toBe('Minimal Story');
    expect(result.storyBackground).toBeNull(); // No background section
    expect(result.character).toBeTruthy();
    expect(result.character.name).toBe('Bob');
    expect(result.objective).toContain('Survive');
  });

  it('objective spanning multiple lines', () => {
  const headerText = '';

  const turn1Text = `Outcome
-------
The scene is set.

- - - - -

Your objective for this adventure is: Gather the five sacred artifacts, unite the scattered kingdoms, and prevent the apocalypse before the moon eclipse.

- - - - -`;

    const result = parseHeaders(headerText, turn1Text);

    expect(result.objective).toBeTruthy();
    expect(result.objective).toContain('sacred artifacts');
    expect(result.objective).toContain('apocalypse');
    expect(result.objective).toContain('eclipse');
  });

  it('title with spaces and punctuation', () => {
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

    expect(result.title).toBe('The Final Battle: A Story of Redemption');
  });

  it('character with name, background, and multiple skills', () => {
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

    expect(result.character).toBeTruthy();
    expect(result.character.name).toBe('Alice Wonder');
    expect(result.character.background).toContain('curious');
    expect(result.character.background).toContain('explorer');
    expect(result.character.skills.length).toBe(4);

    // Verify all skills parsed correctly
    const skillNames = result.character.skills.map(s => s.name);
    expect(skillNames).toContain('Investigation');
    expect(skillNames).toContain('Languages');
  });

  it('empty header and turn1 text', () => {
    const result = parseHeaders('', '');

    expect(result.title).toBeNull();
    expect(result.storyBackground).toBeNull();
    expect(result.character).toBeNull();
    expect(result.objective).toBeNull();
  });

  it('objective header with different case', () => {
  const headerText = '';

  const turn1Text = `Outcome
-------
Something.

- - - - -

YOUR OBJECTIVE FOR THIS ADVENTURE IS: Test objective here.

- - - - -`;

    const result = parseHeaders(headerText, turn1Text);

    // Should still match (case insensitive check in implementation)
    expect(result.objective).toBeTruthy();
  });

  it('sections with excess whitespace', () => {
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

    expect(result.title).toBe('Whitespace Test');
    expect(result.storyBackground).toContain('background');
    expect(result.objective).toContain('Whitespace');
  });
});
