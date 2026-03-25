#!/usr/bin/env node

const fs = require('fs');

/**
 * Extracts the last turn's summary and state to create a spinoff background.
 */
function parseTurnExport(content) {
  const turns = content.split(/-- Turn \d+ --/);
  const lastTurn = turns[turns.length - 1];
  
  if (!lastTurn) return null;

  // Simple regex-based extraction for spinoff seed
  const outcomeMatch = lastTurn.match(/Outcome\s*\n-+\n([\s\S]*?)(?=\n\n|\n- - - - -)/);
  const objectiveMatch = lastTurn.match(/Your objective for this adventure is:\s*(.*)/);
  const secretMatch = lastTurn.match(/Secret Information\s*\n-+\n([\s\S]*?)(?=\n\n|\nTracked Items)/);

  return {
    lastOutcome: outcomeMatch ? outcomeMatch[1].trim() : "",
    currentObjective: objectiveMatch ? objectiveMatch[1].trim() : "",
    lastSecret: secretMatch ? secretMatch[1].trim() : ""
  };
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node extract_spinoff.cjs <story_export.txt>");
  process.exit(1);
}

try {
  const content = fs.readFileSync(inputPath, 'utf8');
  const spinoffData = parseTurnExport(content);
  
  if (!spinoffData) {
    console.error("Could not parse turns from file.");
    process.exit(1);
  }

  console.log(JSON.stringify(spinoffData, null, 2));
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}
