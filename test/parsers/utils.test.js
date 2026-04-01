import { describe, it, expect } from '@jest/globals';
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

describe('utils', () => {
  it('PATTERNS.TURN_DELIMITER matches turn headers', () => {
    const header = '-- Turn 1 --';
    const match = PATTERNS.TURN_DELIMITER.exec(header);
    expect(match).toBeTruthy();
    expect(match[1]).toBe('1');

    const header25 = '-- Turn 25 --';
    const match25 = PATTERNS.TURN_DELIMITER.exec(header25);
    expect(match25[1]).toBe('25');
  });

  it('PATTERNS.TITLE matches title headers', () => {
    const title = '== The World is a Stage ==';
    const match = PATTERNS.TITLE.exec(title);
    expect(match).toBeTruthy();
    expect(match[1].trim()).toBe('The World is a Stage');
  });

  it('PATTERNS.SKILL_LINE matches skill definitions', () => {
    const skill = 'Hypnosis: 5 (Exceptional)';
    const match = PATTERNS.SKILL_LINE.exec(skill);
    expect(match).toBeTruthy();
    expect(match[1].trim()).toBe('Hypnosis');
    expect(match[2]).toBe('5');
    expect(match[3].trim()).toBe('Exceptional');
  });

  it('PATTERNS.ITEM_HEADER matches item headers correctly', () => {
    // Correct item headers - no content after colon
    expect(PATTERNS.ITEM_HEADER.test('List of hypnotized characters:')).toBe(true);
    expect(PATTERNS.ITEM_HEADER.test('Gold:')).toBe(true);

    // False positives - should NOT match
    expect(PATTERNS.ITEM_HEADER.test('URL: http://example.com')).toBe(false);
    expect(PATTERNS.ITEM_HEADER.test('Email: user@example.com')).toBe(false);
  });

  it('getFileMtime returns modification time', () => {
    const testFile = './test/parsers/utils.test.js';
    const mtime = getFileMtime(testFile);
    expect(typeof mtime).toBe('number');
    expect(mtime > 0).toBe(true);
  });

  it('getFileMtime throws on missing file', () => {
    expect(() => {
      getFileMtime('./nonexistent-file-xyz.txt');
    }).toThrow(/Cannot stat file/);
  });

  it('extractBetweenMarkers finds text between markers', () => {
    const text = 'Before START content here END after';
    const result = extractBetweenMarkers(text, 'START', 'END');
    expect(result).toBe('content here');
  });

  it('extractBetweenMarkers handles missing markers', () => {
    const text = 'No markers here';
    expect(extractBetweenMarkers(text, 'START', 'END')).toBeNull();
  });

  it('extractBetweenMarkers handles missing end marker', () => {
    const text = 'Before START content continues';
    const result = extractBetweenMarkers(text, 'START', 'END');
    expect(result).toBe('content continues');
  });

  it('trimLines removes trailing spaces from lines', () => {
    const text = 'line1  \nline2   \nline3';
    const result = trimLines(text);
    expect(result).toBe('line1\nline2\nline3');
  });

  it('parseSkillLine parses skill definitions', () => {
    const skill = 'Sleight of Hand: 4 (Highly skilled)';
    const result = parseSkillLine(skill);
    expect(result).toEqual({
      name: 'Sleight of Hand',
      rating: 4,
      level: 'Highly skilled'
    });
  });

  it('parseSkillLine handles leading/trailing whitespace', () => {
    const skill = '  Gadgetry: 4 (Highly skilled)  ';
    const result = parseSkillLine(skill);
    expect(result).toEqual({
      name: 'Gadgetry',
      rating: 4,
      level: 'Highly skilled'
    });
  });

  it('parseSkillLine returns null for non-skill lines', () => {
    expect(parseSkillLine('Not a skill line')).toBeNull();
    expect(parseSkillLine('Regular text here')).toBeNull();
  });

  it('lineCount returns correct number of lines', () => {
    const text = 'line1\nline2\nline3';
    expect(lineCount(text)).toBe(3);
  });

  it('lineCount handles empty string', () => {
    expect(lineCount('')).toBe(1); // Single empty line
  });

  it('withLineNumbers adds line numbers', () => {
    const text = 'first\nsecond\nthird';
    const result = withLineNumbers(text);
    expect(result).toBe('1: first\n2: second\n3: third');
  });

  it('splitOnPattern splits and trims', () => {
    const text = 'part1  ---  part2  ---  part3';
    const result = splitOnPattern(text, '---');
    expect(result).toEqual(['part1', 'part2', 'part3']);
  });
});
