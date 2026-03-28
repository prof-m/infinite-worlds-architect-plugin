import test from 'node:test';
import assert from 'node:assert';
import {
  PATTERNS,
  getFileMtime,
  extractBetweenMarkers,
  splitOnPattern,
  trimLines,
  parseSkillLine,
  lineCount,
  withLineNumbers
} from '../../lib/parsers/utils.js';
import fs from 'fs';
import path from 'path';

test('PATTERNS.TURN_DELIMITER matches turn headers', () => {
  const header = '-- Turn 1 --';
  const match = PATTERNS.TURN_DELIMITER.exec(header);
  assert.ok(match, 'Should match turn delimiter');
  assert.strictEqual(match[1], '1', 'Should extract turn number');

  const header25 = '-- Turn 25 --';
  const match25 = PATTERNS.TURN_DELIMITER.exec(header25);
  assert.strictEqual(match25[1], '25', 'Should extract 2-digit turn number');
});

test('PATTERNS.TITLE matches title headers', () => {
  const title = '== The World is a Stage ==';
  const match = PATTERNS.TITLE.exec(title);
  assert.ok(match, 'Should match title');
  assert.strictEqual(match[1].trim(), 'The World is a Stage', 'Should extract title text');
});

test('PATTERNS.SKILL_LINE matches skill definitions', () => {
  const skill = 'Hypnosis: 5 (Exceptional)';
  const match = PATTERNS.SKILL_LINE.exec(skill);
  assert.ok(match, 'Should match skill line');
  assert.strictEqual(match[1].trim(), 'Hypnosis', 'Should extract skill name');
  assert.strictEqual(match[2], '5', 'Should extract rating');
  assert.strictEqual(match[3].trim(), 'Exceptional', 'Should extract level');
});

test('PATTERNS.ITEM_HEADER matches item headers correctly', () => {
  // Correct item headers - no content after colon
  assert.ok(PATTERNS.ITEM_HEADER.test('List of hypnotized characters:'));
  assert.ok(PATTERNS.ITEM_HEADER.test('Gold:'));

  // False positives - should NOT match
  assert.ok(!PATTERNS.ITEM_HEADER.test('URL: http://example.com'), 'Should reject header with content after colon');
  assert.ok(!PATTERNS.ITEM_HEADER.test('Email: user@example.com'), 'Should reject header with content after colon');
});

test('getFileMtime returns modification time', () => {
  const testFile = './test/parsers/utils.test.js';
  const mtime = getFileMtime(testFile);
  assert.ok(typeof mtime === 'number', 'Should return a number');
  assert.ok(mtime > 0, 'Should return positive timestamp');
});

test('getFileMtime throws on missing file', () => {
  assert.throws(() => {
    getFileMtime('./nonexistent-file-xyz.txt');
  }, /Cannot stat file/);
});

test('extractBetweenMarkers finds text between markers', () => {
  const text = 'Before START content here END after';
  const result = extractBetweenMarkers(text, 'START', 'END');
  assert.strictEqual(result, 'content here', 'Should extract text between markers');
});

test('extractBetweenMarkers handles missing markers', () => {
  const text = 'No markers here';
  assert.strictEqual(extractBetweenMarkers(text, 'START', 'END'), null);
});

test('extractBetweenMarkers handles missing end marker', () => {
  const text = 'Before START content continues';
  const result = extractBetweenMarkers(text, 'START', 'END');
  assert.strictEqual(result, 'content continues', 'Should return content to end of text');
});

test('trimLines removes trailing spaces from lines', () => {
  const text = 'line1  \nline2   \nline3';
  const result = trimLines(text);
  assert.strictEqual(result, 'line1\nline2\nline3');
});

test('parseSkillLine parses skill definitions', () => {
  const skill = 'Sleight of Hand: 4 (Highly skilled)';
  const result = parseSkillLine(skill);
  assert.deepStrictEqual(result, {
    name: 'Sleight of Hand',
    rating: 4,
    level: 'Highly skilled'
  });
});

test('parseSkillLine handles leading/trailing whitespace', () => {
  const skill = '  Gadgetry: 4 (Highly skilled)  ';
  const result = parseSkillLine(skill);
  assert.deepStrictEqual(result, {
    name: 'Gadgetry',
    rating: 4,
    level: 'Highly skilled'
  });
});

test('parseSkillLine returns null for non-skill lines', () => {
  assert.strictEqual(parseSkillLine('Not a skill line'), null);
  assert.strictEqual(parseSkillLine('Regular text here'), null);
});

test('lineCount returns correct number of lines', () => {
  const text = 'line1\nline2\nline3';
  assert.strictEqual(lineCount(text), 3);
});

test('lineCount handles empty string', () => {
  assert.strictEqual(lineCount(''), 1); // Single empty line
});

test('withLineNumbers adds line numbers', () => {
  const text = 'first\nsecond\nthird';
  const result = withLineNumbers(text);
  assert.strictEqual(result, '1: first\n2: second\n3: third');
});

test('splitOnPattern splits and trims', () => {
  const text = 'part1  ---  part2  ---  part3';
  const result = splitOnPattern(text, '---');
  assert.deepStrictEqual(result, ['part1', 'part2', 'part3']);
});
