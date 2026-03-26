#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Trim whitespace but keep internal formatting.
 */
function clean(text) {
  return text ? text.trim() : "";
}

/**
 * Parse a "-- Turn N --" header and return the turn number.
 */
function parseTurnNumber(header) {
  const m = header.match(/-- Turn (\d+) --/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Split a tracked-items block (Tracked Items or Hidden Tracked Items) into
 * named sub-categories with their values.
 *
 * The format uses category names ending with ":" on their own conceptual line,
 * followed by the value lines.  Sub-categories may themselves contain named
 * entries (e.g., character names with details separated by "|").
 *
 * Returns an object like:
 *   { "Suggestions": "Lilith: ... | ...\n\nMelanie: ...",
 *     "Traits": "Lilith: ...\n\nMelanie: ...",
 *     "Obedient Characters": "Lilith, Melanie" }
 */
function parseTrackedBlock(raw) {
  if (!raw) return {};
  const result = {};
  // Split on lines that look like category headers:  "CategoryName:\n"
  // A category header is a line that ends with ":" and is NOT indented,
  // and the text before ":" doesn't contain "|" (to distinguish from
  // pipe-delimited suggestion entries).
  const lines = raw.split("\n");
  let currentCategory = null;
  let currentLines = [];

  for (const line of lines) {
    // Category header: a line like "Suggestions:" or "Current Date:" or
    // "Obedient Characters:" — basically a short label ending with ":"
    // that doesn't contain "|" and isn't too long.
    const headerMatch = line.match(/^([A-Z][A-Za-z\s''\-]+):(.*)$/);
    if (
      headerMatch &&
      !line.includes("|") &&
      headerMatch[1].length < 50
    ) {
      // Save previous category
      if (currentCategory !== null) {
        result[currentCategory] = clean(currentLines.join("\n"));
      }
      currentCategory = headerMatch[1].trim();
      // The remainder after ":" on the same line is the start of the value
      currentLines = [headerMatch[2]];
    } else {
      currentLines.push(line);
    }
  }
  // Save last category
  if (currentCategory !== null) {
    result[currentCategory] = clean(currentLines.join("\n"));
  }
  return result;
}

/**
 * Extract sections from a single turn's text body.
 * Sections are delimited by headers like "Action\n------", "Outcome\n-------", etc.
 */
function parseTurnSections(body) {
  const sections = {};
  // Match section headers: a line of text followed by a line of dashes
  const sectionRegex = /^(Action|Outcome|Objective|Secret Information|Tracked Items|Hidden Tracked Items)\s*\n-+/gm;
  const sectionNames = [];
  const sectionStarts = [];
  let match;
  while ((match = sectionRegex.exec(body)) !== null) {
    sectionNames.push(match[1]);
    sectionStarts.push(match.index);
  }

  for (let i = 0; i < sectionNames.length; i++) {
    const name = sectionNames[i];
    // Content starts after the header line and dash line
    const headerEnd = body.indexOf("\n", body.indexOf("\n", sectionStarts[i]) + 1);
    const contentEnd = i + 1 < sectionStarts.length ? sectionStarts[i + 1] : body.length;
    sections[name] = clean(body.substring(headerEnd, contentEnd));
  }

  return sections;
}

/**
 * Parse the objective from Turn 1's body text.  The objective may appear:
 * - As a dedicated "Objective\n-------" section
 * - Inline after "- - - - -" markers, prefixed with "Your objective..."
 */
function extractObjective(turnBody) {
  // First try the dedicated section
  const sectionMatch = turnBody.match(
    /Objective\s*\n-+\n([\s\S]*?)(?=\n(?:Secret Information|Tracked Items|Hidden Tracked Items)\s*\n-+|$)/
  );
  if (sectionMatch) return clean(sectionMatch[1]);

  // Try the inline format with "- - - - -" delimiters
  const inlineMatch = turnBody.match(
    /- - - - -\s*\n+(Your objective[^\n]*(?:\n(?!- - - - -).*)*)/
  );
  if (inlineMatch) return clean(inlineMatch[1]);

  // Try just the "Your objective..." line anywhere
  const lineMatch = turnBody.match(/Your objective for this adventure is:\s*(.*)/);
  if (lineMatch) return clean(lineMatch[1]);

  return "";
}

// ---------------------------------------------------------------------------
// Main Parser
// ---------------------------------------------------------------------------

/**
 * Parse a full Infinite Worlds story export into structured data.
 *
 * @param {string} content - Raw text of the export file.
 * @returns {object} Structured parse result.
 */
function parseStoryExport(content) {
  // ---- Header / Title ----
  const titleMatch = content.match(/^==\s*(.+?)\s*==$/m);
  const storyTitle = titleMatch ? titleMatch[1].trim() : "Unknown";

  // ---- Story Background ----
  let storyBackground = "";
  const bgMatch = content.match(
    /-- Story Background --\s*\n([\s\S]*?)(?=\n-- Character --|\n-- Turn \d+ --)/
  );
  if (bgMatch) {
    storyBackground = clean(bgMatch[1]);
  }

  // ---- Character Sheet ----
  const character = { name: "", background: "", skills: {} };
  const charMatch = content.match(
    /-- Character --\s*\n([\s\S]*?)(?=\n-- Turn \d+ --)/
  );
  if (charMatch) {
    const charBlock = charMatch[1];
    const nameMatch = charBlock.match(/Name\s*\n-+\n(.*)/);
    if (nameMatch) character.name = clean(nameMatch[1]);

    const bgCharMatch = charBlock.match(
      /Background\s*\n-+\n([\s\S]*?)(?=\nSkills\s*\n-+|$)/
    );
    if (bgCharMatch) character.background = clean(bgCharMatch[1]);

    const skillsMatch = charBlock.match(/Skills\s*\n-+\n([\s\S]*?)$/);
    if (skillsMatch) {
      const skillLines = skillsMatch[1].trim().split("\n");
      for (const line of skillLines) {
        const sm = line.match(/^(.+?):\s*(\d+)\s*\(([^)]+)\)/);
        if (sm) {
          character.skills[sm[1].trim()] = {
            value: parseInt(sm[2], 10),
            label: sm[3].trim(),
          };
        }
      }
    }
  }

  // ---- Split into turns ----
  // Use a regex that captures the turn header and everything until the next header
  const turnSplitRegex = /^(-- Turn \d+ --)$/gm;
  const turnHeaders = [];
  const turnPositions = [];
  let m;
  while ((m = turnSplitRegex.exec(content)) !== null) {
    turnHeaders.push(m[1]);
    turnPositions.push(m.index);
  }

  const turns = [];
  for (let i = 0; i < turnHeaders.length; i++) {
    const turnNumber = parseTurnNumber(turnHeaders[i]);
    if (turnNumber === null) continue;

    const bodyStart = turnPositions[i] + turnHeaders[i].length;
    const bodyEnd =
      i + 1 < turnPositions.length ? turnPositions[i + 1] : content.length;
    const body = content.substring(bodyStart, bodyEnd);

    const sections = parseTurnSections(body);

    // Extract objective — may be in a dedicated section or inline in outcome (Turn 1)
    let objective = sections["Objective"] || "";
    if (!objective && turnNumber === turns.length + (turnHeaders.length > 0 ? parseTurnNumber(turnHeaders[0]) : 1) || turnNumber === parseTurnNumber(turnHeaders[0])) {
      // For the first turn in the file, also check inline objective
      const inlineObj = extractObjective(body);
      if (inlineObj && !objective) objective = inlineObj;
    }
    // Always try to extract inline objective if section-based one is empty
    if (!objective) {
      objective = extractObjective(body);
    }

    const trackedRaw = sections["Tracked Items"] || "";
    const hiddenRaw = sections["Hidden Tracked Items"] || "";

    turns.push({
      turnNumber,
      action: sections["Action"] || "",
      outcome: sections["Outcome"] || "",
      objective,
      secretInfo: sections["Secret Information"] || "",
      trackedItems: parseTrackedBlock(trackedRaw),
      hiddenTrackedItems: parseTrackedBlock(hiddenRaw),
    });
  }

  // ---- Determine initial objective ----
  let initialObjective = "";
  if (turns.length > 0) {
    initialObjective = turns[0].objective;
  }

  // ---- Determine first turn number (for partial exports) ----
  const firstTurnNumber = turns.length > 0 ? turns[0].turnNumber : 0;
  const lastTurnNumber = turns.length > 0 ? turns[turns.length - 1].turnNumber : 0;

  // ---- Build evolution tracking ----
  const evolution = buildEvolution(turns);

  // ---- Build snapshot ----
  const lastTurn = turns.length > 0 ? turns[turns.length - 1] : null;
  const snapshot = {
    finalTurn: lastTurnNumber,
    lastOutcome: lastTurn ? lastTurn.outcome : "",
    currentObjective: lastTurn ? lastTurn.objective : initialObjective,
    currentSecretInfo: lastTurn ? lastTurn.secretInfo : "",
    finalTrackedItems: lastTurn ? lastTurn.trackedItems : {},
    finalHiddenTrackedItems: lastTurn ? lastTurn.hiddenTrackedItems : {},
    characterState: Object.assign({}, character),
  };

  // Apply skill changes to character state snapshot
  for (const change of evolution.skillChanges) {
    if (snapshot.characterState.skills[change.skill]) {
      snapshot.characterState.skills[change.skill] = {
        value: change.to,
        label: change.toLabel || "",
      };
    }
  }

  return {
    metadata: {
      storyTitle,
      totalTurns: turns.length,
      firstTurn: firstTurnNumber,
      lastTurn: lastTurnNumber,
      isPartialExport: firstTurnNumber > 1,
      parsedAt: new Date().toISOString(),
    },
    initialState: {
      character,
      storyBackground,
      initialObjective,
    },
    turns,
    evolution,
    snapshot,
  };
}

// ---------------------------------------------------------------------------
// Evolution Tracking
// ---------------------------------------------------------------------------

/**
 * Build evolution tracking data from parsed turns.
 */
function buildEvolution(turns) {
  const objectiveChanges = [];
  const trackedItemTimeline = {};
  const hiddenItemTimeline = {};
  const skillChanges = [];

  let prevObjective = "";
  const prevTracked = {};
  const prevHidden = {};

  for (const turn of turns) {
    // Objective changes
    if (turn.objective && turn.objective !== prevObjective && prevObjective !== "") {
      objectiveChanges.push({
        turn: turn.turnNumber,
        from: prevObjective,
        to: turn.objective,
      });
    }
    if (turn.objective) prevObjective = turn.objective;

    // Tracked item evolution
    trackItemChanges(
      turn.trackedItems,
      prevTracked,
      trackedItemTimeline,
      turn.turnNumber
    );

    // Hidden tracked item evolution
    trackItemChanges(
      turn.hiddenTrackedItems,
      prevHidden,
      hiddenItemTimeline,
      turn.turnNumber
    );

    // Skill changes (look for skill references in tracked items)
    detectSkillChanges(turn, skillChanges);
  }

  return {
    objectiveChanges,
    trackedItemTimeline,
    hiddenItemTimeline,
    skillChanges,
  };
}

/**
 * Track changes in a category of tracked items.
 */
function trackItemChanges(currentItems, prevState, timeline, turnNumber) {
  for (const [category, value] of Object.entries(currentItems)) {
    if (!value) continue;

    if (!timeline[category]) {
      timeline[category] = [];
    }

    const prevValue = prevState[category] || "";
    if (value !== prevValue) {
      timeline[category].push({
        turn: turnNumber,
        value,
      });
      prevState[category] = value;
    }
  }
}

/**
 * Detect skill value changes from turn data.
 * Skills can change via the outcome narrative or tracked items.
 */
function detectSkillChanges(turn, skillChanges) {
  // Look for skill change patterns in outcome text
  const skillPatterns = [
    /(\w+(?:\s+\w+)?):\s*(\d+)\s*\(([^)]+)\)\s*(?:->|→|to)\s*(\d+)\s*\(([^)]+)\)/gi,
    /(\w+(?:\s+\w+)?)\s+(?:increased|decreased|changed)\s+(?:from\s+)?(\d+)\s*(?:\([^)]*\))?\s*(?:to)\s*(\d+)\s*(?:\(([^)]+)\))?/gi,
  ];

  for (const pattern of skillPatterns) {
    let m;
    const text = (turn.outcome || "") + "\n" + (turn.secretInfo || "");
    while ((m = pattern.exec(text)) !== null) {
      skillChanges.push({
        turn: turn.turnNumber,
        skill: m[1].trim(),
        from: parseInt(m[2], 10),
        to: parseInt(m[pattern === skillPatterns[0] ? 4 : 3], 10),
        toLabel: m[pattern === skillPatterns[0] ? 5 : 4] || "",
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Snapshot Range
// ---------------------------------------------------------------------------

/**
 * Extract a snapshot for a specific turn range from parsed data.
 */
function getSnapshotRange(parsed, fromTurn, toTurn) {
  const filteredTurns = parsed.turns.filter(
    (t) => t.turnNumber >= fromTurn && t.turnNumber <= toTurn
  );

  if (filteredTurns.length === 0) {
    return {
      error: `No turns found in range ${fromTurn}-${toTurn}`,
      availableRange: {
        first: parsed.metadata.firstTurn,
        last: parsed.metadata.lastTurn,
      },
    };
  }

  const lastTurn = filteredTurns[filteredTurns.length - 1];
  const evolution = buildEvolution(filteredTurns);

  return {
    metadata: {
      storyTitle: parsed.metadata.storyTitle,
      rangeStart: fromTurn,
      rangeEnd: toTurn,
      turnsInRange: filteredTurns.length,
      parsedAt: new Date().toISOString(),
    },
    initialState: parsed.initialState,
    turns: filteredTurns,
    evolution,
    snapshot: {
      finalTurn: lastTurn.turnNumber,
      lastOutcome: lastTurn.outcome,
      currentObjective: lastTurn.objective || parsed.initialState.initialObjective,
      currentSecretInfo: lastTurn.secretInfo,
      finalTrackedItems: lastTurn.trackedItems,
      finalHiddenTrackedItems: lastTurn.hiddenTrackedItems,
    },
  };
}

// ---------------------------------------------------------------------------
// Legacy Output (backwards-compatible)
// ---------------------------------------------------------------------------

/**
 * Produce the original extract_spinoff output format.
 */
function legacyOutput(parsed) {
  const last = parsed.turns.length > 0 ? parsed.turns[parsed.turns.length - 1] : null;
  return {
    lastOutcome: last ? last.outcome : "",
    currentObjective: last
      ? last.objective || parsed.initialState.initialObjective
      : "",
    lastSecret: last ? last.secretInfo : "",
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage() {
  const script = path.basename(process.argv[1] || "extract_spinoff.cjs");
  console.error(`Usage: node ${script} [options] <story_export.txt>

Options:
  --full                Output full structured parse (all turns, evolution, snapshot)
  --snapshot <N-M>      Output a snapshot for turn range N through M
  -o, --output <file>   Write output to file instead of stdout
  -h, --help            Show this help message

Default (no flags): Output legacy spinoff format (lastOutcome, currentObjective, lastSecret)`);
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printUsage();
    process.exit(args.includes("-h") || args.includes("--help") ? 0 : 1);
  }

  let mode = "legacy"; // "legacy" | "full" | "snapshot"
  let snapshotRange = null;
  let outputPath = null;
  let inputPath = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--full") {
      mode = "full";
    } else if (arg === "--snapshot") {
      mode = "snapshot";
      i++;
      if (!args[i]) {
        console.error("Error: --snapshot requires a range argument (e.g., 1-10)");
        process.exit(1);
      }
      const rangeMatch = args[i].match(/^(\d+)-(\d+)$/);
      if (!rangeMatch) {
        console.error(
          "Error: Invalid snapshot range format. Use N-M (e.g., 1-10)"
        );
        process.exit(1);
      }
      snapshotRange = {
        from: parseInt(rangeMatch[1], 10),
        to: parseInt(rangeMatch[2], 10),
      };
    } else if (arg === "-o" || arg === "--output") {
      i++;
      if (!args[i]) {
        console.error("Error: -o/--output requires a file path argument");
        process.exit(1);
      }
      outputPath = args[i];
    } else if (!arg.startsWith("-")) {
      inputPath = arg;
    } else {
      console.error(`Error: Unknown option "${arg}"`);
      printUsage();
      process.exit(1);
    }
  }

  if (!inputPath) {
    console.error("Error: No input file specified.");
    printUsage();
    process.exit(1);
  }

  // Read input
  let content;
  try {
    content = fs.readFileSync(inputPath, "utf8");
  } catch (err) {
    console.error(`Error reading file: ${err.message}`);
    process.exit(1);
  }

  if (!content.trim()) {
    console.error("Error: Input file is empty.");
    process.exit(1);
  }

  // Parse
  const parsed = parseStoryExport(content);

  if (parsed.turns.length === 0) {
    console.error("Error: Could not parse any turns from file.");
    process.exit(1);
  }

  // Produce output based on mode
  let output;
  switch (mode) {
    case "full":
      output = parsed;
      break;
    case "snapshot":
      output = getSnapshotRange(parsed, snapshotRange.from, snapshotRange.to);
      break;
    case "legacy":
    default:
      output = legacyOutput(parsed);
      break;
  }

  const jsonStr = JSON.stringify(output, null, 2);

  // Output
  if (outputPath) {
    try {
      fs.writeFileSync(outputPath, jsonStr, "utf8");
      console.error(`Output written to: ${outputPath}`);
    } catch (err) {
      console.error(`Error writing output file: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.log(jsonStr);
  }
}

main();
