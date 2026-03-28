/**
 * MCP handler for query_story_data tool
 */

/**
 * Query previously extracted story data
 * @param {string} extractionDir - Extraction directory
 * @param {string} category - Data category (manifest, metadata, turn_index, tracked_state, turn_detail)
 * @param {Array} turns - Turns to query (for turn_detail, tracked_state)
 * @returns {Promise<{success, category, data, error}>}
 */
export async function queryStoryData(extractionDir, category, turns) {
  // TODO: implement
  throw new Error('Not implemented');
}
