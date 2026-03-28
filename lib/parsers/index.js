/**
 * Parser orchestrator: coordinates all 4 parsing phases
 */

import { combine } from './phase1-combining.js';
import { parseHeaders } from './phase2-headers.js';
import { parseTurns } from './phase3-turns.js';
import { generateSnapshots } from './phase4-tracked-items.js';

/**
 * Parse story export files into structured data
 * @param {string[]} inputPaths - File paths to parse
 * @param {string} extractionDir - Output directory (unused in parser)
 * @returns {Promise<{phases, manifest, errors, warnings}>}
 */
export async function parse(inputPaths, extractionDir) {
  const errors = [];
  const warnings = [];

  try {
    // Phase 1: Combine files
    const phase1Result = await combine(inputPaths);
    warnings.push(...phase1Result.warnings);

    const { header: headerText, turns: combinedTurns, manifest, combinedContent } = phase1Result;

    // Phase 2: Parse headers
    const turn1 = combinedTurns.find(t => t.number === 1);
    const turn1Content = turn1 ? turn1.content : '';
    const headerData = parseHeaders(headerText, turn1Content);

    // Phase 3: Parse turns
    const parsedTurns = parseTurns(combinedContent, combinedTurns);

    // Phase 4: Generate snapshots
    const snapshots = generateSnapshots(parsedTurns);

    return {
      phases: {
        header: headerData,
        turns: parsedTurns,
        snapshots,
      },
      manifest,
      errors,
      warnings,
    };
  } catch (err) {
    errors.push(err.message);
    throw err;
  }
}
