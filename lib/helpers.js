import fs from "fs/promises";
import crypto from "crypto";
import path from "path";

// --- Type Definitions ---

/**
 * @typedef {Object} WorldJSON
 * @property {string} title - World title (required, <100 chars recommended)
 * @property {string} description - World description
 * @property {string} background - Game background and setting
 * @property {string} instructions - Main instructions for the AI
 * @property {string} authorStyle - AI author style preferences
 * @property {string} [firstInput] - Initial player input/prompt
 * @property {string} [objective] - Player objective
 * @property {boolean} [nsfw] - Whether content is NSFW
 * @property {string} [contentWarnings] - Content warnings
 * @property {string} [descriptionRequest] - How to describe the world
 * @property {string} [summaryRequest] - How to summarize events
 * @property {string} [imageModel] - Image generation model
 * @property {string} [imageStyle] - Default image style
 * @property {string} [imageStyleCharacterPre] - Character image style prefix
 * @property {string} [imageStyleCharacterPost] - Character image style postfix
 * @property {string} [imageStyleNonCharacterPre] - Non-character image style prefix
 * @property {string} [imageStyleNonCharacterPost] - Non-character image style postfix
 * @property {string} [victoryCondition] - Condition for victory
 * @property {string} [victoryText] - Text displayed on victory
 * @property {string} [defeatCondition] - Condition for defeat
 * @property {string} [defeatText] - Text displayed on defeat
 * @property {string} [designNotes] - Designer notes
 * @property {boolean} [canChangeCharacterName] - Allow player to change character name
 * @property {boolean} [canChangeCharacterDescription] - Allow player to change character description
 * @property {boolean} [canChangeCharacterSkills] - Allow player to change character skills
 * @property {boolean} [canSelectOtherPortraits] - Allow player to select other portraits
 * @property {boolean} [canCreateNewPortrait] - Allow player to create new portrait
 * @property {boolean} [canChangeTrackedItemsStartingValues] - Allow player to change tracked items
 * @property {boolean} [enableAISpecificInstructionBlocks] - Enable AI-specific instruction blocks
 * @property {string[]} [skills] - Array of available skill names
 * @property {Object[]} [possibleCharacters] - Player character options
 * @property {Object[]} [NPCs] - Non-player characters
 * @property {Object[]} [instructionBlocks] - Extra instruction blocks
 * @property {Object[]} [loreBookEntries] - Keyword-triggered instruction blocks
 * @property {Object[]} [trackedItems] - State tracking items
 * @property {Object[]} [triggerEvents] - Trigger events with conditions and effects
 */

// --- Constants ---

export const VALID_CONDITION_TYPES = [
    'triggerOnEvent', 'triggerOnTurn', 'triggerOnStartOfGame',
    'triggerOnCharacter', 'triggerOnTrackedItem', 'triggerOnRandomChance'
];

export const VALID_EFFECT_TYPES = [
    'scriptedText', 'giveGuidance', 'addSecretInfo', 'changeAdventureBackground',
    'changeInstructions', 'changeInstructionBlock', 'changeAuthorStyle',
    'changeDescriptionInstructions', 'changeObjective', 'changeVictoryCondition',
    'changeDefeatCondition', 'changeFirstAction', 'changeName', 'changeDescription',
    'changeSkill', 'setTrackedItemsValue', 'randomTriggers', 'changeLorebook', 'endsGame'
];

export const VALID_DATA_TYPES = ["text", "number", "xml"];
export const VALID_VISIBILITIES = ["everyone", "ai_only", "player_only", "nobody"];

export const ROOT_FIELDS = [
    'title', 'description', 'background', 'instructions', 'authorStyle',
    'firstInput', 'objective', 'nsfw', 'contentWarnings',
    'descriptionRequest', 'summaryRequest', 'imageModel', 'imageStyle',
    'imageStyleCharacterPre', 'imageStyleCharacterPost',
    'imageStyleNonCharacterPre', 'imageStyleNonCharacterPost',
    'victoryCondition', 'victoryText', 'defeatCondition', 'defeatText',
    'designNotes', 'canChangeCharacterName', 'canChangeCharacterDescription',
    'canChangeCharacterSkills', 'canSelectOtherPortraits',
    'canCreateNewPortrait', 'canChangeTrackedItemsStartingValues',
    'enableAISpecificInstructionBlocks'
];

export const ENTITY_ARRAYS = [
    { key: 'possibleCharacters', label: 'Possible Characters' },
    { key: 'NPCs', label: 'NPCs' },
    { key: 'instructionBlocks', label: 'Instruction Blocks' },
    { key: 'loreBookEntries', label: 'Keyword Blocks' },
    { key: 'trackedItems', label: 'Tracked Items' },
    { key: 'triggerEvents', label: 'Trigger Events' }
];

// --- Utilities ---

/**
 * Generate a random hex ID (8 character string).
 * @returns {string} Random hex ID
 */
export function generateId() {
    return crypto.randomBytes(4).toString("hex");
}

/**
 * Generate a random UUID (v4).
 * @returns {string} Random UUID
 */
export function newUUID() {
    return crypto.randomUUID();
}

/**
 * Read and parse a world JSON file.
 * @param {string} filePath - Absolute path to the world JSON file
 * @returns {Promise<WorldJSON|null>} Parsed world object or null if read fails
 * @throws Does not throw; errors are caught and null is returned instead
 */
export async function readWorld(filePath) {
    try {
        const data = await fs.readFile(filePath, "utf-8");
        return JSON.parse(data);
    } catch (e) {
        return null;
    }
}

/**
 * Write a world object to a JSON file.
 * @param {string} filePath - Absolute path where the file should be written
 * @param {WorldJSON} data - World object to write
 * @returns {Promise<void>}
 */
export async function writeWorld(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Load a world file with error handling.
 * @param {string} pathArg - Path to the world JSON file (relative or absolute)
 * @returns {Promise<{world: WorldJSON, resolvedPath: string}>} Loaded world and resolved path
 * @throws {Error} If file cannot be read
 */
export async function loadWorld(pathArg) {
    const resolved = path.resolve(pathArg);
    const world = await readWorld(resolved);
    if (!world) throw new Error(`Could not read world JSON file at ${resolved}`);
    return { world, resolvedPath: resolved };
}

/**
 * Remove markdown code block delimiters (```).
 * @param {string} content - Content possibly wrapped in code blocks
 * @returns {string} Content with code block markers removed
 */
export function unwrapCodeBlock(content) {
    content = content.trim();
    if (content.startsWith('```') && content.endsWith('```')) {
        const lines = content.split('\n');
        if (lines.length >= 2) {
            return lines.slice(1, -1).join('\n').trim();
        }
    }
    return content;
}

/**
 * Normalize markdown formatting by removing markers (bold, italic, headers, lists).
 * @param {string} content - Content with markdown formatting
 * @returns {string} Plain text content
 */
export function normalizeMarkdown(content) {
    if (!content) return "";
    // 1. Remove bold/italic markers
    let normalized = content.replace(/(\*\*|__)(.*?)\1/g, '$2');
    normalized = normalized.replace(/(\*|_)(.*?)\1/g, '$2');
    // 2. Remove list markers at start of lines, preserving indentation
    normalized = normalized.replace(/^(\s*)[-*+]\s+/gm, '$1');
    // 3. Remove header markers (#) at start of lines inside content
    normalized = normalized.replace(/^#+\s+/gm, '');
    return normalized.trim();
}

/**
 * Validate that all skills have integer values between 0 and 5.
 * @param {Object} skills - Object mapping skill names to values
 * @throws {Error} If any skill value is invalid
 */
export function validateSkillValues(skills) {
    if (skills && typeof skills === "object") {
        for (const [skillName, skillValue] of Object.entries(skills)) {
            if (!Number.isInteger(skillValue) || skillValue < 0 || skillValue > 5) {
                throw new Error(`Skill "${skillName}" has invalid value ${skillValue}. Must be an integer between 0 and 5.`);
            }
        }
    }
}

/**
 * Validate tracked item dataType and visibility against allowed enums.
 * @param {string} dataType - Data type to validate (text, number, xml)
 * @param {string} visibility - Visibility to validate (everyone, ai_only, player_only, nobody)
 * @throws {Error} If either parameter is invalid
 */
export function validateTrackedItemEnums(dataType, visibility) {
    if (dataType && !VALID_DATA_TYPES.includes(dataType)) {
        throw new Error(`Invalid dataType "${dataType}". Must be one of: ${VALID_DATA_TYPES.join(", ")}.`);
    }
    if (visibility && !VALID_VISIBILITIES.includes(visibility)) {
        throw new Error(`Invalid visibility "${visibility}". Must be one of: ${VALID_VISIBILITIES.join(", ")}.`);
    }
}

/**
 * Coerce condition data to the correct type based on condition type.
 * @param {string} type - Trigger condition type
 * @param {*} data - Condition data to coerce
 * @returns {*} Coerced data
 */
export function coerceConditionData(type, data) {
    if (type === 'triggerOnTurn' || type === 'triggerOnRandomChance') {
        return parseInt(data);
    }
    if (type === 'triggerOnStartOfGame') {
        return Boolean(data);
    }
    if (type === 'triggerOnCharacter') {
        if (typeof data === 'string') {
            try { return JSON.parse(data); } catch (e) { return [data]; }
        }
        return data;
    }
    if (type === 'triggerOnTrackedItem') {
        if (typeof data === 'string') {
            try { return JSON.parse(data); } catch (e) { return data; }
        }
        return data;
    }
    return data;
}

/**
 * Create an MCP-compatible success response.
 * @param {string} text - Response text
 * @returns {{content: Array}} MCP response object
 */
export function successResponse(text) {
    return { content: [{ type: "text", text }] };
}

/**
 * Recursively strip all id and characterId fields from an object or array.
 * @param {*} obj - Object, array, or primitive to process
 * @returns {*} Deep copy without id fields
 */
export function stripIds(obj) {
    if (Array.isArray(obj)) return obj.map(stripIds);
    if (obj && typeof obj === 'object') {
        const result = {};
        for (const [key, val] of Object.entries(obj)) {
            if (key === 'id' || key === 'characterId') continue;
            result[key] = stripIds(val);
        }
        return result;
    }
    return obj;
}

export { fs, crypto, path };
