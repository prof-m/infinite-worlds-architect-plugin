/**
 * Write extracted story data to JSON files
 */

import fs from 'fs';
import path from 'path';

/**
 * Atomically write JSON file
 * @param {string} filePath - Target file path
 * @param {*} data - Data to write
 * @returns {Promise<void>}
 */
async function writeJsonFile(filePath, data) {
  const tmpPath = `${filePath}.tmp`;
  const jsonText = JSON.stringify(data, null, 2);

  await fs.promises.writeFile(tmpPath, jsonText, 'utf8');
  await fs.promises.rename(tmpPath, filePath);
}

/**
 * Write manifest, metadata, turn_index, and tracked_state JSON files
 * @param {string} extractionDir - Output directory
 * @param {Object} parsedHeader - Header data from Phase 2
 * @param {Array} parsedTurns - Turns array from Phase 3
 * @param {Array} snapshots - Tracked state snapshots from Phase 4
 * @param {Object} manifest - Manifest data from Phase 1
 * @returns {Promise<{filesWritten: string[], warnings: string[]}>}
 */
export async function writeOutputFiles(extractionDir, parsedHeader, parsedTurns, snapshots, manifest) {
  const filesWritten = [];
  const warnings = [];

  try {
    // Create extractionDir if missing
    await fs.promises.mkdir(extractionDir, { recursive: true });

    // Build manifest.json
    const hasTrackedItems = parsedTurns.some(turn => turn.trackedItems !== null);
    const hasHiddenTrackedItems = parsedTurns.some(turn => turn.hiddenTrackedItems !== null);

    const manifestData = {
      version: '1.0',
      source_files: manifest.sourceFiles || [],
      header_source: manifest.headerSourceFile || '',
      total_turns: parsedTurns.length,
      has_tracked_items: hasTrackedItems,
      has_hidden_tracked_items: hasHiddenTrackedItems,
      files: manifest.files || [],
    };

    const manifestPath = path.join(extractionDir, 'manifest.json');
    await writeJsonFile(manifestPath, manifestData);
    filesWritten.push('manifest.json');

    // Build metadata.json
    const metadataData = {
      title: parsedHeader.title || null,
      story_background: parsedHeader.storyBackground || null,
      objective: parsedHeader.objective || null,
      character: {
        name: parsedHeader.character?.name || null,
        background: parsedHeader.character?.background || null,
        skills: parsedHeader.character?.skills || [],
      },
      total_turns: parsedTurns.length,
    };

    const metadataPath = path.join(extractionDir, 'metadata.json');
    await writeJsonFile(metadataPath, metadataData);
    filesWritten.push('metadata.json');

    // Build turn_index.json
    const turnIndexData = {
      turns: parsedTurns.map(turn => ({
        number: turn.number,
        has_action: turn.action !== null,
        action_preview: turn.action ? turn.action.substring(0, 100) : null,
        outcome_preview: turn.outcome ? turn.outcome.substring(0, 100) : '',
        has_secret_info: turn.secretInfo !== null,
        has_tracked_items: turn.trackedItems !== null,
        line_range: turn.lineRange || [0, 0],
        source_file: turn.source || '',
      })),
    };

    const turnIndexPath = path.join(extractionDir, 'turn_index.json');
    await writeJsonFile(turnIndexPath, turnIndexData);
    filesWritten.push('turn_index.json');

    // Build tracked_state.json only if tracked items exist
    if (hasTrackedItems || hasHiddenTrackedItems) {
      const trackedStateData = {
        snapshots: snapshots.map(snapshot => ({
          from_turn: snapshot.fromTurn,
          to_turn: snapshot.toTurn,
          tracked_items: snapshot.trackedItems || {},
          hidden_tracked_items: snapshot.hiddenTrackedItems || null,
        })),
      };

      const trackedStatePath = path.join(extractionDir, 'tracked_state.json');
      await writeJsonFile(trackedStatePath, trackedStateData);
      filesWritten.push('tracked_state.json');
    }

    return { filesWritten, warnings };
  } catch (err) {
    throw new Error(`Failed to write output files: ${err.message}`);
  }
}
