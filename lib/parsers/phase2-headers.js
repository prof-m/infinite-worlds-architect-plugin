/**
 * Phase 2: Parse story headers (title, background, character, objective)
 */

import { PATTERNS, parseSkillLine, trimLines } from './utils.js';

/**
 * Parse header metadata from story export
 * @param {string} headerText - Header section text (empty for continuation exports)
 * @param {string} turn1Text - Turn 1 text (contains objective)
 * @returns {{title: string|null, storyBackground: string|null, character: object|null, objective: string|null}}
 */
export function parseHeaders(headerText, turn1Text) {
  const warnings = [];
  let title = null;
  let storyBackground = null;
  let character = null;
  let objective = null;

  // Parse title from header (search in lines to support multiline mode)
  if (headerText) {
    const lines = headerText.split('\n');
    for (const line of lines) {
      const titleMatch = PATTERNS.TITLE.exec(line);
      if (titleMatch) {
        title = titleMatch[1].trim();
        break;
      }
    }

    // Parse Story Background
    storyBackground = extractSection(headerText, '-- Story Background --', warnings);

    // Parse Character section (with subsections)
    character = parseCharacterSection(headerText, warnings);
  }

  // Parse objective from Turn 1
  objective = parseObjective(turn1Text, warnings);

  // Return all fields as nullable
  return {
    title,
    storyBackground,
    character,
    objective,
  };
}

/**
 * Extract a section content between header and next section header
 * @param {string} text - The text to search
 * @param {string} sectionHeader - The section header to find
 * @param {string[]} warnings - Array to collect warning messages
 * @returns {string|null}
 */
function extractSection(text, sectionHeader, warnings) {
  const idx = text.indexOf(sectionHeader);
  if (idx === -1) {
    return null;
  }

  const contentStart = idx + sectionHeader.length;

  // Find next section header (pattern: \n(.+)\n-{4,})
  const remaining = text.substring(contentStart);
  const nextSectionMatch = PATTERNS.SECTION_HEADER.exec(remaining);

  let content;
  if (nextSectionMatch) {
    content = remaining.substring(0, nextSectionMatch.index).trim();
  } else {
    content = remaining.trim();
  }

  // Return null if content is empty
  if (!content || content.length === 0) {
    return null;
  }

  return content;
}

/**
 * Parse the Character section which has subsections: Name, Background, Skills
 * @param {string} text - The header text
 * @param {string[]} warnings - Array to collect warnings
 * @returns {object|null}
 */
function parseCharacterSection(text, warnings) {
  const idx = text.indexOf('-- Character --');
  if (idx === -1) {
    return null;
  }

  const contentStart = idx + '-- Character --'.length;
  const remaining = text.substring(contentStart);

  // For Character section, we want all content until end of text
  // (no next section header like Story Background has)
  const characterContent = remaining.trim();

  // Check if content is empty
  if (!characterContent || characterContent.length === 0) {
    warnings.push('Character section is empty');
    return null;
  }

  const result = {};

  // Parse Name subsection
  const nameContent = extractSubsection(characterContent, 'Name', warnings);
  if (nameContent) {
    result.name = nameContent;
  }

  // Parse Background subsection
  const backgroundContent = extractSubsection(characterContent, 'Background', warnings);
  if (backgroundContent) {
    result.background = backgroundContent;
  }

  // Parse Skills subsection
  const skillsContent = extractSubsection(characterContent, 'Skills', warnings);
  if (skillsContent) {
    result.skills = parseSkillsSubsection(skillsContent, warnings);
  }

  // If character has no data (only empty subsections), return null and warn
  if (Object.keys(result).length === 0) {
    warnings.push('Character section contains only empty subsections');
    return null;
  }

  return result;
}

/**
 * Extract a subsection (Name, Background, Skills) from character content
 * Subsections are marked with pattern: \nHeader\n----
 * @param {string} text - Character content
 * @param {string} subsectionName - Name of subsection to extract
 * @param {string[]} warnings - Array to collect warnings
 * @returns {string|null}
 */
function extractSubsection(text, subsectionName, warnings) {
  // Build pattern to match subsection: subsectionName\n----
  const lines = text.split('\n');
  let foundIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === subsectionName && i + 1 < lines.length && /^-{4,}$/.test(lines[i + 1])) {
      foundIdx = i;
      break;
    }
  }

  if (foundIdx === -1) {
    return null;
  }

  // Content starts after the dashes
  const contentStart = foundIdx + 2;

  // Find next subsection header or end
  let contentEnd = lines.length;
  for (let i = contentStart; i < lines.length; i++) {
    // Check if this is another subsection header (line followed by dashes)
    if (i + 1 < lines.length && /^-{4,}$/.test(lines[i + 1])) {
      contentEnd = i;
      break;
    }
  }

  const subsectionLines = lines.slice(contentStart, contentEnd);
  const content = subsectionLines.map(l => l.trimEnd()).join('\n').trim();

  return content.length > 0 ? content : null;
}

/**
 * Parse skills from the Skills subsection content
 * Skills format: "Skill Name: 5 (Level)"
 * @param {string} skillsContent - The skills section content
 * @param {string[]} warnings - Array to collect warnings
 * @returns {array}
 */
function parseSkillsSubsection(skillsContent, warnings) {
  const skills = [];
  const lines = skillsContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const skill = parseSkillLine(trimmed);
    if (skill) {
      skills.push(skill);
    }
  }

  return skills.length > 0 ? skills : [];
}

/**
 * Extract objective from Turn 1 text
 * Objective is between "- - - - -" dividers and contains "Your objective for this adventure is:"
 * @param {string} turn1Text - Turn 1 content
 * @param {string[]} warnings - Array to collect warnings
 * @returns {string|null}
 */
function parseObjective(turn1Text, warnings) {
  if (!turn1Text) {
    return null;
  }

  // Find the objective divider pattern: - - - - -
  const dividerPattern = /- - - - -/g;
  const matches = [...turn1Text.matchAll(dividerPattern)];

  if (matches.length < 2) {
    // No objective section found
    warnings.push('No objective dividers found in Turn 1');
    return null;
  }

  // Extract text between the two dividers
  const firstDividerEnd = matches[0].index + matches[0][0].length;
  const secondDividerStart = matches[1].index;

  const objectiveText = turn1Text.substring(firstDividerEnd, secondDividerStart).trim();

  // Extract the line containing "Your objective for this adventure is:"
  const lines = objectiveText.split('\n');
  let foundObjective = false;
  const objectiveLines = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('your objective for this adventure is:')) {
      foundObjective = true;
      // Extract text after the colon
      const colonIdx = line.indexOf(':');
      const afterColon = line.substring(colonIdx + 1).trim();
      if (afterColon) {
        objectiveLines.push(afterColon);
      }
    } else if (foundObjective && line.trim()) {
      objectiveLines.push(line.trim());
    }
  }

  if (objectiveLines.length === 0) {
    warnings.push('Could not parse objective text from Turn 1');
    return null;
  }

  return objectiveLines.join(' ').trim();
}
