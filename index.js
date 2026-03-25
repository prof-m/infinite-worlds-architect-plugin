import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import crypto from "crypto";
import path from "path";

const server = new Server({ name: "iw-json-tools", version: "1.3.0" }, { capabilities: { tools: {} } });

function generateId() {
    return crypto.randomBytes(4).toString("hex");
}

async function readWorld(filePath) {
    try {
        const data = await fs.readFile(filePath, "utf-8");
        return JSON.parse(data);
    } catch (e) {
        return null;
    }
}

async function writeWorld(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function unwrapCodeBlock(content) {
    content = content.trim();
    if (content.startsWith('```') && content.endsWith('```')) {
        const lines = content.split('\n');
        if (lines.length >= 2) {
            return lines.slice(1, -1).join('\n').trim();
        }
    }
    return content;
}

function normalizeMarkdown(content) {
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

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "scaffold_world",
                description: "Initialize a new world JSON file with safe, token-efficient defaults.",
                inputSchema: {
                    type: "object",
                    properties: {
                        path: { type: "string", description: "Absolute path where the world JSON file should be saved." },
                        title: { type: "string" },
                        background: { type: "string" },
                        instructions: { type: "string" }
                    },
                    required: ["path", "title"]
                }
            },
            {
                name: "add_instruction_block",
                description: "Safely append an Extra Instruction Block or Keyword Block to an existing world JSON file.",
                inputSchema: {
                    type: "object",
                    properties: {
                        path: { type: "string", description: "Absolute path to the existing world JSON file." },
                        name: { type: "string", description: "Name of the block." },
                        content: { type: "string", description: "The instruction content." },
                        keywords: { 
                            type: "array", 
                            items: { type: "string" },
                            description: "Optional array of trigger keywords. If provided, creates a Keyword Block instead of an Extra Instruction Block."
                        }
                    },
                    required: ["path", "name", "content"]
                }
            },
            {
                name: "add_trigger",
                description: "Safely append a new Trigger Event to an existing world JSON file.",
                inputSchema: {
                    type: "object",
                    properties: {
                        path: { type: "string", description: "Absolute path to the existing world JSON file." },
                        name: { type: "string", description: "Name of the trigger." },
                        conditionType: { type: "string", description: "e.g., 'triggerOnTurn', 'triggerOnEvent'" },
                        conditionData: { type: "string", description: "The value matching the condition type" },
                        effectType: { type: "string", description: "e.g., 'effectShowMessage', 'effectGiveInfo'" },
                        effectData: { type: "string", description: "The resulting action data" }
                    },
                    required: ["path", "name", "conditionType", "conditionData", "effectType", "effectData"]
                }
            },
            {
                name: "compile_draft",
                description: "Compiles a Markdown draft file into a valid world JSON file. Expects standard headers like '# Title', '# Background', etc.",
                inputSchema: {
                    type: "object",
                    properties: {
                        draftPath: { type: "string", description: "Absolute path to the draft_world.md file." },
                        outputPath: { type: "string", description: "Absolute path where the world JSON file should be saved." },
                        originalPath: { type: "string", description: "Optional: Path to the original world JSON file for fallback data." },
                        skills: { type: "array", items: { type: "string" }, description: "Array of skill names." },
                        possibleCharacters: { type: "array", description: "JSON array of player character objects." },
                        NPCs: { type: "array", description: "JSON array of NPC objects." },
                        instructionBlocks: { type: "array", description: "JSON array of Extra Instruction Block objects." },
                        loreBookEntries: { type: "array", description: "JSON array of Keyword Instruction Block objects." },
                        trackedItems: { type: "array", description: "JSON array of tracked item objects." },
                        triggerEvents: { type: "array", description: "JSON array of trigger event objects." }
                    },
                    required: ["draftPath", "outputPath"]
                }
            },
            {
                name: "decompile_json",
                description: "Reads a world JSON file and generates a human-readable Markdown draft file.",
                inputSchema: {
                    type: "object",
                    properties: {
                        inputPath: { type: "string", description: "Absolute path to the world JSON file to read." },
                        outputPath: { type: "string", description: "Absolute path where the draft_world.md file should be saved." }
                    },
                    required: ["inputPath", "outputPath"]
                }
            },
            {
                name: "read_draft_section",
                description: "Reads the content of a specific section (e.g., 'Background', 'Title') from a Markdown draft file.",
                inputSchema: {
                    type: "object",
                    properties: {
                        draftPath: { type: "string", description: "Absolute path to the draft_world.md file." },
                        sectionName: { type: "string", description: "Name of the header (without the '#' symbol)." }
                    },
                    required: ["draftPath", "sectionName"]
                }
            },
            {
                name: "update_draft_section",
                description: "Updates the content of a specific section in a Markdown draft file.",
                inputSchema: {
                    type: "object",
                    properties: {
                        draftPath: { type: "string", description: "Absolute path to the draft_world.md file." },
                        sectionName: { type: "string", description: "Name of the header (without the '#' symbol)." },
                        newContent: { type: "string", description: "The new content to place under the header." }
                    },
                    required: ["draftPath", "sectionName", "newContent"]
                }
            },
            {
                name: "get_diff_summary",
                description: "Compares the original world JSON with the current Markdown draft and returns a summary of changes.",
                inputSchema: {
                    type: "object",
                    properties: {
                        originalPath: { type: "string", description: "Path to the original world JSON file." },
                        draftPath: { type: "string", description: "Path to the current draft_world.md file." }
                    },
                    required: ["originalPath", "draftPath"]
                }
            },
            {
                name: "confirm_path",
                description: "Programmatically locates a file or directory and returns its absolute path for user confirmation.",
                inputSchema: {
                    type: "object",
                    properties: {
                        inputPath: { type: "string", description: "The name or partial path provided by the user." },
                        type: { type: "string", enum: ["file", "directory"], description: "Whether to look for a file or a directory." }
                    },
                    required: ["inputPath", "type"]
                }
            }
        ]
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Helper to parse MD draft content (extracted from compile_draft for reuse)
    async function parseDraft(draftPath) {
        const draftContent = await fs.readFile(draftPath, "utf-8");
        const sections = draftContent.split(/^#\s+/m).filter(Boolean);
        const parsed = {};
        const complex = { possibleCharacters: [], NPCs: [], instructionBlocks: [], loreBookEntries: [], trackedItems: [], triggerEvents: [] };
        
        for (const section of sections) {
            const lines = section.trim().split('\n');
            const header = lines[0].trim().toLowerCase();
            const content = unwrapCodeBlock(lines.slice(1).join('\n').trim());
            
            if (header === 'title') parsed.title = content;
            else if (header === 'description') parsed.description = content;
            else if (header === 'background') parsed.background = content;
            else if (header === 'first action') parsed.firstInput = content;
            else if (header === 'objective') parsed.objective = content;
            else if (header === 'main instructions') parsed.instructions = normalizeMarkdown(content);
            else if (header === 'author style') parsed.authorStyle = normalizeMarkdown(content);
            else if (header === 'nsfw') parsed.nsfw = content.toLowerCase() === 'true';
            else if (header === 'content warnings') parsed.contentWarnings = content;
            else if (header === 'description request') parsed.descriptionRequest = normalizeMarkdown(content);
            else if (header === 'summary request') parsed.summaryRequest = normalizeMarkdown(content);
            else if (header === 'image model') parsed.imageModel = content;
            else if (header === 'image style') parsed.imageStyle = content;
            else if (header === 'image style character pre') parsed.imageStyleCharacterPre = content;
            else if (header === 'image style character post') parsed.imageStyleCharacterPost = content;
            else if (header === 'image style non character pre') parsed.imageStyleNonCharacterPre = content;
            else if (header === 'image style non character post') parsed.imageStyleNonCharacterPost = content;
            else if (header === 'victory condition') parsed.victoryCondition = content;
            else if (header === 'victory text') parsed.victoryText = content;
            else if (header === 'defeat condition') parsed.defeatCondition = content;
            else if (header === 'defeat text') parsed.defeatText = content;
            else if (header === 'design notes') parsed.designNotes = content;
            else if (header === 'player permissions') {
                const permLines = content.split('\n').filter(l => l.includes(':'));
                for (const line of permLines) {
                    const [key, val] = line.split(':').map(s => s.trim());
                    const boolVal = val.toLowerCase() === 'true';
                    if (key.toLowerCase() === 'can change name') parsed.canChangeCharacterName = boolVal;
                    else if (key.toLowerCase() === 'can change description') parsed.canChangeCharacterDescription = boolVal;
                    else if (key.toLowerCase() === 'can change skills') parsed.canChangeCharacterSkills = boolVal;
                    else if (key.toLowerCase() === 'can select other portraits') parsed.canSelectOtherPortraits = boolVal;
                    else if (key.toLowerCase() === 'can create new portrait') parsed.canCreateNewPortrait = boolVal;
                    else if (key.toLowerCase() === 'can change tracked items starting values') parsed.canChangeTrackedItemsStartingValues = boolVal;
                }
            }
            else if (header === 'enable ai specific instruction blocks') parsed.enableAISpecificInstructionBlocks = content.toLowerCase() === 'true';
            else if (header === 'skills') {
                parsed.skills = content.split('\n').map(line => {
                    const match = line.match(/^[-*]?\s*(.*)/);
                    return match ? match[1].trim() : line.trim();
                }).filter(Boolean);
            }
            else if (['possible characters', 'other characters', 'extra instruction blocks', 'keyword instruction blocks', 'tracked items', 'trigger events'].includes(header)) {
                const items = content.split(/^##\s+/m).filter(Boolean);
                const parsedItems = [];
                for (const item of items) {
                    const itemLines = item.trim().split('\n');
                    const itemName = itemLines[0].trim();
                    const itemContent = itemLines.slice(1).join('\n').trim();
                    const subFields = {};
                    if (itemContent.includes('### ')) {
                        const subSections = itemContent.split(/^###\s+/m).filter(Boolean);
                        for (const sub of subSections) {
                            const subLines = sub.trim().split('\n');
                            const subHeader = subLines[0].trim();
                            const subContent = unwrapCodeBlock(subLines.slice(1).join('\n').trim());
                            subFields[subHeader] = subContent;
                        }
                    } else {
                        const regex = /^([\w\s]+):\s*(.*(?:\n(?!(?:[\w\s]+):).*)*)/gm;
                        let match;
                        while ((match = regex.exec(itemContent)) !== null) {
                            subFields[match[1].trim()] = unwrapCodeBlock(match[2].trim());
                        }
                    }
                    if (header === 'possible characters') {
                        const itemObj = { name: itemName, description: subFields['Description'] || "", portrait: subFields['Portrait'] || "" };
                        if ('Skills' in subFields) {
                            const s = {};
                            subFields['Skills'].split('\n').forEach(line => {
                                const match = line.match(/^[-*]?\s*(.*?):\s*(\d+)/);
                                if (match) s[match[1].trim()] = parseInt(match[2].trim(), 10);
                            });
                            itemObj.skills = s;
                        }
                        parsedItems.push(itemObj);
                    } else if (header === 'other characters') {
                        parsedItems.push({ name: itemName, one_liner: subFields['Brief Summary'] || "", detail: subFields['Character Detail'] || "", appearance: subFields['Appearance'] || "", location: subFields['Location'] || "", secret_info: subFields['Secret Information'] || "", names: subFields['Full List of Names'] ? subFields['Full List of Names'].split(',').map(n => n.trim()) : [], img_appearance: subFields['Image Appearance'] || "", img_clothing: subFields['Image Clothing'] || "" });
                    } else if (header === 'extra instruction blocks' || header === 'keyword instruction blocks') {
                        const block = { name: itemName, content: normalizeMarkdown(unwrapCodeBlock(subFields['Content'] || itemContent)) };
                        if (header === 'keyword instruction blocks' || subFields['Keywords']) block.keywords = subFields['Keywords'] ? subFields['Keywords'].split(',').map(k => k.trim()) : [];
                        parsedItems.push(block);
                    } else if (header === 'tracked items') {
                        parsedItems.push({ name: itemName, dataType: subFields['Data Type'] || "text", visibility: subFields['Visibility'] || "everyone", description: subFields['Description'] || "", updateInstructions: normalizeMarkdown(subFields['Update Instructions'] || ""), initialValue: subFields['Initial Value'] || "" });
                    } else if (header === 'trigger events') {
                        const itemObj = { name: itemName };
                        if ('Conditions' in subFields) {
                            const conds = [];
                            const blocks = subFields['Conditions'].split(/^[-*]\s+/m).filter(Boolean);
                            blocks.forEach(block => {
                                const colonIdx = block.indexOf(':');
                                if (colonIdx !== -1) {
                                    const type = block.substring(0, colonIdx).trim();
                                    let data = unwrapCodeBlock(block.substring(colonIdx + 1).trim());
                                    try { data = JSON.parse(data); } catch(e) {}
                                    if (type === 'logic') {
                                        conds.push({ ...data, id: "0000" }); // Fake ID for diffing
                                    } else {
                                        if (type === 'triggerOnEvent' && typeof data === 'string') data = normalizeMarkdown(data);
                                        conds.push({ type, data, id: "0000", category: "condition" });
                                    }
                                }
                            });
                            itemObj.triggerConditions = conds;
                        }
                        if ('Effects' in subFields) {
                            const effs = [];
                            const blocks = subFields['Effects'].split(/^[-*]\s+/m).filter(Boolean);
                            blocks.forEach(block => {
                                const colonIdx = block.indexOf(':');
                                if (colonIdx !== -1) {
                                    const type = block.substring(0, colonIdx).trim();
                                    let data = unwrapCodeBlock(block.substring(colonIdx + 1).trim());
                                    try { data = JSON.parse(data); } catch(e) {}
                                    if (type === 'effectTellAIWhatToDo' && typeof data === 'string') data = normalizeMarkdown(data);
                                    effs.push({ type, data, id: "0000" });
                                }
                            });
                            itemObj.triggerEffects = effs;
                        }
                        parsedItems.push(itemObj);
                    }
                }
                if (header === 'possible characters') complex.possibleCharacters = parsedItems;
                else if (header === 'other characters') complex.NPCs = parsedItems;
                else if (header === 'extra instruction blocks' || header === 'keyword instruction blocks') {
                    const keywords = parsedItems.filter(b => b.keywords && b.keywords.length > 0);
                    const extra = parsedItems.filter(b => !b.keywords || b.keywords.length === 0);
                    complex.loreBookEntries = complex.loreBookEntries.concat(keywords);
                    complex.instructionBlocks = complex.instructionBlocks.concat(extra);
                }
                else if (header === 'tracked items') complex.trackedItems = parsedItems;
                else if (header === 'trigger events') complex.triggerEvents = parsedItems;
            }
        }
        return { ...parsed, ...complex };
    }

    if (name === "get_diff_summary") {
        const original = await readWorld(path.resolve(args.originalPath));
        const current = await parseDraft(path.resolve(args.draftPath));
        if (!original) throw new Error("Could not read original world file.");

        const changes = [];
        const fields = ['title', 'description', 'background', 'firstInput', 'objective', 'instructions', 'authorStyle', 'nsfw', 'contentWarnings', 'descriptionRequest', 'summaryRequest', 'imageModel', 'imageStyle', 'imageStyleCharacterPre', 'imageStyleCharacterPost', 'imageStyleNonCharacterPre', 'imageStyleNonCharacterPost', 'victoryCondition', 'victoryText', 'defeatCondition', 'defeatText', 'designNotes', 'canChangeCharacterName', 'canChangeCharacterDescription', 'canChangeCharacterSkills', 'canSelectOtherPortraits', 'canCreateNewPortrait', 'canChangeTrackedItemsStartingValues', 'enableAISpecificInstructionBlocks'];
        
        for (const f of fields) {
            if (JSON.stringify(original[f]) !== JSON.stringify(current[f])) {
                changes.push(`- Field [${f}] was modified.`);
            }
        }

        if (JSON.stringify(original.skills) !== JSON.stringify(current.skills)) {
            changes.push(`- Global skills were updated.`);
        }

        const arrays = { 'possibleCharacters': 'Possible Characters', 'NPCs': 'NPCs', 'instructionBlocks': 'Extra Instruction Blocks', 'loreBookEntries': 'Keyword Instruction Blocks', 'trackedItems': 'Tracked Items', 'triggerEvents': 'Trigger Events' };
        for (const [key, label] of Object.entries(arrays)) {
            const origNames = (original[key] || []).map(i => i.name).sort();
            const currNames = (current[key] || []).map(i => i.name).sort();
            if (JSON.stringify(origNames) !== JSON.stringify(currNames)) {
                changes.push(`- ${label} list was modified (added/removed items).`);
            } else {
                // Check if content of existing items changed
                for (const item of (current[key] || [])) {
                    const origItem = (original[key] || []).find(i => i.name === item.name);
                    if (origItem && JSON.stringify(origItem) !== JSON.stringify(item)) {
                        // We strip IDs for comparison since draft might not have them yet or they are generated
                        const { id: _id1, characterId: _cid1, ...itemClean } = item;
                        const { id: _id2, characterId: _cid2, ...origClean } = origItem;
                        if (JSON.stringify(itemClean) !== JSON.stringify(origClean)) {
                            changes.push(`- Item "${item.name}" in ${label} was modified.`);
                        }
                    }
                }
            }
        }

        const summary = changes.length > 0 ? changes.join('\n') : "No changes detected.";
        return { content: [{ type: "text", text: summary }] };
    }

    if (name === "confirm_path") {
        const input = args.inputPath;
        const type = args.type;
        let resolvedPath = path.resolve(input);

        // Simple check for existence first
        let exists = false;
        try {
            const stats = await fs.stat(resolvedPath);
            exists = (type === "file" && stats.isFile()) || (type === "directory" && stats.isDirectory());
        } catch (e) {}

        if (!exists) {
            return {
                content: [{ type: "text", text: `Path NOT_FOUND: Could not find a ${type} at "${input}". Please provide a more specific or absolute path.` }]
            };
        }

        return {
            content: [{ type: "text", text: `RESOLVED_PATH: ${resolvedPath}\n\nIs this the correct ${type}?` }]
        };
    }

    if (name === "scaffold_world") {
        const worldPath = path.resolve(args.path);
        const newWorld = {
            title: args.title,
            description: "",
            background: args.background || "",
            instructions: args.instructions || "",
            authorStyle: "Concise, highly descriptive narrative.",
            firstInput: "",
            objective: "Explore.",
            nsfw: false,
            contentWarnings: "",
            descriptionRequest: "Always write in first-person point of view, present tense. Write vital state changes into secretInfo.",
            summaryRequest: "",
            imageModel: "manticore",
            imageStyle: "photo_beautiful",
            victoryCondition: "",
            victoryText: "",
            defeatCondition: "",
            defeatText: "Your adventure ends here. Game over.",
            designNotes: "",
            canChangeCharacterName: true,
            canChangeCharacterDescription: true,
            canChangeCharacterSkills: true,
            canSelectOtherPortraits: false,
            canCreateNewPortrait: true,
            canChangeTrackedItemsStartingValues: false,
            enableAISpecificInstructionBlocks: false,
            skills: ["Persuasion", "Observation"],
            possibleCharacters: [],
            NPCs: [],
            trackedItems: [],
            triggerEvents: [],
            instructionBlocks: [],
            loreBookEntries: []
        };
        await writeWorld(worldPath, newWorld);
        return { content: [{ type: "text", text: `World scaffolded successfully at ${worldPath}` }] };
    }

    if (name === "add_instruction_block") {
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

    if (name === "add_trigger") {
        const worldPath = path.resolve(args.path);
        const world = await readWorld(worldPath);
        if (!world) throw new Error(`Could not read world JSON file at ${worldPath}`);

        const trigger = {
            id: generateId(),
            name: args.name,
            triggerConditions: [{
                id: crypto.randomUUID(),
                type: args.conditionType,
                data: args.conditionType === 'triggerOnTurn' ? parseInt(args.conditionData) : args.conditionData,
                category: "condition"
            }],
            triggerEffects: [{
                id: crypto.randomUUID(),
                type: args.effectType,
                data: args.effectData
            }]
        };

        world.triggerEvents = world.triggerEvents || [];
        world.triggerEvents.push(trigger);

        await writeWorld(worldPath, world);
        return { content: [{ type: "text", text: `Trigger '${args.name}' added successfully.` }] };
    }

    if (name === "compile_draft") {
        const draftPath = path.resolve(args.draftPath);
        const outputPath = path.resolve(args.outputPath);
        
        let draftContent;
        try {
            draftContent = await fs.readFile(draftPath, "utf-8");
        } catch (e) {
            throw new Error(`Could not read draft file at ${draftPath}`);
        }

        const sections = draftContent.split(/^#\s+/m).filter(Boolean);
        const parsed = {};
        
        for (const section of sections) {
            const lines = section.trim().split('\n');
            const header = lines[0].trim().toLowerCase();
            const content = unwrapCodeBlock(lines.slice(1).join('\n').trim());
            
            if (header === 'title') parsed.title = content;
            if (header === 'description') parsed.description = content;
            if (header === 'background') parsed.background = content;
            if (header === 'first action') parsed.firstInput = content;
            if (header === 'objective') parsed.objective = content;
            if (header === 'main instructions') parsed.instructions = normalizeMarkdown(content);
            if (header === 'author style') parsed.authorStyle = normalizeMarkdown(content);
            if (header === 'nsfw') parsed.nsfw = content.toLowerCase() === 'true';
            if (header === 'content warnings') parsed.contentWarnings = content;
            if (header === 'description request') parsed.descriptionRequest = normalizeMarkdown(content);
            if (header === 'summary request') parsed.summaryRequest = normalizeMarkdown(content);
            if (header === 'image model') parsed.imageModel = content;
            if (header === 'image style') parsed.imageStyle = content;
            if (header === 'image style character pre') parsed.imageStyleCharacterPre = content;
            if (header === 'image style character post') parsed.imageStyleCharacterPost = content;
            if (header === 'image style non character pre') parsed.imageStyleNonCharacterPre = content;
            if (header === 'image style non character post') parsed.imageStyleNonCharacterPost = content;
            if (header === 'victory condition') parsed.victoryCondition = content;
            if (header === 'victory text') parsed.victoryText = content;
            if (header === 'defeat condition') parsed.defeatCondition = content;
            if (header === 'defeat text') parsed.defeatText = content;
            if (header === 'design notes') parsed.designNotes = content;
            if (header === 'player permissions') {
                const permLines = content.split('\n').filter(l => l.includes(':'));
                for (const line of permLines) {
                    const [key, val] = line.split(':').map(s => s.trim());
                    const boolVal = val.toLowerCase() === 'true';
                    if (key.toLowerCase() === 'can change name') parsed.canChangeCharacterName = boolVal;
                    else if (key.toLowerCase() === 'can change description') parsed.canChangeCharacterDescription = boolVal;
                    else if (key.toLowerCase() === 'can change skills') parsed.canChangeCharacterSkills = boolVal;
                    else if (key.toLowerCase() === 'can select other portraits') parsed.canSelectOtherPortraits = boolVal;
                    else if (key.toLowerCase() === 'can create new portrait') parsed.canCreateNewPortrait = boolVal;
                    else if (key.toLowerCase() === 'can change tracked items starting values') parsed.canChangeTrackedItemsStartingValues = boolVal;
                }
            }
            if (header === 'enable ai specific instruction blocks') parsed.enableAISpecificInstructionBlocks = content.toLowerCase() === 'true';
            if (header === 'skills') {
                parsed.skills = content.split('\n').map(line => {
                    const match = line.match(/^[-*]?\s*(.*)/);
                    return match ? match[1].trim() : line.trim();
                }).filter(Boolean);
            }
            if (header === 'possible characters' || header === 'other characters' || header === 'extra instruction blocks' || header === 'keyword instruction blocks' || header === 'tracked items' || header === 'trigger events') {
                const items = content.split(/^##\s+/m).filter(Boolean);
                const parsedItems = [];
                
                for (const item of items) {
                    const itemLines = item.trim().split('\n');
                    const itemName = itemLines[0].trim();
                    const itemContent = itemLines.slice(1).join('\n').trim();
                    
                    const subFields = {};
                    if (itemContent.includes('### ')) {
                        const subSections = itemContent.split(/^###\s+/m).filter(Boolean);
                        for (const sub of subSections) {
                            const subLines = sub.trim().split('\n');
                            const subHeader = subLines[0].trim();
                            const subContent = unwrapCodeBlock(subLines.slice(1).join('\n').trim());
                            subFields[subHeader] = subContent;
                        }
                    } else {
                        const regex = /^([\w\s]+):\s*(.*(?:\n(?!(?:[\w\s]+):).*)*)/gm;
                        let match;
                        while ((match = regex.exec(itemContent)) !== null) {
                            subFields[match[1].trim()] = unwrapCodeBlock(match[2].trim());
                        }
                    }
                    
                    if (header === 'possible characters') {
                        const itemObj = { name: itemName };
                        if ('Description' in subFields) itemObj.description = subFields['Description'];
                        if ('Portrait' in subFields) itemObj.portrait = subFields['Portrait'];
                        if ('Skills' in subFields) {
                            const s = {};
                            subFields['Skills'].split('\n').forEach(line => {
                                const match = line.match(/^[-*]?\s*(.*?):\s*(\d+)/);
                                if (match) s[match[1].trim()] = parseInt(match[2].trim(), 10);
                            });
                            itemObj.skills = s;
                        }
                        parsedItems.push(itemObj);
                    } else if (header === 'other characters') {
                        const itemObj = { name: itemName };
                        if ('Brief Summary' in subFields) itemObj.one_liner = subFields['Brief Summary'];
                        if ('Character Detail' in subFields) itemObj.detail = subFields['Character Detail'];
                        if ('Appearance' in subFields) itemObj.appearance = subFields['Appearance'];
                        if ('Location' in subFields) itemObj.location = subFields['Location'];
                        if ('Secret Information' in subFields) itemObj.secret_info = subFields['Secret Information'];
                        if ('Full List of Names' in subFields) itemObj.names = subFields['Full List of Names'].split(',').map(n => n.trim()).filter(Boolean);
                        if ('Image Appearance' in subFields) itemObj.img_appearance = subFields['Image Appearance'];
                        if ('Image Clothing' in subFields) itemObj.img_clothing = subFields['Image Clothing'];
                        parsedItems.push(itemObj);
                    } else if (header === 'extra instruction blocks' || header === 'keyword instruction blocks') {
                        const itemObj = { name: itemName };
                        if ('Content' in subFields) itemObj.content = normalizeMarkdown(unwrapCodeBlock(subFields['Content']));
                        else itemObj.content = normalizeMarkdown(unwrapCodeBlock(itemContent)); // Fallback
                        
                        if (header === 'keyword instruction blocks' || 'Keywords' in subFields) {
                            itemObj.keywords = subFields['Keywords'] ? subFields['Keywords'].split(',').map(k => k.trim()).filter(Boolean) : [];
                        }
                        parsedItems.push(itemObj);
                    } else if (header === 'tracked items') {
                        const itemObj = { name: itemName };
                        if ('Data Type' in subFields) itemObj.dataType = subFields['Data Type'];
                        if ('Visibility' in subFields) itemObj.visibility = subFields['Visibility'];
                        if ('Description' in subFields) itemObj.description = subFields['Description'];
                        if ('Update Instructions' in subFields) itemObj.updateInstructions = normalizeMarkdown(subFields['Update Instructions']);
                        if ('Initial Value' in subFields) itemObj.initialValue = subFields['Initial Value'];
                        parsedItems.push(itemObj);
                    } else if (header === 'trigger events') {
                        const itemObj = { name: itemName };
                        if ('Conditions' in subFields) {
                            const conds = [];
                            const blocks = subFields['Conditions'].split(/^[-*]\s+/m).filter(Boolean);
                            blocks.forEach(block => {
                                const colonIdx = block.indexOf(':');
                                if (colonIdx !== -1) {
                                    const type = block.substring(0, colonIdx).trim();
                                    let data = unwrapCodeBlock(block.substring(colonIdx + 1).trim());
                                    try { data = JSON.parse(data); } catch(e) {}
                                    if (type === 'logic') {
                                        conds.push({ ...data, id: crypto.randomUUID() });
                                    } else {
                                        if (type === 'triggerOnEvent' && typeof data === 'string') data = normalizeMarkdown(data);
                                        conds.push({ type, data, id: crypto.randomUUID(), category: "condition" });
                                    }
                                }
                            });
                            itemObj.triggerConditions = conds;
                        }
                        if ('Effects' in subFields) {
                            const effs = [];
                            const blocks = subFields['Effects'].split(/^[-*]\s+/m).filter(Boolean);
                            blocks.forEach(block => {
                                const colonIdx = block.indexOf(':');
                                if (colonIdx !== -1) {
                                    const type = block.substring(0, colonIdx).trim();
                                    let data = unwrapCodeBlock(block.substring(colonIdx + 1).trim());
                                    try { data = JSON.parse(data); } catch(e) {}
                                    if (type === 'effectTellAIWhatToDo' && typeof data === 'string') data = normalizeMarkdown(data);
                                    effs.push({ type, data, id: crypto.randomUUID() });
                                }
                            });
                            itemObj.triggerEffects = effs;
                        }
                        parsedItems.push(itemObj);
                    }
                }
                if (header === 'possible characters') args.possibleCharacters = parsedItems;
                if (header === 'other characters') args.NPCs = parsedItems;
                if (header === 'extra instruction blocks' || header === 'keyword instruction blocks') {
                    const keywords = parsedItems.filter(b => b.keywords && b.keywords.length > 0);
                    const extra = parsedItems.filter(b => !b.keywords || b.keywords.length === 0);
                    args.loreBookEntries = (args.loreBookEntries || []).concat(keywords);
                    args.instructionBlocks = (args.instructionBlocks || []).concat(extra);
                }
                if (header === 'tracked items') args.trackedItems = parsedItems;
                if (header === 'trigger events') args.triggerEvents = parsedItems;
            }
        }

        let originalData = {};
        if (args.originalPath) {
            try {
                const fileData = await fs.readFile(path.resolve(args.originalPath), "utf-8");
                originalData = JSON.parse(fileData);
            } catch (e) {
                // Ignore if it can't be read
            }
        }

        const newWorld = { ...originalData };
        
        // Update root fields while preserving original key order
        const rootFields = {
            title: parsed.title ?? originalData.title ?? "New World",
            description: parsed.description ?? originalData.description ?? "",
            background: parsed.background ?? originalData.background ?? "",
            instructions: parsed.instructions ?? originalData.instructions ?? "",
            authorStyle: parsed.authorStyle ?? originalData.authorStyle ?? "Concise, highly descriptive narrative.",
            firstInput: parsed.firstInput ?? originalData.firstInput ?? "",
            objective: parsed.objective ?? originalData.objective ?? "Explore.",
            nsfw: parsed.nsfw !== undefined ? parsed.nsfw : (originalData.nsfw ?? false),
            contentWarnings: parsed.contentWarnings ?? originalData.contentWarnings ?? "",
            descriptionRequest: parsed.descriptionRequest ?? originalData.descriptionRequest ?? "Always write in first-person point of view, present tense. Write vital state changes into secretInfo.",
            summaryRequest: parsed.summaryRequest ?? originalData.summaryRequest ?? "",
            imageModel: parsed.imageModel ?? originalData.imageModel ?? "manticore",
            imageStyle: parsed.imageStyle ?? originalData.imageStyle ?? "photo_beautiful",
            imageStyleCharacterPre: parsed.imageStyleCharacterPre ?? originalData.imageStyleCharacterPre ?? "",
            imageStyleCharacterPost: parsed.imageStyleCharacterPost ?? originalData.imageStyleCharacterPost ?? "",
            imageStyleNonCharacterPre: parsed.imageStyleNonCharacterPre ?? originalData.imageStyleNonCharacterPre ?? "",
            imageStyleNonCharacterPost: parsed.imageStyleNonCharacterPost ?? originalData.imageStyleNonCharacterPost ?? "",
            victoryCondition: parsed.victoryCondition ?? originalData.victoryCondition ?? "",
            victoryText: parsed.victoryText ?? originalData.victoryText ?? "",
            defeatCondition: parsed.defeatCondition ?? originalData.defeatCondition ?? "",
            defeatText: parsed.defeatText ?? originalData.defeatText ?? "Your adventure ends here. Game over.",
            designNotes: parsed.designNotes ?? originalData.designNotes ?? "",
            canChangeCharacterName: parsed.canChangeCharacterName !== undefined ? parsed.canChangeCharacterName : (originalData.canChangeCharacterName ?? true),
            canChangeCharacterDescription: parsed.canChangeCharacterDescription !== undefined ? parsed.canChangeCharacterDescription : (originalData.canChangeCharacterDescription ?? true),
            canChangeCharacterSkills: parsed.canChangeCharacterSkills !== undefined ? parsed.canChangeCharacterSkills : (originalData.canChangeCharacterSkills ?? true),
            canSelectOtherPortraits: parsed.canSelectOtherPortraits !== undefined ? parsed.canSelectOtherPortraits : (originalData.canSelectOtherPortraits ?? false),
            canCreateNewPortrait: parsed.canCreateNewPortrait !== undefined ? parsed.canCreateNewPortrait : (originalData.canCreateNewPortrait ?? true),
            canChangeTrackedItemsStartingValues: parsed.canChangeTrackedItemsStartingValues !== undefined ? parsed.canChangeTrackedItemsStartingValues : (originalData.canChangeTrackedItemsStartingValues ?? false),
            enableAISpecificInstructionBlocks: parsed.enableAISpecificInstructionBlocks !== undefined ? parsed.enableAISpecificInstructionBlocks : (originalData.enableAISpecificInstructionBlocks ?? false),
            skills: parsed.skills || args.skills || originalData.skills || ["Persuasion", "Observation"]
        };

        for (const [key, value] of Object.entries(rootFields)) {
            newWorld[key] = value;
        }

        // Merge complex arrays with ID persistence and field order preservation
        const mergeArray = (key, items, idKey = 'id') => {
            const origArr = originalData[key] || originalData.otherCharacters && key === 'NPCs' && originalData.otherCharacters || [];
            return items.map(item => {
                const orig = origArr.find(o => o.name === item.name) || {};
                const res = { ...orig, ...item };
                if (orig[idKey]) res[idKey] = orig[idKey];
                else if (!res[idKey]) res[idKey] = idKey === 'characterId' ? generateId() : generateId();
                
                // Deep merge for triggers (conditions and effects)
                if (key === 'triggerEvents') {
                    if (item.triggerConditions) {
                        res.triggerConditions = item.triggerConditions.map((c, idx) => {
                            const oCond = (orig.triggerConditions || [])[idx] || {};
                            const cRes = { ...oCond, ...c };
                            if (oCond.id) cRes.id = oCond.id;
                            else if (!cRes.id) cRes.id = crypto.randomUUID();
                            return cRes;
                        });
                    }
                    if (item.triggerEffects) {
                        res.triggerEffects = item.triggerEffects.map((e, idx) => {
                            const oEff = (orig.triggerEffects || [])[idx] || {};
                            const eRes = { ...oEff, ...e };
                            if (oEff.id) eRes.id = oEff.id;
                            else if (!eRes.id) eRes.id = crypto.randomUUID();
                            return eRes;
                        });
                    }
                }
                return res;
            });
        };

        if (args.possibleCharacters || parsed.possibleCharacters) newWorld.possibleCharacters = mergeArray('possibleCharacters', args.possibleCharacters || [], 'characterId');
        if (args.NPCs || parsed.NPCs) newWorld.NPCs = mergeArray('NPCs', args.NPCs || []);
        if (args.trackedItems || parsed.trackedItems) newWorld.trackedItems = mergeArray('trackedItems', args.trackedItems || []);
        if (args.triggerEvents || parsed.triggerEvents) newWorld.triggerEvents = mergeArray('triggerEvents', args.triggerEvents || []);
        if (args.instructionBlocks || parsed.instructionBlocks) newWorld.instructionBlocks = mergeArray('instructionBlocks', args.instructionBlocks || []);
        if (args.loreBookEntries || parsed.loreBookEntries) newWorld.loreBookEntries = mergeArray('loreBookEntries', args.loreBookEntries || []);

        // Final write with literal character preservation
        const json = JSON.stringify(newWorld, null, 2);
        // Ensure only " and \ are escaped, and unicode is literal.
        // Node stringify already does this for non-ASCII, but we want to ensure 
        // no common entities or unnecessary escapes are present.
        await fs.writeFile(outputPath, json, "utf-8");
        return { content: [{ type: "text", text: `World compiled successfully from draft to ${outputPath}` }] };
    }

    if (name === "decompile_json") {
        const inputPath = path.resolve(args.inputPath);
        const outputPath = path.resolve(args.outputPath);
        
        let world;
        try {
            const fileData = await fs.readFile(inputPath, "utf-8");
            world = JSON.parse(fileData);
        } catch (e) {
            throw new Error(`Could not read or parse world JSON file at ${inputPath}`);
        }

        let md = "";
        md += `# Table of Contents\n`;
        md += `- [Title](#title)\n`;
        md += `- [Description](#description)\n`;
        md += `- [Background](#background)\n`;
        md += `- [First Action](#first-action)\n`;
        md += `- [Objective](#objective)\n`;
        md += `- [Main Instructions](#main-instructions)\n`;
        md += `- [Author Style](#author-style)\n`;
        md += `- [NSFW](#nsfw)\n`;
        md += `- [Content Warnings](#content-warnings)\n`;
        md += `- [Description Request](#description-request)\n`;
        md += `- [Summary Request](#summary-request)\n`;
        md += `- [Image Model](#image-model)\n`;
        md += `- [Image Style](#image-style)\n`;
        md += `- [Image Style Character Pre](#image-style-character-pre)\n`;
        md += `- [Image Style Character Post](#image-style-character-post)\n`;
        md += `- [Image Style Non Character Pre](#image-style-non-character-pre)\n`;
        md += `- [Image Style Non Character Post](#image-style-non-character-post)\n`;
        md += `- [Victory Condition](#victory-condition)\n`;
        md += `- [Victory Text](#victory-text)\n`;
        md += `- [Defeat Condition](#defeat-condition)\n`;
        md += `- [Defeat Text](#defeat-text)\n`;
        md += `- [Design Notes](#design-notes)\n`;
        md += `- [Player Permissions](#player-permissions)\n`;
        md += `- [Enable AI Specific Instruction Blocks](#enable-ai-specific-instruction-blocks)\n`;
        md += `- [Skills](#skills)\n`;
        md += `- [Possible Characters](#possible-characters)\n`;
        md += `- [Other Characters](#other-characters)\n`;
        md += `- [Extra Instruction Blocks](#extra-instruction-blocks)\n`;
        md += `- [Keyword Instruction Blocks](#keyword-instruction-blocks)\n`;
        md += `- [Tracked Items](#tracked-items)\n`;
        md += `- [Trigger Events](#trigger-events)\n\n`;

        md += `# Title\n${world.title || ""}\n\n`;
        md += `# Description\n${world.description || ""}\n\n`;
        md += `# Background\n${world.background || ""}\n\n`;
        md += `# First Action\n${world.firstInput || ""}\n\n`;
        md += `# Objective\n${world.objective || ""}\n\n`;
        md += `# Main Instructions\n${world.instructions || ""}\n\n`;
        md += `# Author Style\n${world.authorStyle || ""}\n\n`;
        md += `# NSFW\n${world.nsfw ? "true" : "false"}\n\n`;
        md += `# Content Warnings\n${world.contentWarnings || ""}\n\n`;
        md += `# Description Request\n${world.descriptionRequest || ""}\n\n`;
        md += `# Summary Request\n${world.summaryRequest || ""}\n\n`;
        md += `# Image Model\n${world.imageModel || ""}\n\n`;
        md += `# Image Style\n${world.imageStyle || ""}\n\n`;
        md += `# Image Style Character Pre\n${world.imageStyleCharacterPre || ""}\n\n`;
        md += `# Image Style Character Post\n${world.imageStyleCharacterPost || ""}\n\n`;
        md += `# Image Style Non Character Pre\n${world.imageStyleNonCharacterPre || ""}\n\n`;
        md += `# Image Style Non Character Post\n${world.imageStyleNonCharacterPost || ""}\n\n`;

        md += `# Victory Condition\n${world.victoryCondition || ""}\n\n`;
        md += `# Victory Text\n${world.victoryText || ""}\n\n`;
        md += `# Defeat Condition\n${world.defeatCondition || ""}\n\n`;
        md += `# Defeat Text\n${world.defeatText || ""}\n\n`;
        md += `# Design Notes\n${world.designNotes || ""}\n\n`;
        md += `# Player Permissions\n`;
        md += `Can Change Name: ${world.canChangeCharacterName !== undefined ? world.canChangeCharacterName : true}\n`;
        md += `Can Change Description: ${world.canChangeCharacterDescription !== undefined ? world.canChangeCharacterDescription : true}\n`;
        md += `Can Change Skills: ${world.canChangeCharacterSkills !== undefined ? world.canChangeCharacterSkills : true}\n`;
        md += `Can Select Other Portraits: ${world.canSelectOtherPortraits !== undefined ? world.canSelectOtherPortraits : false}\n`;
        md += `Can Create New Portrait: ${world.canCreateNewPortrait !== undefined ? world.canCreateNewPortrait : true}\n`;
        md += `Can Change Tracked Items Starting Values: ${world.canChangeTrackedItemsStartingValues !== undefined ? world.canChangeTrackedItemsStartingValues : false}\n\n`;
        md += `# Enable AI Specific Instruction Blocks\n${world.enableAISpecificInstructionBlocks ? "true" : "false"}\n\n`;

        md += `# Skills\n`;
        if (world.skills) world.skills.forEach(s => md += `- ${s}\n`);
        
        md += `\n# Possible Characters\n`;
        if (world.possibleCharacters) {
            world.possibleCharacters.forEach(c => {
                md += `## ${c.name}\n### Description\n${c.description || ""}\n### Portrait\n${c.portrait || ""}\n### Skills\n`;
                if (c.skills) {
                    Object.entries(c.skills).forEach(([k, v]) => md += `- ${k}: ${v}\n`);
                }
                md += `\n`;
            });
        }
        
        md += `# Other Characters\n`;
        if (world.NPCs) {
            world.NPCs.forEach(c => {
                md += `## ${c.name}\n### Brief Summary\n${c.one_liner || ""}\n### Character Detail\n${c.detail || ""}\n### Appearance\n${c.appearance || ""}\n### Location\n${c.location || ""}\n### Secret Information\n${c.secret_info || ""}\n### Full List of Names\n${c.names ? c.names.join(', ') : ""}\n### Image Appearance\n${c.img_appearance || ""}\n### Image Clothing\n${c.img_clothing || ""}\n\n`;
            });
        }

        md += `# Extra Instruction Blocks\n`;
        if (world.instructionBlocks) {
            world.instructionBlocks.forEach(b => {
                md += `## ${b.name}\n### Content\n\n\`\`\`text\n${b.content || ""}\n\`\`\`\n\n`;
            });
        }

        md += `# Keyword Instruction Blocks\n`;
        if (world.loreBookEntries) {
            world.loreBookEntries.forEach(b => {
                md += `## ${b.name}\n### Keywords\n${b.keywords ? b.keywords.join(', ') : ""}\n### Content\n\n\`\`\`text\n${b.content || ""}\n\`\`\`\n\n`;
            });
        }

        md += `# Tracked Items\n`;
        if (world.trackedItems) {
            world.trackedItems.forEach(i => {
                md += `## ${i.name}\n### Data Type\n${i.dataType || ""}\n### Visibility\n${i.visibility || ""}\n### Description\n${i.description || ""}\n### Update Instructions\n${i.updateInstructions || ""}\n### Initial Value\n${i.initialValue || ""}\n\n`;
            });
        }

        md += `# Trigger Events\n`;
        if (world.triggerEvents) {
            world.triggerEvents.forEach(t => {
                md += `## ${t.name}\n### Conditions\n`;
                if (t.triggerConditions) {
                    t.triggerConditions.forEach(c => {
                        let typeStr = c.category === 'logic' ? 'logic' : (c.type || 'undefined');
                        let dataStr = typeof c.data === 'object' ? JSON.stringify(c.data, null, 2) : c.data;
                        md += `- ${typeStr}:\n\`\`\`\n${dataStr}\n\`\`\`\n`;
                    });
                }
                md += `### Effects\n`;
                if (t.triggerEffects) {
                    t.triggerEffects.forEach(e => {
                        let typeStr = e.type || 'undefined';
                        let dataStr = typeof e.data === 'object' ? JSON.stringify(e.data, null, 2) : e.data;
                        md += `- ${typeStr}:\n\`\`\`\n${dataStr}\n\`\`\`\n`;
                    });
                }
                md += `\n`;
            });
        }

        await fs.writeFile(outputPath, md, "utf-8");
        return { content: [{ type: "text", text: `Successfully decompiled world JSON to ${outputPath}` }] };
    }

    if (name === "read_draft_section") {
        const draftPath = path.resolve(args.draftPath);
        let draftContent;
        try { draftContent = await fs.readFile(draftPath, "utf-8"); }
        catch (e) { throw new Error(`Could not read draft file at ${draftPath}`); }

        const sections = draftContent.split(/^#\s+/m).filter(Boolean);
        const targetHeader = args.sectionName.trim().toLowerCase();
        
        for (const section of sections) {
            const lines = section.trim().split('\n');
            const header = lines[0].trim().toLowerCase();
            if (header === targetHeader) {
                const content = lines.slice(1).join('\n').trim();
                return { content: [{ type: "text", text: content }] };
            }
        }
        return { content: [{ type: "text", text: `Section '${args.sectionName}' not found or empty.` }] };
    }

    if (name === "update_draft_section") {
        const draftPath = path.resolve(args.draftPath);
        let draftContent;
        try { draftContent = await fs.readFile(draftPath, "utf-8"); }
        catch (e) { throw new Error(`Could not read draft file at ${draftPath}`); }

        const sectionName = args.sectionName.trim().toLowerCase();
        const newContent = args.newContent;

        const sections = draftContent.split(/^#\s+/m);
        let result = '';
        let found = false;

        if (sections[0] !== '') {
            result += sections[0];
        }

        for (let i = 1; i < sections.length; i++) {
            const lines = sections[i].split('\n');
            const header = lines[0].trim();
            
            if (header.toLowerCase() === sectionName) {
                result += '# ' + header + '\n' + newContent + '\n\n';
                found = true;
            } else {
                result += '# ' + sections[i];
            }
        }

        if (!found) {
            result = result.trim() + `\n\n# ${args.sectionName.trim()}\n${newContent}\n\n`;
        }
        
        await fs.writeFile(draftPath, result.trim() + '\n', "utf-8");
        return { content: [{ type: "text", text: `Successfully updated section '${args.sectionName}' in ${draftPath}` }] };
    }

    throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
