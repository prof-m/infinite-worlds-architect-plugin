#!/usr/bin/env node

const fs = require('fs');
const crypto = require('crypto');

/**
 * Generates a unique 8-character ID for world entities.
 */
function generateId() {
  return crypto.randomBytes(4).toString('hex');
}

/**
 * Merges components into a final world.json structure.
 */
function compileWorld(config) {
  const world = {
    title: config.title || "New Infinite World",
    description: config.description || "",
    background: config.background || "",
    instructions: config.instructions || "",
    authorStyle: config.authorStyle || "Concise, engaging narrative.",
    firstInput: config.firstInput || "",
    objective: config.objective || "Explore the world.",
    nsfw: !!config.nsfw,
    contentWarnings: config.contentWarnings || "",
    descriptionRequest: config.descriptionRequest || "Write in first person.",
    summaryRequest: config.summaryRequest || "",
    imageModel: config.imageModel || "manticore",
    imageStyle: config.imageStyle || "photo_beautiful",
    skills: config.skills || ["Persuasion", "Observation"],
    possibleCharacters: (config.possibleCharacters || []).map(c => ({
      ...c,
      characterId: c.characterId || generateId(),
      skills: c.skills || { "Persuasion": 3, "Observation": 3 }
    })),
    trackedItems: (config.trackedItems || []).map(i => ({
      ...i,
      id: i.id || generateId(),
      autoUpdate: i.autoUpdate !== undefined ? i.autoUpdate : true
    })),
    triggerEvents: (config.triggerEvents || []).map(t => ({
      ...t,
      id: t.id || generateId()
    })),
    NPCs: (config.NPCs || []).map(n => ({
      ...n,
      id: n.id || generateId()
    })),
    instructionBlocks: (config.instructionBlocks || []).filter(b => !b.keywords || b.keywords.length === 0).map(b => ({
      ...b,
      id: b.id || generateId()
    })),
    loreBookEntries: (config.loreBookEntries || []).concat((config.instructionBlocks || []).filter(b => b.keywords && b.keywords.length > 0)).map(b => ({
      ...b,
      id: b.id || generateId()
    }))
  };

  return JSON.stringify(world, null, 2);
}

// Read from stdin or file argument
const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node generate_world.cjs <config.json>");
  process.exit(1);
}

try {
  const config = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const output = compileWorld(config);
  console.log(output);
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}
