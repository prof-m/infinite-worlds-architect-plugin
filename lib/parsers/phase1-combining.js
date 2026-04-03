/**
 * Phase 1: Combine multiple files, deduplicate turns, resolve headers
 */

import fs from 'fs';
import { getFileMtime, PATTERNS } from './utils.js';

const TURN_MARKER_REGEX = /^-- Turn (\d+) --\r?$/gm;

function extractTurnsFromContent(content) {
  const turnMarkers = Array.from(content.matchAll(TURN_MARKER_REGEX));

  return turnMarkers.map((marker, index) => {
    const markerIndex = marker.index ?? 0;
    let contentStart = markerIndex + marker[0].length;

    if (content[contentStart] === '\n') {
      contentStart += 1;
    }

    const contentEnd = index + 1 < turnMarkers.length
      ? turnMarkers[index + 1].index
      : content.length;

    return {
      number: parseInt(marker[1], 10),
      content: content.slice(contentStart, contentEnd).trim(),
    };
  });
}

/**
 * Combine story export files by mtime priority
 * @param {string[]} filePaths - Paths to story export files
 * @returns {Promise<{header, turns, manifest, warnings}>}
 */
export async function combine(filePaths) {
  if (!filePaths || filePaths.length === 0) {
    throw new Error('No input files provided');
  }

  // Read all files with their mtimes
  const fileData = filePaths.map((filePath, index) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const mtime = getFileMtime(filePath);
    return { filePath, content, mtime, origIndex: index };
  });

  // Sort by mtime ascending (oldest first)
  fileData.sort((a, b) => {
    if (a.mtime === b.mtime) {
      return a.origIndex - b.origIndex; // Use original index as tiebreaker
    }
    return a.mtime - b.mtime;
  });

  // Combine all content
  const combinedContent = fileData.map(f => f.content).join('\n');

  // Extract header from newest file (last in sorted order)
  const newestFile = fileData[fileData.length - 1];
  const turn1Index = combinedContent.indexOf('-- Turn 1 --');
  const header = turn1Index !== -1 ? combinedContent.slice(0, turn1Index).trim() : '';

  // Extract turns from each file separately to properly track source
  const turnsMap = new Map(); // Map<turnNumber, turn>
  const seenTurns = new Map(); // Map<turnNumber, { filePath, mtime }>

  // Process each file in order, then by mtime
  for (const file of fileData) {
    const extractedTurns = extractTurnsFromContent(file.content);

    for (const turn of extractedTurns) {
      const turnNum = turn.number;
      const turnContent = turn.content;
      const sourceFile = file.filePath;
      const mtime = file.mtime;

      // Keep turn from file with latest mtime (or first file if tied)
      if (!seenTurns.has(turnNum) || mtime > seenTurns.get(turnNum).mtime) {
        turnsMap.set(turnNum, { number: turnNum, content: turnContent.trim(), sourceFile, mtime });
        seenTurns.set(turnNum, { filePath: sourceFile, mtime });
      }
    }
  }

  if (turnsMap.size === 0 || !turnsMap.has(1)) {
    throw new Error('No Turn 1 found; extraction failed');
  }

  // Sort turns by turn number
  const turns = Array.from(turnsMap.values()).sort((a, b) => a.number - b.number);

  // Detect gaps in turn numbers
  const gaps = [];
  for (let i = 1; i < turns.length; i++) {
    const prev = turns[i - 1].number;
    const curr = turns[i].number;
    if (curr - prev > 1) {
      gaps.push(`Turns ${prev + 1}-${curr - 1} missing`);
    }
  }

  // Build manifest
  const manifest = {
    source_files: fileData.map(f => {
      const fileTurns = turns.filter(t => t.sourceFile === f.filePath);
      return {
        path: f.filePath,
        turns: fileTurns.length > 0 ? [fileTurns[0].number, fileTurns[fileTurns.length - 1].number] : null,
        mtime_ms: f.mtime,
      };
    }),
    header_source: newestFile.filePath,
    total_turns: turns.length,
    detected_gaps: gaps,
    deduplication_notes: Array.from(seenTurns.entries())
      .filter(([num, _]) => fileData.some(f => f.content.includes(`-- Turn ${num} --`)))
      .length > 0 ? 'Some turns appeared in multiple files; latest version was kept' : null,
    files: fileData.map(f => f.filePath),
  };

  const warnings = [
    ...gaps.map(g => `Warning: ${g}`),
    ...(!header ? ['Warning: No header section found'] : []),
  ];

  return {
    header,
    turns,
    manifest,
    warnings,
    combinedContent,
  };
}
