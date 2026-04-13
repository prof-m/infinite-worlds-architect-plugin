import { fs, path, crypto, readWorld, writeWorld, generateId, newUUID, unwrapCodeBlock, normalizeMarkdown, successResponse, ROOT_FIELDS, ENTITY_ARRAYS } from "../helpers.js";

const EVIDENCE_ERROR_MESSAGE =
    "update_draft_section requires an 'evidence' parameter. " +
    "Provide one of: " +
    "(1) a story-data citation starting with 'From Turn #', 'From Story Metadata', 'From Turn Detail', or 'From Turn #N Tracked Item'; " +
    "(2) 'USER_DIRECTED: <paraphrase of the user\\'s instruction>' (min 10 non-whitespace chars after prefix); " +
    "(3) 'CARRY_FORWARD: <reason>' for fields brought forward unchanged (min 10 non-whitespace chars after prefix); " +
    "(4) 'NO_STORY_EVIDENCE: sampled turns [list], nothing relevant found' (min 10 non-whitespace chars after prefix).";

/**
 * Validate the evidence string for update_draft_section.
 * @param {string} evidence
 * @returns {string} Trimmed evidence string on success
 * @throws {Error} If evidence is missing, empty, or does not match a valid kind
 */
function validateEvidence(evidence) {
    if (!evidence || typeof evidence !== 'string' || evidence.trim().length === 0) {
        throw new Error(EVIDENCE_ERROR_MESSAGE);
    }
    const trimmed = evidence.trim();

    // All kinds require at least 10 non-whitespace characters of content after the prefix.
    // Story-citation prefixes use a looser check than USER_DIRECTED/CARRY_FORWARD/NO_STORY_EVIDENCE
    // only in that no ':' is mandated after the prefix — but the minimum-content rule applies uniformly.
    const allPrefixes = [
        'From Turn #',
        'From Story Metadata',
        'From Turn Detail',
        'USER_DIRECTED:',
        'CARRY_FORWARD:',
        'NO_STORY_EVIDENCE:',
    ];
    // Note: "From Turn #N Tracked Item" is a sub-form of "From Turn #" — already covered.

    for (const prefix of allPrefixes) {
        if (trimmed.startsWith(prefix)) {
            const rest = trimmed.slice(prefix.length);
            const nonWsCount = rest.replace(/\s/g, '').length;
            if (nonWsCount < 10) {
                throw new Error(EVIDENCE_ERROR_MESSAGE);
            }
            return trimmed;
        }
    }

    throw new Error(EVIDENCE_ERROR_MESSAGE);
}

/**
 * Encode an evidence string for embedding in an HTML comment (single line).
 * @param {string} s
 * @returns {string}
 */
function encodeEvidenceForComment(s) {
    return s.replace(/\n/g, '\\n').replace(/-->/g, '--&gt;');
}

/**
 * Decode an evidence string extracted from an HTML comment.
 * @param {string} s
 * @returns {string}
 */
function decodeEvidenceFromComment(s) {
    return s.replace(/--&gt;/g, '-->').replace(/\\n/g, '\n');
}

/**
 * Parse a Markdown draft file into a world data structure.
 * @async
 * @param {string} draftPath - Absolute path to the draft_world.md file
 * @returns {Promise<Object>} Parsed world data (partial WorldJSON)
 * @private
 */
async function parseDraft(draftPath) {
    const draftContent = await fs.readFile(draftPath, "utf-8");
    const sections = draftContent.split(/^#\s+/m).filter(Boolean);
    const parsed = {};
    const complex = { possibleCharacters: [], NPCs: [], instructionBlocks: [], loreBookEntries: [], trackedItems: [], triggerEvents: [] };
    const evidenceMap = {}; // keyed by section header (lowercase)

    for (const section of sections) {
        const lines = section.trim().split('\n');
        const header = lines[0].trim().toLowerCase();

        // Strip evidence comment: scan past any leading blank lines after the header,
        // then strip any consecutive evidence comment lines. This tolerates hand-edited
        // drafts with blank-line gaps and duplicate evidence comments (keeps the last).
        let contentStartIndex = 1;
        let i = 1;
        while (i < lines.length && lines[i].trim() === '') i++;
        while (i < lines.length) {
            const evidenceMatch = lines[i].match(/^\s*<!-- evidence: (.*) -->\s*$/);
            if (!evidenceMatch) break;
            evidenceMap[header] = decodeEvidenceFromComment(evidenceMatch[1]);
            i++;
        }
        if (evidenceMap[header] !== undefined) {
            contentStartIndex = i;
        }
        const content = unwrapCodeBlock(lines.slice(contentStartIndex).join('\n').trim());

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
                                    conds.push({ ...data, id: newUUID() });
                                } else {
                                    if (type === 'triggerOnEvent' && typeof data === 'string') data = normalizeMarkdown(data);
                                    conds.push({ type, data, id: newUUID(), category: "condition" });
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
                                effs.push({ type, data, id: newUUID() });
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
    return { ...parsed, ...complex, _evidenceMap: evidenceMap };
}

/**
 * Compare the original world JSON with the current Markdown draft and return a summary of changes.
 * @async
 * @param {Object} args - Function arguments
 * @param {string} args.originalPath - Path to the original world JSON file
 * @param {string} args.draftPath - Path to the current draft_world.md file
 * @returns {Promise<{content: Array<{type: string, text: string}>}>} MCP response with change summary
 */
export async function get_diff_summary(args) {
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
    return successResponse(summary);
}

/**
 * Compile a Markdown draft into a valid world JSON file.
 * @async
 * @param {Object} args - Function arguments
 * @param {string} args.draftPath - Absolute path to the draft_world.md file
 * @param {string} args.outputPath - Absolute path where the world JSON file should be saved
 * @param {string} [args.originalPath] - Optional path to the original world JSON for merging
 * @param {string[]} [args.skills] - Optional array of skill names
 * @param {Array} [args.possibleCharacters] - Optional JSON array of player character objects
 * @param {Array} [args.NPCs] - Optional JSON array of NPC objects
 * @param {Array} [args.instructionBlocks] - Optional JSON array of instruction block objects
 * @param {Array} [args.loreBookEntries] - Optional JSON array of keyword block objects
 * @param {Array} [args.trackedItems] - Optional JSON array of tracked item objects
 * @param {Array} [args.triggerEvents] - Optional JSON array of trigger event objects
 * @returns {Promise<{content: Array<{type: string, text: string}>}>} MCP response confirming compilation
 */
export async function compile_draft(args) {
    const draftPath = path.resolve(args.draftPath);
    const outputPath = path.resolve(args.outputPath);

    // Use shared parser instead of duplicating logic
    const rawDraftData = await parseDraft(draftPath);
    const { _evidenceMap: evidenceMap, ...draftData } = rawDraftData;

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
        title: draftData.title ?? originalData.title ?? "New World",
        description: draftData.description ?? originalData.description ?? "",
        background: draftData.background ?? originalData.background ?? "",
        instructions: draftData.instructions ?? originalData.instructions ?? "",
        authorStyle: draftData.authorStyle ?? originalData.authorStyle ?? "Concise, highly descriptive narrative.",
        firstInput: draftData.firstInput ?? originalData.firstInput ?? "",
        objective: draftData.objective ?? originalData.objective ?? "Explore.",
        nsfw: draftData.nsfw !== undefined ? draftData.nsfw : (originalData.nsfw ?? false),
        contentWarnings: draftData.contentWarnings ?? originalData.contentWarnings ?? "",
        descriptionRequest: draftData.descriptionRequest ?? originalData.descriptionRequest ?? "Always write in first-person point of view, present tense. Write vital state changes into secretInfo.",
        summaryRequest: draftData.summaryRequest ?? originalData.summaryRequest ?? "",
        imageModel: draftData.imageModel ?? originalData.imageModel ?? "manticore",
        imageStyle: draftData.imageStyle ?? originalData.imageStyle ?? "photo_beautiful",
        imageStyleCharacterPre: draftData.imageStyleCharacterPre ?? originalData.imageStyleCharacterPre ?? "",
        imageStyleCharacterPost: draftData.imageStyleCharacterPost ?? originalData.imageStyleCharacterPost ?? "",
        imageStyleNonCharacterPre: draftData.imageStyleNonCharacterPre ?? originalData.imageStyleNonCharacterPre ?? "",
        imageStyleNonCharacterPost: draftData.imageStyleNonCharacterPost ?? originalData.imageStyleNonCharacterPost ?? "",
        victoryCondition: draftData.victoryCondition ?? originalData.victoryCondition ?? "",
        victoryText: draftData.victoryText ?? originalData.victoryText ?? "",
        defeatCondition: draftData.defeatCondition ?? originalData.defeatCondition ?? "",
        defeatText: draftData.defeatText ?? originalData.defeatText ?? "Your adventure ends here. Game over.",
        designNotes: draftData.designNotes ?? originalData.designNotes ?? "",
        canChangeCharacterName: draftData.canChangeCharacterName !== undefined ? draftData.canChangeCharacterName : (originalData.canChangeCharacterName ?? true),
        canChangeCharacterDescription: draftData.canChangeCharacterDescription !== undefined ? draftData.canChangeCharacterDescription : (originalData.canChangeCharacterDescription ?? true),
        canChangeCharacterSkills: draftData.canChangeCharacterSkills !== undefined ? draftData.canChangeCharacterSkills : (originalData.canChangeCharacterSkills ?? true),
        canSelectOtherPortraits: draftData.canSelectOtherPortraits !== undefined ? draftData.canSelectOtherPortraits : (originalData.canSelectOtherPortraits ?? false),
        canCreateNewPortrait: draftData.canCreateNewPortrait !== undefined ? draftData.canCreateNewPortrait : (originalData.canCreateNewPortrait ?? true),
        canChangeTrackedItemsStartingValues: draftData.canChangeTrackedItemsStartingValues !== undefined ? draftData.canChangeTrackedItemsStartingValues : (originalData.canChangeTrackedItemsStartingValues ?? false),
        enableAISpecificInstructionBlocks: draftData.enableAISpecificInstructionBlocks !== undefined ? draftData.enableAISpecificInstructionBlocks : (originalData.enableAISpecificInstructionBlocks ?? false),
        skills: draftData.skills || args.skills || originalData.skills || ["Persuasion", "Observation"]
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
                        else if (!cRes.id) cRes.id = newUUID();
                        return cRes;
                    });
                }
                if (item.triggerEffects) {
                    res.triggerEffects = item.triggerEffects.map((e, idx) => {
                        const oEff = (orig.triggerEffects || [])[idx] || {};
                        const eRes = { ...oEff, ...e };
                        if (oEff.id) eRes.id = oEff.id;
                        else if (!eRes.id) eRes.id = newUUID();
                        return eRes;
                    });
                }
            }
            return res;
        });
    };

    // Tool args override draft-parsed data for complex arrays
    const possibleCharacters = args.possibleCharacters || draftData.possibleCharacters || [];
    const npcs = args.NPCs || draftData.NPCs || [];
    const trackedItems = args.trackedItems || draftData.trackedItems || [];
    const triggerEvents = args.triggerEvents || draftData.triggerEvents || [];
    const instructionBlocks = args.instructionBlocks || draftData.instructionBlocks || [];
    const loreBookEntries = args.loreBookEntries || draftData.loreBookEntries || [];

    if (possibleCharacters.length) newWorld.possibleCharacters = mergeArray('possibleCharacters', possibleCharacters, 'characterId');
    if (npcs.length) newWorld.NPCs = mergeArray('NPCs', npcs);
    if (trackedItems.length) newWorld.trackedItems = mergeArray('trackedItems', trackedItems);
    if (triggerEvents.length) newWorld.triggerEvents = mergeArray('triggerEvents', triggerEvents);
    if (instructionBlocks.length) newWorld.instructionBlocks = mergeArray('instructionBlocks', instructionBlocks);
    if (loreBookEntries.length) newWorld.loreBookEntries = mergeArray('loreBookEntries', loreBookEntries);

    // Final write with literal character preservation
    const json = JSON.stringify(newWorld, null, 2);
    await fs.writeFile(outputPath, json, "utf-8");

    // Evidence audit: warn on sections present in the draft that lack evidence comments
    const draftContent = await fs.readFile(draftPath, "utf-8");
    const draftSections = draftContent.split(/^#\s+/m).filter(Boolean).map(s => s.trim().split('\n')[0].trim().toLowerCase());
    // Exclude meta sections that agents don't supply evidence for
    const skipSections = new Set(['table of contents']);
    const missingSections = draftSections.filter(
        header => !skipSections.has(header) && !evidenceMap[header]
    );

    let responseText = `World compiled successfully from draft to ${outputPath}`;
    if (missingSections.length > 0) {
        const humanReadable = missingSections.map(h => h.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
        responseText += `\n\n⚠️ Evidence audit: ${missingSections.length} field${missingSections.length === 1 ? '' : 's'} lack evidence citations: ${humanReadable.join(', ')}.`;
    }

    return { content: [{ type: "text", text: responseText }] };
}

/**
 * Read a world JSON file and generate a human-readable Markdown draft file.
 * @async
 * @param {Object} args - Function arguments
 * @param {string} args.inputPath - Absolute path to the world JSON file to read
 * @param {string} args.outputPath - Absolute path where the draft_world.md file should be saved
 * @returns {Promise<{content: Array<{type: string, text: string}>}>} MCP response confirming decompilation
 */
export async function decompile_json(args) {
    const inputPath = path.resolve(args.inputPath);
    const outputPath = path.resolve(args.outputPath);

    let world;
    try {
        const fileData = await fs.readFile(inputPath, "utf-8");
        world = JSON.parse(fileData);
    } catch (e) {
        throw new Error(`Could not read or parse world JSON file at ${inputPath}`);
    }

    // Seeded evidence for decompiled sections: every section written by decompile_json
    // is a direct carry-forward from the source world JSON. This keeps the compile-time
    // evidence audit clean on fresh drafts and reserves warnings for sections the agent
    // actually modified (which it must do via update_draft_section with fresh evidence).
    const CF = `<!-- evidence: CARRY_FORWARD: decompiled from original world JSON -->\n`;

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

    md += `# Title\n${CF}${world.title || ""}\n\n`;
    md += `# Description\n${CF}${world.description || ""}\n\n`;
    md += `# Background\n${CF}${world.background || ""}\n\n`;
    md += `# First Action\n${CF}${world.firstInput || ""}\n\n`;
    md += `# Objective\n${CF}${world.objective || ""}\n\n`;
    md += `# Main Instructions\n${CF}${world.instructions || ""}\n\n`;
    md += `# Author Style\n${CF}${world.authorStyle || ""}\n\n`;
    md += `# NSFW\n${CF}${world.nsfw ? "true" : "false"}\n\n`;
    md += `# Content Warnings\n${CF}${world.contentWarnings || ""}\n\n`;
    md += `# Description Request\n${CF}${world.descriptionRequest || ""}\n\n`;
    md += `# Summary Request\n${CF}${world.summaryRequest || ""}\n\n`;
    md += `# Image Model\n${CF}${world.imageModel || ""}\n\n`;
    md += `# Image Style\n${CF}${world.imageStyle || ""}\n\n`;
    md += `# Image Style Character Pre\n${CF}${world.imageStyleCharacterPre || ""}\n\n`;
    md += `# Image Style Character Post\n${CF}${world.imageStyleCharacterPost || ""}\n\n`;
    md += `# Image Style Non Character Pre\n${CF}${world.imageStyleNonCharacterPre || ""}\n\n`;
    md += `# Image Style Non Character Post\n${CF}${world.imageStyleNonCharacterPost || ""}\n\n`;

    md += `# Victory Condition\n${CF}${world.victoryCondition || ""}\n\n`;
    md += `# Victory Text\n${CF}${world.victoryText || ""}\n\n`;
    md += `# Defeat Condition\n${CF}${world.defeatCondition || ""}\n\n`;
    md += `# Defeat Text\n${CF}${world.defeatText || ""}\n\n`;
    md += `# Design Notes\n${CF}${world.designNotes || ""}\n\n`;
    md += `# Player Permissions\n${CF}`;
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
    return successResponse(`Successfully decompiled world JSON to ${outputPath}`);
}

/**
 * Read the content of a specific section from a Markdown draft file.
 * @async
 * @param {Object} args - Function arguments
 * @param {string} args.draftPath - Absolute path to the draft_world.md file
 * @param {string} args.sectionName - Name of the header (without the '#' symbol)
 * @returns {Promise<{content: Array<{type: string, text: string}>}>} MCP response with section content
 */
export async function read_draft_section(args) {
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
            // Strip evidence comment(s): tolerate blank lines between header and comment,
            // and strip any consecutive duplicate evidence comments (malformed drafts).
            let startIdx = 1;
            while (startIdx < lines.length && lines[startIdx].trim() === '') startIdx++;
            while (startIdx < lines.length && lines[startIdx].match(/^\s*<!-- evidence: .* -->\s*$/)) {
                startIdx++;
            }
            const content = lines.slice(startIdx).join('\n').trim();
            return successResponse(content);
        }
    }
    return successResponse(`Section '${args.sectionName}' not found or empty.`);
}

/**
 * Update the content of a specific section in a Markdown draft file.
 * @async
 * @param {Object} args - Function arguments
 * @param {string} args.draftPath - Absolute path to the draft_world.md file
 * @param {string} args.sectionName - Name of the header (without the '#' symbol)
 * @param {string} args.newContent - The new content to place under the header
 * @param {string} args.evidence - Required evidence citation (story-data, USER_DIRECTED, CARRY_FORWARD, or NO_STORY_EVIDENCE)
 * @returns {Promise<{content: Array<{type: string, text: string}>}>} MCP response confirming update
 */
export async function update_draft_section(args) {
    const draftPath = path.resolve(args.draftPath);

    // Validate evidence first — before even reading the file
    const validated = validateEvidence(args.evidence);
    const encodedEvidence = encodeEvidenceForComment(validated);
    const evidenceComment = `<!-- evidence: ${encodedEvidence} -->`;

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
            // Write section with evidence comment; replaces any existing evidence comment
            result += '# ' + header + '\n' + evidenceComment + '\n' + newContent + '\n\n';
            found = true;
        } else {
            result += '# ' + sections[i];
        }
    }

    if (!found) {
        result = result.trim() + `\n\n# ${args.sectionName.trim()}\n${evidenceComment}\n${newContent}\n\n`;
    }

    await fs.writeFile(draftPath, result.trim() + '\n', "utf-8");
    return successResponse(`Successfully updated section '${args.sectionName}' in ${draftPath}`);
}
