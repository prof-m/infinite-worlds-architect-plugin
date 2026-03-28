/**
 * Index character mentions in extracted story data
 */

import fs from 'fs';
import path from 'path';

/**
 * Index characters in the parsed story
 * @param {Array} parsedTurns - Array of parsed turn objects
 * @param {Object} sourceFileData - Map of source file path to file content
 * @param {Array<{name: string, aliases?: string[]}>} characterList - Characters to index
 * @returns {Promise<{characterIndex: Object|null, warnings: string[]}>}
 */
export async function indexCharacters(parsedTurns, sourceFileData, characterList) {
  const warnings = [];

  // Return null if no characters provided
  if (!characterList || characterList.length === 0) {
    return { characterIndex: null, warnings };
  }

  const characterIndex = {
    characters: {},
    indexed_character_count: characterList.length,
    total_mentions: 0,
    incomplete: false, // Set to true if some characters not found
  };

  // Build character map with names and aliases
  const charMap = new Map();
  for (const char of characterList) {
    const charEntry = {
      name: char.name,
      aliases: char.aliases || [],
      mentions: [],
      allNames: [char.name, ...(char.aliases || [])],
    };
    charMap.set(char.name, charEntry);
  }

  // Iterate through turns
  for (const turn of parsedTurns) {
    const turnNumber = turn.number;
    const sourceFile = turn.source;

    // Get file content to find line numbers
    const fileContent = sourceFileData.get(sourceFile);
    if (!fileContent) {
      warnings.push(`Source file not found for turn ${turnNumber}: ${sourceFile}`);
      continue;
    }

    // Build line-by-line mapping from the turn's line range
    // Search for the turn content in the file
    const fileLines = fileContent.split('\n');
    const [startLine, endLine] = turn.lineRange;

    // For each character, find mentions in this turn
    for (const [charName, charEntry] of charMap) {
      const mentionLines = new Set();
      const contexts = [];

      // Search for all names and aliases (case-insensitive word boundaries)
      for (const searchName of charEntry.allNames) {
        for (let lineIdx = startLine - 1; lineIdx < endLine && lineIdx < fileLines.length; lineIdx++) {
          const line = fileLines[lineIdx];
          // Use word boundary matching to avoid false positives
          const regex = new RegExp(`\\b${escapeRegex(searchName)}\\b`, 'gi');
          if (regex.test(line)) {
            mentionLines.add(lineIdx + 1); // 1-indexed line numbers
            contexts.push({
              lineNum: lineIdx + 1,
              content: line.trim().substring(0, 100),
            });
          }
        }
      }

      if (mentionLines.size > 0) {
        const sortedLines = Array.from(mentionLines).sort((a, b) => a - b);

        // Extract brief context (first occurrence)
        const briefContext = contexts.length > 0 ? contexts[0].content : '';

        charEntry.mentions.push({
          turn: turnNumber,
          lines: sortedLines,
          context: briefContext,
        });
      }
    }
  }

  // Build final index structure
  for (const [charName, charEntry] of charMap) {
    const aliases = charEntry.aliases.length > 0 ? charEntry.aliases : undefined;
    characterIndex.characters[charName] = {
      ...(aliases && { aliases }),
      mentions: charEntry.mentions,
    };
    characterIndex.total_mentions += charEntry.mentions.length;
  }

  // Check if all characters had at least one mention
  const charactersWithMentions = Object.values(characterIndex.characters).filter(
    char => char.mentions.length > 0
  ).length;

  if (charactersWithMentions < characterList.length) {
    characterIndex.incomplete = true;
  }

  return { characterIndex, warnings };
}

/**
 * Escape special regex characters
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
