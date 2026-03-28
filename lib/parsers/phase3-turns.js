/**
 * Phase 3: Parse individual turns (action, outcome, secret info, tracked items)
 */

import { PATTERNS } from './utils.js';
import { parseTrackedItems } from './phase4-tracked-items.js';

/**
 * Parse turn content from combined text
 * @param {string} combinedText - Combined file contents
 * @param {Array} turns - Turns array from Phase 1, each with {number, content, sourceFile, mtime}
 * @param {Array} [warnings] - Warnings array to populate with data integrity issues
 * @returns {Array<{number, action, outcome, secretInfo, trackedItems, hiddenTrackedItems, source, lineRange}>}
 */
export function parseTurns(combinedText, turns, warnings = []) {
  return turns.map(turn => parseSingleTurn(combinedText, turn, warnings));
}

/**
 * Parse a single turn's content
 */
function parseSingleTurn(combinedText, turn, warnings = []) {
  const { number: turnNumber, content: turnContent, sourceFile } = turn;

  // Find line range in combined text
  const lineRange = findLineRange(combinedText, turnContent, turnNumber, warnings);

  // Parse sections from turn content
  const sections = parseTurnSections(turnContent, turnNumber);

  return {
    number: turnNumber,
    action: sections.action,
    outcome: sections.outcome,
    secretInfo: sections.secretInfo,
    trackedItems: sections.trackedItems,
    hiddenTrackedItems: sections.hiddenTrackedItems,
    source: sourceFile,
    lineRange,
  };
}

/**
 * Find the line range (start, end) of turn content in the combined text
 * @param {string} combinedText - Combined file contents
 * @param {string} turnContent - Turn content to locate
 * @param {number} turnNumber - Turn number for warning context
 * @param {Array} warnings - Warnings array to populate
 */
function findLineRange(combinedText, turnContent, turnNumber, warnings = []) {
  const startIdx = combinedText.indexOf(turnContent);
  if (startIdx === -1) {
    warnings.push(`Warning: Could not locate content for Turn ${turnNumber} in combined text`);
    return [0, 0];
  }

  const beforeContent = combinedText.substring(0, startIdx);
  const startLine = beforeContent.split('\n').length;

  const endLine = startLine + turnContent.split('\n').length - 1;

  return [startLine, endLine];
}

/**
 * Parse all sections within a turn (action, outcome, secret info, tracked items)
 */
function parseTurnSections(turnContent, turnNumber) {
  const sections = {
    action: null,
    outcome: null,
    secretInfo: null,
    trackedItems: null,
    hiddenTrackedItems: null,
  };

  // Find all section headers in format: "Header\n----"
  // Pattern matches: a header line followed by at least 4 dashes on the next line
  const sectionRegex = /^([^\n]+)\n-{4,}$/gm;
  const sectionMatches = [];
  let match;

  while ((match = sectionRegex.exec(turnContent)) !== null) {
    sectionMatches.push({
      name: match[1].trim(),
      index: match.index,
      headerEnd: match.index + match[0].length,
    });
  }

  // For each section, extract content until the next section or end of turn
  for (let i = 0; i < sectionMatches.length; i++) {
    const section = sectionMatches[i];
    const nextSection = sectionMatches[i + 1];

    // Extract content from end of header to start of next section (or end of turn)
    const contentStart = section.headerEnd;
    const contentEnd = nextSection ? nextSection.index : turnContent.length;

    let sectionContent = turnContent.substring(contentStart, contentEnd).trim();

    // Empty section: set to null instead of empty string
    if (!sectionContent) {
      sectionContent = null;
    }

    // Map section name to field
    const normalizedName = normalizeSectionName(section.name);
    if (normalizedName === 'action') {
      // Turn 1 special case: action doesn't exist in Turn 1
      if (turnNumber === 1) {
        sections.action = null;
      } else {
        sections.action = sectionContent;
      }
    } else if (normalizedName === 'outcome') {
      sections.outcome = sectionContent;
    } else if (normalizedName === 'secretInfo') {
      sections.secretInfo = sectionContent;
    } else if (normalizedName === 'trackedItems') {
      // Pass to Phase 4 parser
      sections.trackedItems = parseTrackedItems(sectionContent);
    } else if (normalizedName === 'hiddenTrackedItems') {
      // Pass to Phase 4 parser
      sections.hiddenTrackedItems = parseTrackedItems(sectionContent);
    }
  }

  // Special case for Turn 1: if no Action section was found, explicitly set it to null
  if (turnNumber === 1 && sections.action === undefined) {
    sections.action = null;
  }

  return sections;
}

/**
 * Normalize section header name to standard field names
 */
function normalizeSectionName(name) {
  const lower = name.toLowerCase().trim();

  if (lower === 'action') return 'action';
  if (lower === 'outcome') return 'outcome';
  if (lower === 'secret information') return 'secretInfo';
  if (lower === 'tracked items') return 'trackedItems';
  if (lower === 'hidden tracked items') return 'hiddenTrackedItems';

  return null;
}
