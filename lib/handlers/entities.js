import {
    path, crypto,
    readWorld, writeWorld, generateId,
    coerceConditionData, successResponse,
    validateSkillValues, validateTrackedItemEnums,
    VALID_CONDITION_TYPES, VALID_EFFECT_TYPES
} from "../helpers.js";

/**
 * Add an instruction block or keyword block to an existing world JSON file.
 * @async
 * @param {Object} args - Function arguments
 * @param {string} args.path - Absolute path to the existing world JSON file
 * @param {string} args.name - Name of the block
 * @param {string} args.content - The instruction content
 * @param {string[]} [args.keywords] - Optional array of trigger keywords. If provided, creates a Keyword Block instead of Extra Instruction Block
 * @returns {Promise<{content: Array<{type: string, text: string}>}>} MCP response confirming addition
 */
export async function add_instruction_block(args) {
    const worldPath = path.resolve(args.path);
    const world = await readWorld(worldPath);
    if (!world) throw new Error(`Could not read world JSON file at ${worldPath}`);

    const block = {
        id: generateId(),
        name: args.name,
        content: args.content
    };

    if (args.keywords && args.keywords.length > 0) {
        block.keywords = args.keywords;
        world.loreBookEntries = world.loreBookEntries || [];
        world.loreBookEntries.push(block);
    } else {
        world.instructionBlocks = world.instructionBlocks || [];
        world.instructionBlocks.push(block);
    }

    await writeWorld(worldPath, world);
    return { content: [{ type: "text", text: `Instruction block '${args.name}' added successfully.` }] };
}

/**
 * Add a Player Character to an existing world JSON file.
 * @async
 * @param {Object} args - Function arguments
 * @param {string} args.path - Absolute path to the existing world JSON file
 * @param {string} args.name - Name of the character (required)
 * @param {string} [args.characterId] - Optional existing character ID to preserve. If omitted, a new unique ID is generated
 * @param {string} [args.description] - Character description
 * @param {string} [args.portrait] - Portrait identifier or URL
 * @param {Object} [args.skills] - Object mapping skill names to integer values 0-5
 * @returns {Promise<{content: Array<{type: string, text: string}>}>} MCP response confirming addition
 */
export async function add_character(args) {
    const worldPath = path.resolve(args.path);
    const world = await readWorld(worldPath);
    if (!world) throw new Error(`Could not read world JSON file at ${worldPath}`);
    if (!args.name) throw new Error("Required field 'name' is missing.");

    validateSkillValues(args.skills);

    const character = {
        characterId: args.characterId || generateId(),
        name: args.name
    };
    if (args.description !== undefined) character.description = args.description;
    if (args.portrait !== undefined) character.portrait = args.portrait;
    if (args.skills !== undefined) character.skills = args.skills;

    world.possibleCharacters = world.possibleCharacters || [];
    world.possibleCharacters.push(character);

    await writeWorld(worldPath, world);
    return { content: [{ type: "text", text: `Character '${args.name}' (ID: ${character.characterId}) added successfully.` }] };
}

/**
 * Add an NPC (Other Character) to an existing world JSON file.
 * @async
 * @param {Object} args - Function arguments
 * @param {string} args.path - Absolute path to the existing world JSON file
 * @param {string} args.name - Name of the NPC (required)
 * @param {string} [args.id] - Optional existing NPC ID to preserve. If omitted, a new unique ID is generated
 * @param {string} [args.detail] - Detailed character description
 * @param {string} [args.one_liner] - Brief one-line summary of the NPC
 * @param {string} [args.appearance] - Physical appearance description
 * @param {string} [args.location] - Where the NPC can be found
 * @param {string} [args.secret_info] - Hidden information only the AI knows
 * @param {string[]} [args.names] - Full list of names/aliases for the NPC
 * @param {string} [args.img_appearance] - Image generation appearance prompt
 * @param {string} [args.img_clothing] - Image generation clothing prompt
 * @returns {Promise<{content: Array<{type: string, text: string}>}>} MCP response confirming addition
 */
export async function add_npc(args) {
    const worldPath = path.resolve(args.path);
    const world = await readWorld(worldPath);
    if (!world) throw new Error(`Could not read world JSON file at ${worldPath}`);
    if (!args.name) throw new Error("Required field 'name' is missing.");

    const npc = {
        id: args.id || generateId(),
        name: args.name
    };
    if (args.detail !== undefined) npc.detail = args.detail;
    if (args.one_liner !== undefined) npc.one_liner = args.one_liner;
    if (args.appearance !== undefined) npc.appearance = args.appearance;
    if (args.location !== undefined) npc.location = args.location;
    if (args.secret_info !== undefined) npc.secret_info = args.secret_info;
    if (args.names !== undefined) npc.names = args.names;
    if (args.img_appearance !== undefined) npc.img_appearance = args.img_appearance;
    if (args.img_clothing !== undefined) npc.img_clothing = args.img_clothing;

    world.NPCs = world.NPCs || [];
    world.NPCs.push(npc);

    await writeWorld(worldPath, world);
    return { content: [{ type: "text", text: `NPC '${args.name}' (ID: ${npc.id}) added successfully.` }] };
}

/**
 * Add a Tracked Item to an existing world JSON file.
 * @async
 * @param {Object} args - Function arguments
 * @param {string} args.path - Absolute path to the existing world JSON file
 * @param {string} args.name - Name of the tracked item (required)
 * @param {string} [args.id] - Optional existing tracked item ID to preserve. If omitted, a new unique ID is generated
 * @param {string} [args.dataType] - Data type of the tracked item. One of: "text", "number", "xml". Default: "text"
 * @param {string} [args.visibility] - Visibility of the tracked item. One of: "everyone", "ai_only", "player_only", "nobody". Default: "everyone"
 * @param {string} [args.description] - Description of what this item tracks
 * @param {string} [args.updateInstructions] - Instructions for the AI on how to update this item
 * @param {string} [args.initialValue] - Starting value for the tracked item
 * @returns {Promise<{content: Array<{type: string, text: string}>}>} MCP response confirming addition
 */
export async function add_tracked_item(args) {
    const worldPath = path.resolve(args.path);
    const world = await readWorld(worldPath);
    if (!world) throw new Error(`Could not read world JSON file at ${worldPath}`);
    if (!args.name) throw new Error("Required field 'name' is missing.");

    const dataType = args.dataType || "text";
    const visibility = args.visibility || "everyone";

    validateTrackedItemEnums(dataType, visibility);

    const item = {
        id: args.id || generateId(),
        name: args.name,
        dataType: dataType,
        visibility: visibility
    };
    if (args.description !== undefined) item.description = args.description;
    if (args.updateInstructions !== undefined) item.updateInstructions = args.updateInstructions;
    if (args.initialValue !== undefined) item.initialValue = args.initialValue;

    world.trackedItems = world.trackedItems || [];
    world.trackedItems.push(item);

    await writeWorld(worldPath, world);
    return { content: [{ type: "text", text: `Tracked item '${args.name}' (ID: ${item.id}) added successfully.` }] };
}

/**
 * Add a Trigger Event to a world JSON file.
 * @async
 * @param {Object} args - Function arguments
 * @param {string} args.path - Absolute path to the existing world JSON file
 * @param {string} args.name - Name of the trigger (required)
 * @param {Array<{type: string, data: *}>} [args.conditions] - Array of trigger conditions (AND logic — all must be met)
 * @param {Array<{type: string, data: *}>} [args.effects] - Array of trigger effects (all execute when conditions are met)
 * @param {boolean} [args.canTriggerMoreThanOnce] - If true, trigger can fire every eligible turn. Default: false
 * @param {string[]} [args.prerequisites] - Trigger IDs that must have fired previously
 * @param {string[]} [args.blockers] - Trigger IDs that prevent this trigger from firing
 * @param {string} [args.conditionType] - LEGACY: Single condition type. Use 'conditions' array instead
 * @param {*} [args.conditionData] - LEGACY: Single condition data. Use 'conditions' array instead
 * @param {string} [args.effectType] - LEGACY: Single effect type. Use 'effects' array instead
 * @param {*} [args.effectData] - LEGACY: Single effect data. Use 'effects' array instead
 * @returns {Promise<{content: Array<{type: string, text: string}>}>} MCP response confirming addition
 */
export async function add_trigger(args) {
    const worldPath = path.resolve(args.path);
    const world = await readWorld(worldPath);
    if (!world) throw new Error(`Could not read world JSON file at ${worldPath}`);

    // Build conditions: prefer new array format, fallback to legacy single params
    const conditions = args.conditions
        ? args.conditions
        : (args.conditionType && args.conditionData !== undefined)
            ? [{ type: args.conditionType, data: args.conditionData }]
            : [];

    // Build effects: prefer new array format, fallback to legacy single params
    const effects = args.effects
        ? args.effects
        : (args.effectType && args.effectData !== undefined)
            ? [{ type: args.effectType, data: args.effectData }]
            : [];

    // Require at least 1 condition and 1 effect
    if (conditions.length === 0) {
        throw new Error("At least one condition is required. Provide a 'conditions' array or legacy 'conditionType'/'conditionData' parameters.");
    }
    if (effects.length === 0) {
        throw new Error("At least one effect is required. Provide an 'effects' array or legacy 'effectType'/'effectData' parameters.");
    }

    // Validate condition types
    const invalidConditions = conditions.filter(c => !VALID_CONDITION_TYPES.includes(c.type)).map(c => c.type);
    if (invalidConditions.length > 0) {
        throw new Error(`Invalid condition type(s): ${invalidConditions.join(', ')}. Valid types: ${VALID_CONDITION_TYPES.join(', ')}`);
    }

    // Validate effect types
    const invalidEffects = effects.filter(e => !VALID_EFFECT_TYPES.includes(e.type)).map(e => e.type);
    if (invalidEffects.length > 0) {
        throw new Error(`Invalid effect type(s): ${invalidEffects.join(', ')}. Valid types: ${VALID_EFFECT_TYPES.join(', ')}`);
    }

    // Build the trigger object
    const trigger = {
        id: generateId(),
        name: args.name,
        triggerConditions: conditions.map(c => ({
            id: crypto.randomUUID(),
            type: c.type,
            data: coerceConditionData(c.type, c.data),
            category: "condition"
        })),
        triggerEffects: effects.map(e => ({
            id: crypto.randomUUID(),
            type: e.type,
            data: e.data
        }))
    };

    // Add optional meta-fields
    if (args.canTriggerMoreThanOnce !== undefined) {
        trigger.canTriggerMoreThanOnce = args.canTriggerMoreThanOnce;
    }
    if (args.prerequisites && args.prerequisites.length > 0) {
        trigger.prerequisites = args.prerequisites;
    }
    if (args.blockers && args.blockers.length > 0) {
        trigger.blockers = args.blockers;
    }

    world.triggerEvents = world.triggerEvents || [];
    world.triggerEvents.push(trigger);

    await writeWorld(worldPath, world);

    // Build summary
    const conditionTypes = conditions.map(c => c.type).join(', ');
    const effectTypes = effects.map(e => e.type).join(', ');
    const metaParts = [];
    if (trigger.canTriggerMoreThanOnce) metaParts.push('repeatable');
    if (trigger.prerequisites) metaParts.push(`prerequisites: ${trigger.prerequisites.join(', ')}`);
    if (trigger.blockers) metaParts.push(`blockers: ${trigger.blockers.join(', ')}`);
    const metaStr = metaParts.length > 0 ? ` | Meta: ${metaParts.join('; ')}` : '';

    return { content: [{ type: "text", text: `Trigger '${args.name}' added successfully. Conditions (${conditions.length}): ${conditionTypes}. Effects (${effects.length}): ${effectTypes}.${metaStr}` }] };
}

/**
 * Modify an existing Player Character in a world JSON file by name.
 * @async
 * @param {Object} args - Function arguments
 * @param {string} args.path - Absolute path to the existing world JSON file
 * @param {string} args.name - Name of the character to find and modify (required)
 * @param {string} [args.description] - New character description
 * @param {string} [args.portrait] - New portrait identifier or URL
 * @param {Object} [args.skills] - Object mapping skill names to integer values 0-5. Replaces existing skills entirely
 * @returns {Promise<{content: Array<{type: string, text: string}>}>} MCP response confirming modification
 */
export async function modify_character(args) {
    const worldPath = path.resolve(args.path);
    const world = await readWorld(worldPath);
    if (!world) throw new Error(`Could not read world JSON file at ${worldPath}`);
    if (!args.name) throw new Error("Required field 'name' is missing.");

    world.possibleCharacters = world.possibleCharacters || [];
    const character = world.possibleCharacters.find(c => c.name === args.name);
    if (!character) {
        const available = world.possibleCharacters.map(c => c.name).join(', ') || '(none)';
        throw new Error(`Character "${args.name}" not found. Available characters: ${available}`);
    }

    if (args.skills !== undefined) validateSkillValues(args.skills);

    if (args.description !== undefined) character.description = args.description;
    if (args.portrait !== undefined) character.portrait = args.portrait;
    if (args.skills !== undefined) character.skills = args.skills;

    await writeWorld(worldPath, world);
    return { content: [{ type: "text", text: `Character '${args.name}' modified successfully.` }] };
}

/**
 * Modify an existing NPC (Other Character) in a world JSON file by name.
 * @async
 * @param {Object} args - Function arguments
 * @param {string} args.path - Absolute path to the existing world JSON file
 * @param {string} args.name - Name of the NPC to find and modify (required)
 * @param {string} [args.detail] - New detailed character description
 * @param {string} [args.one_liner] - New brief one-line summary
 * @param {string} [args.appearance] - New physical appearance description
 * @param {string} [args.location] - New location
 * @param {string} [args.secret_info] - New hidden information
 * @param {string[]} [args.names] - New full list of names/aliases
 * @param {string} [args.img_appearance] - New image generation appearance prompt
 * @param {string} [args.img_clothing] - New image generation clothing prompt
 * @returns {Promise<{content: Array<{type: string, text: string}>}>} MCP response confirming modification
 */
export async function modify_npc(args) {
    const worldPath = path.resolve(args.path);
    const world = await readWorld(worldPath);
    if (!world) throw new Error(`Could not read world JSON file at ${worldPath}`);
    if (!args.name) throw new Error("Required field 'name' is missing.");

    world.NPCs = world.NPCs || [];
    const npc = world.NPCs.find(n => n.name === args.name);
    if (!npc) {
        const available = world.NPCs.map(n => n.name).join(', ') || '(none)';
        throw new Error(`NPC "${args.name}" not found. Available NPCs: ${available}`);
    }

    if (args.detail !== undefined) npc.detail = args.detail;
    if (args.one_liner !== undefined) npc.one_liner = args.one_liner;
    if (args.appearance !== undefined) npc.appearance = args.appearance;
    if (args.location !== undefined) npc.location = args.location;
    if (args.secret_info !== undefined) npc.secret_info = args.secret_info;
    if (args.names !== undefined) npc.names = args.names;
    if (args.img_appearance !== undefined) npc.img_appearance = args.img_appearance;
    if (args.img_clothing !== undefined) npc.img_clothing = args.img_clothing;

    await writeWorld(worldPath, world);
    return { content: [{ type: "text", text: `NPC '${args.name}' modified successfully.` }] };
}

/**
 * Modify an existing Tracked Item in a world JSON file by name.
 * @async
 * @param {Object} args - Function arguments
 * @param {string} args.path - Absolute path to the existing world JSON file
 * @param {string} args.name - Name of the tracked item to find and modify (required)
 * @param {string} [args.dataType] - New data type. One of: "text", "number", "xml"
 * @param {string} [args.visibility] - New visibility. One of: "everyone", "ai_only", "player_only", "nobody"
 * @param {string} [args.description] - New description
 * @param {string} [args.updateInstructions] - New update instructions
 * @param {string} [args.initialValue] - New initial value
 * @returns {Promise<{content: Array<{type: string, text: string}>}>} MCP response confirming modification
 */
export async function modify_tracked_item(args) {
    const worldPath = path.resolve(args.path);
    const world = await readWorld(worldPath);
    if (!world) throw new Error(`Could not read world JSON file at ${worldPath}`);
    if (!args.name) throw new Error("Required field 'name' is missing.");

    world.trackedItems = world.trackedItems || [];
    const item = world.trackedItems.find(i => i.name === args.name);
    if (!item) {
        const available = world.trackedItems.map(i => i.name).join(', ') || '(none)';
        throw new Error(`Tracked item "${args.name}" not found. Available tracked items: ${available}`);
    }

    validateTrackedItemEnums(args.dataType, args.visibility);

    if (args.dataType !== undefined) item.dataType = args.dataType;
    if (args.visibility !== undefined) item.visibility = args.visibility;
    if (args.description !== undefined) item.description = args.description;
    if (args.updateInstructions !== undefined) item.updateInstructions = args.updateInstructions;
    if (args.initialValue !== undefined) item.initialValue = args.initialValue;

    await writeWorld(worldPath, world);
    return { content: [{ type: "text", text: `Tracked item '${args.name}' modified successfully.` }] };
}

/**
 * Modify an existing Trigger Event in a world JSON file by name.
 * @async
 * @param {Object} args - Function arguments
 * @param {string} args.path - Absolute path to the world JSON file
 * @param {string} args.name - Name of the trigger event to modify (required)
 * @param {string} [args.newName] - Optional new name for the trigger
 * @param {Array<{type: string, data: *}>} [args.conditions] - Optional array to replace all trigger conditions
 * @param {Array<{type: string, data: *}>} [args.effects] - Optional array to replace all trigger effects
 * @param {boolean} [args.canTriggerMoreThanOnce] - Optional update to repeat-firing control
 * @param {string[]} [args.prerequisites] - Optional array to update prerequisite trigger IDs
 * @param {string[]} [args.blockers] - Optional array to update blocker trigger IDs
 * @returns {Promise<{content: Array<{type: string, text: string}>}>} MCP response confirming modification
 */
export async function modify_trigger_event(args) {
    const worldPath = path.resolve(args.path);
    const world = await readWorld(worldPath);
    if (!world) throw new Error(`Could not read world JSON file at ${worldPath}`);
    if (!args.name) throw new Error("Required field 'name' is missing.");

    world.triggerEvents = world.triggerEvents || [];
    const trigger = world.triggerEvents.find(t => t.name === args.name);
    if (!trigger) {
        const available = world.triggerEvents.map(t => t.name).join(', ') || '(none)';
        throw new Error(`Trigger event "${args.name}" not found. Available trigger events: ${available}`);
    }

    if (args.newName !== undefined) trigger.name = args.newName;

    if (args.conditions !== undefined) {
        const invalidConditions = args.conditions.filter(c => !VALID_CONDITION_TYPES.includes(c.type)).map(c => c.type);
        if (invalidConditions.length > 0) {
            throw new Error(`Invalid condition type(s): ${invalidConditions.join(', ')}. Valid types: ${VALID_CONDITION_TYPES.join(', ')}`);
        }
        trigger.triggerConditions = args.conditions.map(c => ({
            id: crypto.randomUUID(),
            type: c.type,
            data: coerceConditionData(c.type, c.data),
            category: "condition"
        }));
    }

    if (args.effects !== undefined) {
        const invalidEffects = args.effects.filter(e => !VALID_EFFECT_TYPES.includes(e.type)).map(e => e.type);
        if (invalidEffects.length > 0) {
            throw new Error(`Invalid effect type(s): ${invalidEffects.join(', ')}. Valid types: ${VALID_EFFECT_TYPES.join(', ')}`);
        }
        trigger.triggerEffects = args.effects.map(e => ({
            id: crypto.randomUUID(),
            type: e.type,
            data: e.data
        }));
    }

    if (args.canTriggerMoreThanOnce !== undefined) trigger.canTriggerMoreThanOnce = args.canTriggerMoreThanOnce;
    if (args.prerequisites !== undefined) trigger.prerequisites = args.prerequisites;
    if (args.blockers !== undefined) trigger.blockers = args.blockers;

    await writeWorld(worldPath, world);
    const displayName = args.newName || args.name;
    return { content: [{ type: "text", text: `Trigger event '${displayName}' modified successfully.` }] };
}
