/**
 * MCP handler for extract_story_data tool
 */

import fs from 'fs';
import { parse } from '../parsers/index.js';
import { writeOutputFiles } from './output-writer.js';
import { validateExtractInput } from '../validation.js';
import { indexCharacters } from './character-indexer.js';

/**
 * Extract story data from exports and write JSON files
 * @param {string[]} inputPaths - File paths to extract
 * @param {string} extractionDir - Directory to write JSON files
 * @param {Array<{name: string, aliases?: string[]}>} characterList - Optional list of characters to index
 * @returns {Promise<{success, totalTurns, turnRange, inputFilesProcessed, hasTrackedItems, hasHiddenTrackedItems, filesWritten, warnings}>}
 */
export async function extractStoryData(inputPaths, extractionDir, characterList = null) {
  try {
    // Validate inputs
    const validation = validateExtractInput(inputPaths, extractionDir);
    if (!validation.valid) {
      return {
        success: false,
        error: `Input validation failed: ${validation.errors.join('; ')}`,
      };
    }

    // Parse the files
    const parseResult = await parse(inputPaths, extractionDir);
    const warnings = [...parseResult.warnings];

    const { phases, manifest } = parseResult;
    const { header: parsedHeader, turns: parsedTurns, snapshots } = phases;

    // Index characters if provided
    let characterIndex = null;
    if (characterList && characterList.length > 0) {
      // Build source file data map for character indexing
      const sourceFileData = new Map();
      for (const inputPath of inputPaths) {
        const content = fs.readFileSync(inputPath, 'utf8');
        sourceFileData.set(inputPath, content);
      }

      const indexResult = await indexCharacters(parsedTurns, sourceFileData, characterList);
      characterIndex = indexResult.characterIndex;
      warnings.push(...indexResult.warnings);
    }

    // Write output files
    const writeResult = await writeOutputFiles(
      extractionDir,
      parsedHeader,
      parsedTurns,
      snapshots,
      manifest,
      characterIndex
    );
    warnings.push(...writeResult.warnings);

    // Calculate turn range
    const turnNumbers = parsedTurns.map(t => t.number).sort((a, b) => a - b);
    const turnRange = turnNumbers.length > 0
      ? [turnNumbers[0], turnNumbers[turnNumbers.length - 1]]
      : [0, 0];

    // Check for tracked items
    const hasTrackedItems = parsedTurns.some(turn => turn.trackedItems !== null);
    const hasHiddenTrackedItems = parsedTurns.some(turn => turn.hiddenTrackedItems !== null);

    return {
      success: true,
      totalTurns: parsedTurns.length,
      turnRange,
      inputFilesProcessed: inputPaths.length,
      hasTrackedItems,
      hasHiddenTrackedItems,
      filesWritten: writeResult.filesWritten,
      warnings,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}
