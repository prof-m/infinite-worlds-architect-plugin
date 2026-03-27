import fs from "fs/promises";
import crypto from "crypto";
import path from "path";

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

export function generateId() {
    return crypto.randomBytes(4).toString("hex");
}

export function newUUID() {
    return crypto.randomUUID();
}

export async function readWorld(filePath) {
    try {
        const data = await fs.readFile(filePath, "utf-8");
        return JSON.parse(data);
    } catch (e) {
        return null;
    }
}

export async function writeWorld(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function loadWorld(pathArg) {
    const resolved = path.resolve(pathArg);
    const world = await readWorld(resolved);
    if (!world) throw new Error(`Could not read world JSON file at ${resolved}`);
    return { world, resolvedPath: resolved };
}

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

export function validateSkillValues(skills) {
    if (skills && typeof skills === "object") {
        for (const [skillName, skillValue] of Object.entries(skills)) {
            if (!Number.isInteger(skillValue) || skillValue < 0 || skillValue > 5) {
                throw new Error(`Skill "${skillName}" has invalid value ${skillValue}. Must be an integer between 0 and 5.`);
            }
        }
    }
}

export function validateTrackedItemEnums(dataType, visibility) {
    if (dataType && !VALID_DATA_TYPES.includes(dataType)) {
        throw new Error(`Invalid dataType "${dataType}". Must be one of: ${VALID_DATA_TYPES.join(", ")}.`);
    }
    if (visibility && !VALID_VISIBILITIES.includes(visibility)) {
        throw new Error(`Invalid visibility "${visibility}". Must be one of: ${VALID_VISIBILITIES.join(", ")}.`);
    }
}

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

export function successResponse(text) {
    return { content: [{ type: "text", text }] };
}

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
