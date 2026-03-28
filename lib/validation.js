/**
 * Input validation for extract_story_data and query_story_data tools
 */

import fs from 'fs';
import path from 'path';

const VALID_CATEGORIES = ['manifest', 'metadata', 'turn_index', 'tracked_state', 'turn_detail'];

/**
 * Validate extract_story_data inputs
 * @param {string[]} inputPaths - File paths
 * @param {string} extractionDir - Output directory
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateExtractInput(inputPaths, extractionDir) {
  const errors = [];

  // Validate inputPaths
  if (!Array.isArray(inputPaths)) {
    errors.push('inputPaths must be an array');
    return { valid: false, errors };
  }

  if (inputPaths.length === 0) {
    errors.push('inputPaths cannot be empty');
    return { valid: false, errors };
  }

  for (const filePath of inputPaths) {
    if (typeof filePath !== 'string') {
      errors.push(`inputPath must be string, got ${typeof filePath}`);
      continue;
    }

    if (filePath.trim() === '') {
      errors.push('inputPath cannot be empty string');
      continue;
    }

    // Check if file exists and is readable
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
    } catch {
      errors.push(`File not readable: ${filePath}`);
    }
  }

  // Validate extractionDir
  if (typeof extractionDir !== 'string') {
    errors.push('extractionDir must be a string');
    return { valid: false, errors };
  }

  if (extractionDir.trim() === '') {
    errors.push('extractionDir cannot be empty string');
    return { valid: false, errors };
  }

  // Check if extractionDir parent exists and is writable
  const parentDir = path.dirname(extractionDir);
  try {
    fs.accessSync(parentDir, fs.constants.W_OK);
  } catch {
    errors.push(`Parent directory not writable: ${parentDir}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate query_story_data inputs
 * @param {string} extractionDir - Extraction directory
 * @param {string} category - Query category
 * @param {Array} turns - Requested turns
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateQueryInput(extractionDir, category, turns) {
  const errors = [];

  // Validate extractionDir
  if (typeof extractionDir !== 'string') {
    errors.push('extractionDir must be a string');
    return { valid: false, errors };
  }

  if (extractionDir.trim() === '') {
    errors.push('extractionDir cannot be empty string');
    return { valid: false, errors };
  }

  // Check if extractionDir exists and is readable
  try {
    fs.accessSync(extractionDir, fs.constants.R_OK);
  } catch {
    errors.push(`Extraction directory not found or not readable: ${extractionDir}`);
  }

  // Validate category
  if (typeof category !== 'string') {
    errors.push('category must be a string');
    return { valid: false, errors };
  }

  if (!VALID_CATEGORIES.includes(category)) {
    errors.push(`Invalid category: ${category}. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }

  // Validate turns parameter if provided
  if (turns !== undefined && turns !== null) {
    if (!Array.isArray(turns)) {
      errors.push('turns must be an array or undefined');
    } else if (turns.length > 0) {
      // Check each turn is a number or "last"
      for (const turn of turns) {
        if (typeof turn !== 'number' && turn !== 'last') {
          errors.push(`Turn must be a number or "last", got ${typeof turn}`);
        } else if (typeof turn === 'number' && turn < 1) {
          errors.push(`Turn numbers must be >= 1, got ${turn}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
