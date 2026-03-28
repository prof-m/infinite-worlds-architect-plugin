/**
 * Phase 4: Parse tracked items and generate state snapshots
 */

import { PATTERNS } from './utils.js';

/**
 * Parse tracked items from section text
 * @param {string|null} sectionText - Section text
 * @returns {{key: value, ...} | null}
 */
export function parseTrackedItems(sectionText) {
  // If section text is null, empty, or whitespace-only, return null
  if (!sectionText || typeof sectionText !== 'string' || !sectionText.trim()) {
    return null;
  }

  const items = {};
  const lines = sectionText.split('\n');
  let currentKey = null;
  let currentValue = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this is an item header (e.g., "ItemName:" with nothing after colon)
    // Match pattern: line with colon, no content after (only whitespace)
    if (PATTERNS.ITEM_HEADER.test(line)) {
      // Save previous item if we have one
      if (currentKey !== null) {
        // Trim the accumulated value
        const trimmedValue = currentValue.join('\n').trim();
        items[currentKey] = trimmedValue;
      }

      // Extract key by stripping colon
      currentKey = line.replace(/:[\s]*$/, '').trim();
      currentValue = [];
    } else if (currentKey !== null) {
      // We're accumulating value lines for the current item
      // But skip completely empty lines at the beginning of a value
      if (line.trim() || currentValue.length > 0) {
        currentValue.push(line);
      }
    }
  }

  // Don't forget the last item
  if (currentKey !== null) {
    // Trim the accumulated value
    const trimmedValue = currentValue.join('\n').trim();
    items[currentKey] = trimmedValue;
  }

  // Return null if no items were found, otherwise return the items object
  return Object.keys(items).length > 0 ? items : null;
}

/**
 * Generate snapshots from tracked items per turn
 * @param {Array} trackedPerTurn - Array of turns with {trackedItems, hiddenTrackedItems} per turn
 * @returns {Array<{fromTurn, toTurn, trackedItems, hiddenTrackedItems}>}
 */
export function generateSnapshots(trackedPerTurn) {
  if (!trackedPerTurn || trackedPerTurn.length === 0) {
    return [];
  }

  // Sort turns by turn number to ensure we process them in order
  const sortedTurns = [...trackedPerTurn].sort((a, b) => a.number - b.number);

  const snapshots = [];
  let lastChangePoint = sortedTurns[0].number;
  let lastState = {
    tracked: null,
    hidden: null,
  };

  // Helper function to check if two states are equal
  const statesEqual = (state1, state2) => {
    // Both null means equal
    if (state1 === null && state2 === null) {
      return true;
    }

    // One null and one not means different
    if ((state1 === null) !== (state2 === null)) {
      return false;
    }

    // Both are objects, compare keys and values
    const keys1 = Object.keys(state1 || {});
    const keys2 = Object.keys(state2 || {});

    if (keys1.length !== keys2.length) {
      return false;
    }

    return keys1.every(key => state1[key] === state2[key]);
  };

  // Iterate through all turns
  for (let i = 0; i < sortedTurns.length; i++) {
    const turn = sortedTurns[i];
    const currentState = {
      tracked: turn.trackedItems,
      hidden: turn.hiddenTrackedItems,
    };

    // Check if state has changed
    const trackedChanged = !statesEqual(lastState.tracked, currentState.tracked);
    const hiddenChanged = !statesEqual(lastState.hidden, currentState.hidden);

    if (trackedChanged || hiddenChanged) {
      // Emit snapshot for the previous state
      if (i > 0) {
        snapshots.push({
          fromTurn: lastChangePoint,
          toTurn: sortedTurns[i - 1].number,
          trackedItems: lastState.tracked,
          hiddenTrackedItems: lastState.hidden,
        });
      }

      // Update tracking variables
      lastChangePoint = turn.number;
      lastState = currentState;
    }
  }

  // Emit final snapshot
  const maxTurn = sortedTurns[sortedTurns.length - 1].number;
  snapshots.push({
    fromTurn: lastChangePoint,
    toTurn: maxTurn,
    trackedItems: lastState.tracked,
    hiddenTrackedItems: lastState.hidden,
  });

  return snapshots;
}
