/**
 * Shared utilities: regex patterns and helper functions for story parsing
 */

import fs from 'fs';

// Pre-compiled regex patterns
export const PATTERNS = {
  TURN_DELIMITER: /^-- Turn (\d+) --$/m,
  TITLE: /^==\s*(.+?)\s*==$/,
  SECTION_HEADER: /^(.+?)\n-{4,}$/m,
  ITEM_HEADER: /^[^\n:]+:\s*$/m,
  SKILL_LINE: /^(.+?):\s*(\d+)\s*\(([^)]+)\)$/,
  OBJECTIVE_DIVIDER: /- - - - -/,
};

/**
 * Get file modification time in milliseconds
 */
export function getFileMtime(path) {
  try {
    const stats = fs.statSync(path);
    return stats.mtimeMs;
  } catch (err) {
    throw new Error(`Cannot stat file: ${path}`);
  }
}

/**
 * Extract text between start and end markers (inclusive)
 */
export function extractBetweenMarkers(text, start, end) {
  const startIdx = text.indexOf(start);
  if (startIdx === -1) return null;

  const contentStart = startIdx + start.length;
  const endIdx = text.indexOf(end, contentStart);

  if (endIdx === -1) {
    return text.substring(contentStart).trim();
  }

  return text.substring(contentStart, endIdx).trim();
}

/**
 * Split text by pattern, preserving content
 */
export function splitOnPattern(text, pattern) {
  return text.split(pattern).filter(Boolean).map(s => s.trim()).filter(s => s);
}

/**
 * Trim leading and trailing whitespace from each line
 */
export function trimLines(text) {
  return text
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n');
}

/**
 * Parse skill line: "Skill Name: 5 (Expert)"
 * Returns { name, rating, level } or null if no match
 */
export function parseSkillLine(line) {
  const match = PATTERNS.SKILL_LINE.exec(line.trim());
  if (!match) return null;

  return {
    name: match[1].trim(),
    rating: parseInt(match[2], 10),
    level: match[3].trim(),
  };
}

/**
 * Count lines in text
 */
export function lineCount(text) {
  return text.split('\n').length;
}

/**
 * Add line numbers to text for debugging (format: "1: line content")
 */
export function withLineNumbers(text) {
  return text
    .split('\n')
    .map((line, idx) => `${idx + 1}: ${line}`)
    .join('\n');
}
