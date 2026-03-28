/**
 * MCP handler for query_story_data tool
 */

import fs from 'fs';
import path from 'path';
import { validateQueryInput } from '../validation.js';

/**
 * Safely read JSON file
 * @param {string} filePath - File path
 * @returns {Promise<Object>}
 */
async function readJsonFile(filePath) {
  const text = await fs.promises.readFile(filePath, 'utf8');
  return JSON.parse(text);
}

/**
 * Query previously extracted story data
 * @param {string} extractionDir - Extraction directory
 * @param {string} category - Data category (manifest, metadata, turn_index, tracked_state, turn_detail)
 * @param {Array} turns - Turns to query (for turn_detail, tracked_state)
 * @returns {Promise<{success, category, data, error}>}
 */
export async function queryStoryData(extractionDir, category, turns) {
  try {
    // Validate inputs
    const validation = validateQueryInput(extractionDir, category, turns);
    if (!validation.valid) {
      return {
        success: false,
        category,
        error: `Input validation failed: ${validation.errors.join('; ')}`,
      };
    }

    // Load manifest to resolve "last" turns
    const manifestPath = path.join(extractionDir, 'manifest.json');
    const manifest = await readJsonFile(manifestPath);
    const totalTurns = manifest.total_turns || 0;

    // Resolve "last" in turns array
    let resolvedTurns = turns || [];
    if (turns && turns.includes('last')) {
      resolvedTurns = turns.map(t => t === 'last' ? totalTurns : t);
    }

    // Handle category-specific queries
    switch (category) {
      case 'manifest': {
        return {
          success: true,
          category,
          data: manifest,
        };
      }

      case 'metadata': {
        const metadataPath = path.join(extractionDir, 'metadata.json');
        const metadata = await readJsonFile(metadataPath);
        return {
          success: true,
          category,
          data: metadata,
        };
      }

      case 'turn_index': {
        const turnIndexPath = path.join(extractionDir, 'turn_index.json');
        const turnIndex = await readJsonFile(turnIndexPath);
        return {
          success: true,
          category,
          data: turnIndex,
        };
      }

      case 'tracked_state': {
        const trackedStatePath = path.join(extractionDir, 'tracked_state.json');
        try {
          const trackedState = await readJsonFile(trackedStatePath);
          // If turns are specified, filter snapshots
          if (resolvedTurns.length > 0) {
            const filteredSnapshots = trackedState.snapshots.filter(snapshot =>
              resolvedTurns.some(turn =>
                turn >= snapshot.from_turn && turn <= snapshot.to_turn
              )
            );
            return {
              success: true,
              category,
              data: { snapshots: filteredSnapshots },
            };
          }
          return {
            success: true,
            category,
            data: trackedState,
          };
        } catch (err) {
          if (err.code === 'ENOENT') {
            return {
              success: false,
              category,
              error: 'No tracked items found in this extraction',
            };
          }
          throw err;
        }
      }

      case 'turn_detail': {
        if (!resolvedTurns || resolvedTurns.length === 0) {
          return {
            success: false,
            category,
            error: 'turn_detail requires turns parameter with at least one turn number',
          };
        }

        const turnIndexPath = path.join(extractionDir, 'turn_index.json');
        const turnIndex = await readJsonFile(turnIndexPath);

        const details = [];
        for (const turnNum of resolvedTurns) {
          const turnEntry = turnIndex.turns.find(t => t.number === turnNum);
          if (!turnEntry) {
            return {
              success: false,
              category,
              error: `Turn ${turnNum} not found in turn_index`,
            };
          }

          // Safety check: prevent path traversal attacks
          const sourceFile = turnEntry.source_file;
          const normalizedSourcePath = path.normalize(sourceFile);
          const normalizedExtractionDir = path.normalize(extractionDir);

          // Verify resolved path stays within extraction directory
          const resolvedPath = path.resolve(normalizedExtractionDir, normalizedSourcePath);
          if (!resolvedPath.startsWith(normalizedExtractionDir)) {
            return {
              success: false,
              category,
              error: `Invalid source file path: ${sourceFile}`,
            };
          }

          // Read source file and extract sections
          let sourceContent = '';
          try {
            sourceContent = await fs.promises.readFile(resolvedPath, 'utf8');
          } catch (err) {
            return {
              success: false,
              category,
              error: `Cannot read source file: ${sourceFile}`,
            };
          }

          // Extract sections for this turn (naive approach: split by turn delimiter)
          const turnPattern = new RegExp(`^-- Turn ${turnNum} --$`, 'm');
          const nextTurnPattern = new RegExp(`^-- Turn \\d+ --$`, 'm');

          const turnStartIndex = sourceContent.search(turnPattern);
          if (turnStartIndex === -1) {
            return {
              success: false,
              category,
              error: `Turn ${turnNum} not found in source file`,
            };
          }

          let turnEndIndex = sourceContent.length;
          const afterTurnStart = sourceContent.indexOf('\n', turnStartIndex) + 1;
          const nextMatch = sourceContent.substring(afterTurnStart).search(nextTurnPattern);
          if (nextMatch !== -1) {
            turnEndIndex = afterTurnStart + nextMatch;
          }

          const turnContent = sourceContent.substring(turnStartIndex, turnEndIndex).trim();

          details.push({
            number: turnNum,
            content: turnContent,
          });
        }

        return {
          success: true,
          category,
          data: { turns: details },
        };
      }

      default: {
        return {
          success: false,
          category,
          error: `Unknown category: ${category}`,
        };
      }
    }
  } catch (err) {
    return {
      success: false,
      category,
      error: err.message,
    };
  }
}
