/**
 * MCP handler for extract_story_data tool
 */

import { parse } from '../parsers/index.js';
import { writeOutputFiles } from './output-writer.js';
import { validateExtractInput } from '../validation.js';

/**
 * Extract story data from exports and write JSON files
 * @param {string[]} inputPaths - File paths to extract
 * @param {string} extractionDir - Directory to write JSON files
 * @returns {Promise<{success, totalTurns, turnRange, inputFilesProcessed, hasTrackedItems, hasHiddenTrackedItems, filesWritten, warnings}>}
 */
export async function extractStoryData(inputPaths, extractionDir) {
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

    // Write output files
    const writeResult = await writeOutputFiles(
      extractionDir,
      parsedHeader,
      parsedTurns,
      snapshots,
      manifest
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
