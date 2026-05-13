import { fs, path, crypto, readWorld, writeWorld, generateId, newUUID, unwrapCodeBlock, normalizeMarkdown, successResponse, ROOT_FIELDS, ENTITY_ARRAYS } from "../helpers.js";
import { acquireDraftLock } from "../locks.js";

export const CONTAINER_SECTIONS = [
    'possible characters',
    'other characters',
    'extra instruction blocks',
    'keyword instruction blocks',
    'tracked items',
    'trigger events',
];

/**
 * Split a container section's body into sub-fields, tracking fenced code blocks
 * so that `## ` lines inside fences are not treated as sub-field boundaries.
 * @param {string} sectionBody - Content of the section after the `# SectionName` heading line
 * @returns {Array<{name: string, headerLine: string, body: string}>}
 */
export function splitSubFields(sectionBody) {
    const lines = sectionBody.split('\n');
    const result = [];
    let current = null;
    let inFence = false;
    let fenceChar = '';

    for (const line of lines) {
        // Toggle fence tracking
        const trimmed = line.trimEnd();
        if (!inFence) {
            if (/^(`{3,}|~{3,})/.test(trimmed)) {
                inFence = true;
                fenceChar = trimmed.match(/^(`{3,}|~{3,})/)[1][0];
            }
        } else {
            const closingPattern = new RegExp(`^[${fenceChar === '`' ? '`' : '~'}]{3,}\\s*$`);
            if (closingPattern.test(trimmed)) {
                inFence = false;
            }
        }

        if (!inFence && /^##\s+/.test(line)) {
            if (current !== null) {
                current.body = current.body.trimEnd();
                result.push(current);
            }
            const name = line.replace(/^##\s+/, '').trim();
            current = { name, headerLine: line, body: '' };
        } else if (current !== null) {
            current.body += line + '\n';
        }
        // Lines before the first ## heading are ignored (they belong to the section header area)
    }
    if (current !== null) {
        current.body = current.body.trimEnd();
        result.push(current);
    }
    return result;
}

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
 * Returns true if the draft content begins with the story_grounded marker
 * (blank leading lines are tolerated).
 * @param {string} content
 * @returns {boolean}
 */
function hasStoryGroundedMarker(content) {
    const lines = content.split('\n');
    for (const line of lines) {
        if (line.trim() === '') continue;
        return line.trim() === '<!-- draft_mode: story_grounded -->';
    }
    return false;
}

/**
 * Parse a Markdown draft file into a world data structure.
 * @async
 * @param {string} draftPath - Absolute path to the draft_world.md file
 * @param {string} [rawContent] - Optional pre-read file content; if provided the file is not read again
 * @returns {Promise<Object>} Parsed world data (partial WorldJSON)
 * @private
 */
async function parseDraft(draftPath, rawContent) {
    const draftContent = rawContent !== undefined ? rawContent : await fs.readFile(draftPath, "utf-8");
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
        else if (CONTAINER_SECTIONS.includes(header)) {
            const sfEntries = splitSubFields(content);
            const parsedItems = [];
            for (const sf of sfEntries) {
                const itemName = sf.name;
                // Strip leading per-sub-field evidence comment from body and record it
                const sfBodyLines = sf.body.split('\n');
                let sfBodyStart = 0;
                while (sfBodyStart < sfBodyLines.length && sfBodyLines[sfBodyStart].trim() === '') sfBodyStart++;
                while (sfBodyStart < sfBodyLines.length) {
                    const evMatch = sfBodyLines[sfBodyStart].match(/^\s*<!-- evidence: (.*) -->\s*$/);
                    if (!evMatch) break;
                    evidenceMap[`${header}::${itemName.toLowerCase().trim()}`] = decodeEvidenceFromComment(evMatch[1]);
                    sfBodyStart++;
                }
                const itemContent = sfBodyLines.slice(sfBodyStart).join('\n').trim();
                const itemFields = {};
                if (itemContent.includes('### ')) {
                    const subSections = itemContent.split(/^###\s+/m).filter(Boolean);
                    for (const sub of subSections) {
                        const subLines = sub.trim().split('\n');
                        const subHeader = subLines[0].trim();
                        const subContent = unwrapCodeBlock(subLines.slice(1).join('\n').trim());
                        itemFields[subHeader] = subContent;
                    }
                } else {
                    const regex = /^([\w\s]+):\s*(.*(?:\n(?!(?:[\w\s]+):).*)*)/gm;
                    let match;
                    while ((match = regex.exec(itemContent)) !== null) {
                        itemFields[match[1].trim()] = unwrapCodeBlock(match[2].trim());
                    }
                }
                if (header === 'possible characters') {
                    const itemObj = { name: itemName, description: itemFields['Description'] || "", portrait: itemFields['Portrait'] || "" };
                    if ('Skills' in itemFields) {
                        const s = {};
                        itemFields['Skills'].split('\n').forEach(line => {
                            const match = line.match(/^[-*]?\s*(.*?):\s*(\d+)/);
                            if (match) s[match[1].trim()] = parseInt(match[2].trim(), 10);
                        });
                        itemObj.skills = s;
                    }
                    parsedItems.push(itemObj);
                } else if (header === 'other characters') {
                    parsedItems.push({ name: itemName, one_liner: itemFields['Brief Summary'] || "", detail: itemFields['Character Detail'] || "", appearance: itemFields['Appearance'] || "", location: itemFields['Location'] || "", secret_info: itemFields['Secret Information'] || "", names: itemFields['Full List of Names'] ? itemFields['Full List of Names'].split(',').map(n => n.trim()) : [], img_appearance: itemFields['Image Appearance'] || "", img_clothing: itemFields['Image Clothing'] || "" });
                } else if (header === 'extra instruction blocks' || header === 'keyword instruction blocks') {
                    const block = { name: itemName, content: normalizeMarkdown(unwrapCodeBlock(itemFields['Content'] || itemContent)) };
                    if (header === 'keyword instruction blocks' || itemFields['Keywords']) block.keywords = itemFields['Keywords'] ? itemFields['Keywords'].split(',').map(k => k.trim()) : [];
                    parsedItems.push(block);
                } else if (header === 'tracked items') {
                    parsedItems.push({ name: itemName, dataType: itemFields['Data Type'] || "text", visibility: itemFields['Visibility'] || "everyone", description: itemFields['Description'] || "", updateInstructions: normalizeMarkdown(itemFields['Update Instructions'] || ""), initialValue: itemFields['Initial Value'] || "" });
                } else if (header === 'trigger events') {
                    const itemObj = { name: itemName };
                    if ('Conditions' in itemFields) {
                        const conds = [];
                        const blocks = itemFields['Conditions'].split(/^[-*]\s+/m).filter(Boolean);
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
                    if ('Effects' in itemFields) {
                        const effs = [];
                        const blocks = itemFields['Effects'].split(/^[-*]\s+/m).filter(Boolean);
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
                    if ('Can Trigger More Than Once' in itemFields) {
                        itemObj.canTriggerMoreThanOnce = itemFields['Can Trigger More Than Once'].trim().toLowerCase() === 'true';
                    }
                    if ('Prerequisites' in itemFields) {
                        itemObj.prerequisites = itemFields['Prerequisites'].split(',').map(s => s.trim()).filter(Boolean);
                    }
                    if ('Blockers' in itemFields) {
                        itemObj.blockers = itemFields['Blockers'].split(',').map(s => s.trim()).filter(Boolean);
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
    const fields = ['title', 'description', 'background', 'firstInput', 'objective', 'instructions', 'authorStyle', 'nsfw', 'contentWarnings', 'descriptionRequest', 'summaryRequest', 'imageModel', 'imageStyle', 'imageStyleCharacterPre', 'imageStyleCharacterPost', 'imageStyleNonCharacterPre', 'imageStyleNonCharacterPost', 'designNotes', 'canChangeCharacterName', 'canChangeCharacterDescription', 'canChangeCharacterSkills', 'canSelectOtherPortraits', 'canCreateNewPortrait', 'canChangeTrackedItemsStartingValues', 'enableAISpecificInstructionBlocks'];

    for (const f of fields) {
        if (JSON.stringify(original[f]) !== JSON.stringify(current[f])) {
            changes.push(`- Field [${f}] was modified.`);
        }
    }

    // victoryCondition and defeatCondition are objects in world JSON but flat strings in parseDraft output
    if (original.victoryCondition?.condition !== current.victoryCondition) changes.push(`- Field [victoryCondition.condition] was modified.`);
    if (original.victoryCondition?.text !== current.victoryText) changes.push(`- Field [victoryCondition.text] was modified.`);
    if (original.defeatCondition?.condition !== current.defeatCondition) changes.push(`- Field [defeatCondition.condition] was modified.`);
    if (original.defeatCondition?.text !== current.defeatText) changes.push(`- Field [defeatCondition.text] was modified.`);

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

    // Read the file once; pass raw content to both parseDraft and hasStoryGroundedMarker
    const draftFileContent = await fs.readFile(draftPath, "utf-8");
    const rawDraftData = await parseDraft(draftPath, draftFileContent);
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
        victoryCondition: {
            condition: draftData.victoryCondition ?? originalData.victoryCondition?.condition ?? "",
            text: draftData.victoryText ?? originalData.victoryCondition?.text ?? "",
            // alreadyFired is runtime state set by the game engine — not author-editable via the draft
            alreadyFired: originalData.victoryCondition?.alreadyFired ?? false
        },
        defeatCondition: {
            condition: draftData.defeatCondition ?? originalData.defeatCondition?.condition ?? "",
            text: draftData.defeatText ?? originalData.defeatCondition?.text ?? "Your adventure ends here. Game over.",
            // alreadyFired is runtime state set by the game engine — not author-editable via the draft
            alreadyFired: originalData.defeatCondition?.alreadyFired ?? false
        },
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
    if (npcs.length) newWorld.NPCs = mergeArray('NPCs', npcs).map((item, idx) => ({
        ...item,
        positionInList: item.positionInList ?? idx,
    }));
    if (trackedItems.length) newWorld.trackedItems = mergeArray('trackedItems', trackedItems).map((item, idx) => ({
        autoUpdate: true,
        initialValueBasedOnPC: "same",
        ...item,
        positionInList: item.positionInList ?? idx,
    }));
    if (triggerEvents.length) newWorld.triggerEvents = mergeArray('triggerEvents', triggerEvents);
    if (instructionBlocks.length) newWorld.instructionBlocks = mergeArray('instructionBlocks', instructionBlocks);
    if (loreBookEntries.length) newWorld.loreBookEntries = mergeArray('loreBookEntries', loreBookEntries);

    // Final write with literal character preservation
    const json = JSON.stringify(newWorld, null, 2);
    await fs.writeFile(outputPath, json, "utf-8");

    let responseText = `World compiled successfully from draft to ${outputPath}`;

    if (hasStoryGroundedMarker(draftFileContent)) {
        // Evidence audit: warn on sections present in the draft that lack evidence comments
        const draftSections = draftFileContent.split(/^#\s+/m).filter(Boolean).map(s => s.trim().split('\n')[0].trim().toLowerCase());
        // Exclude meta sections that agents don't supply evidence for,
        // and non-section fragments (e.g. the story_grounded marker before the first heading)
        const skipSections = new Set(['table of contents']);
        const missingSections = draftSections.filter(
            header => !skipSections.has(header) && !header.startsWith('<') && !evidenceMap[header]
        );

        if (missingSections.length > 0) {
            const humanReadable = missingSections.map(h => h.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
            responseText += `\n\n⚠️ Evidence audit: ${missingSections.length} field${missingSections.length === 1 ? '' : 's'} lack evidence citations: ${humanReadable.join(', ')}.`;
        }
    } else {
        // Check for stray evidence comments on an unmarked draft
        if (/<!-- evidence:/.test(draftFileContent)) {
            responseText += `\n\n⚠️ This draft contains evidence citations but lacks the story_grounded marker. Enforcement is off. Run enable_story_grounded_mode if this draft should require evidence.`;
        }
    }

    return { content: [{ type: "text", text: responseText }] };
}

/**
 * Prepend the story_grounded marker to a draft file, enabling evidence enforcement.
 * Idempotent — safe to call more than once.
 * @async
 * @param {Object} args - Function arguments
 * @param {string} args.draftPath - Absolute path to the draft markdown file
 * @returns {Promise<{content: Array<{type: string, text: string}>}>} MCP response
 */
export async function enable_story_grounded_mode({ draftPath }) {
    const resolvedPath = path.resolve(draftPath);
    const release = await acquireDraftLock(resolvedPath);
    try {
        let content;
        try { content = await fs.readFile(resolvedPath, 'utf-8'); }
        catch (e) { throw new Error(`Could not read draft file at ${resolvedPath}`); }

        if (hasStoryGroundedMarker(content)) {
            return { content: [{ type: 'text', text: 'Draft is already in story_grounded mode.' }] };
        }
        const marker = '<!-- draft_mode: story_grounded -->\n';
        await fs.writeFile(resolvedPath, marker + content, 'utf-8');
        return { content: [{ type: 'text', text: 'Story grounded mode enabled. All subsequent update_draft_section calls on this draft will require evidence.' }] };
    } finally {
        release();
    }
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

    md += `# Victory Condition\n${world.victoryCondition?.condition || ""}\n\n`;
    md += `# Victory Text\n${world.victoryCondition?.text || ""}\n\n`;
    md += `# Defeat Condition\n${world.defeatCondition?.condition || ""}\n\n`;
    md += `# Defeat Text\n${world.defeatCondition?.text || ""}\n\n`;
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
            if (t.canTriggerMoreThanOnce === true) md += `### Can Trigger More Than Once\ntrue\n\n`;
            if (t.prerequisites && t.prerequisites.length) md += `### Prerequisites\n${t.prerequisites.join(', ')}\n\n`;
            if (t.blockers && t.blockers.length) md += `### Blockers\n${t.blockers.join(', ')}\n\n`;
            if (!t.canTriggerMoreThanOnce && !(t.prerequisites && t.prerequisites.length) && !(t.blockers && t.blockers.length)) md += `\n`;
        });
    }

    await fs.writeFile(outputPath, md, "utf-8");
    return successResponse(`Successfully decompiled world JSON to ${outputPath}`);
}

/**
 * Read the content of a specific section (and optionally a sub-field) from a Markdown draft file.
 * @async
 * @param {Object} args - Function arguments
 * @param {string} args.draftPath - Absolute path to the draft_world.md file
 * @param {string} args.sectionName - Name of the header (without the '#' symbol)
 * @param {string} [args.subField] - Optional sub-field name within a container section
 * @returns {Promise<{content: Array<{type: string, text: string}>}>} MCP response with section content
 */
export async function read_draft_section(args) {
    const draftPath = path.resolve(args.draftPath);
    let draftContent;
    try { draftContent = await fs.readFile(draftPath, "utf-8"); }
    catch (e) { throw new Error(`Could not read draft file at ${draftPath}`); }

    const sections = draftContent.split(/^#\s+/m).filter(Boolean);
    const targetHeader = args.sectionName.trim().toLowerCase();
    const subFieldArg = args.subField && args.subField.trim() ? args.subField.trim() : null;

    for (const section of sections) {
        const lines = section.trim().split('\n');
        const header = lines[0].trim().toLowerCase();
        if (header === targetHeader) {
            // Strip section-level evidence comment(s)
            let startIdx = 1;
            while (startIdx < lines.length && lines[startIdx].trim() === '') startIdx++;
            while (startIdx < lines.length && lines[startIdx].match(/^\s*<!-- evidence: .* -->\s*$/)) {
                startIdx++;
            }
            const sectionBody = lines.slice(startIdx).join('\n').trim();

            if (subFieldArg !== null) {
                if (!CONTAINER_SECTIONS.includes(header)) {
                    throw new Error(`Section '${args.sectionName}' is not a container field. The 'subField' parameter only applies to container sections: ${CONTAINER_SECTIONS.map(s => s.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')).join(', ')}.`);
                }
                const sfEntries = splitSubFields(sectionBody);
                const match = sfEntries.find(sf => sf.name.toLowerCase().trim() === subFieldArg.toLowerCase());
                if (!match) {
                    return successResponse(`Sub-field '${args.subField}' not found in section '${args.sectionName}'.`);
                }
                // Strip per-sub-field evidence comment from body
                const bodyLines = match.body.split('\n');
                let bodyStart = 0;
                while (bodyStart < bodyLines.length && bodyLines[bodyStart].trim() === '') bodyStart++;
                while (bodyStart < bodyLines.length && bodyLines[bodyStart].match(/^\s*<!-- evidence: .* -->\s*$/)) {
                    bodyStart++;
                }
                return successResponse(bodyLines.slice(bodyStart).join('\n').trim());
            }

            return successResponse(sectionBody);
        }
    }
    return successResponse(`Section '${args.sectionName}' not found or empty.`);
}

/**
 * Strip leading injected evidence comments from a content string.
 * Prevents callers from embedding fake evidence that would shadow the validated one.
 * @param {string} content
 * @returns {string}
 */
function stripLeadingEvidenceComments(content) {
    const lines = content.split('\n');
    let idx = 0;
    while (idx < lines.length && lines[idx].trim() === '') idx++;
    const firstContentIdx = idx;
    while (idx < lines.length && /^\s*<!-- evidence:.*-->\s*$/.test(lines[idx])) idx++;
    return idx > firstContentIdx ? lines.slice(idx).join('\n') : content;
}

/**
 * Update the content of a specific section (or sub-field within a container section) in a Markdown draft file.
 * @async
 * @param {Object} args - Function arguments
 * @param {string} args.draftPath - Absolute path to the draft_world.md file
 * @param {string} args.sectionName - Name of the header (without the '#' symbol)
 * @param {string} [args.subField] - For container sections: the sub-field name to update (required for containers)
 * @param {string} args.newContent - The new content to place under the header (or sub-field)
 * @param {string} args.evidence - Required evidence citation (story-data, USER_DIRECTED, CARRY_FORWARD, or NO_STORY_EVIDENCE)
 * @returns {Promise<{content: Array<{type: string, text: string}>}>} MCP response confirming update
 */
export async function update_draft_section(args) {
    const draftPath = path.resolve(args.draftPath);
    const release = await acquireDraftLock(draftPath);
    try {

    let draftContent;
    try { draftContent = await fs.readFile(draftPath, "utf-8"); }
    catch (e) { throw new Error(`Could not read draft file at ${draftPath}`); }

    const grounded = hasStoryGroundedMarker(draftContent);

    let evidenceComment = null;
    if (grounded) {
        const validated = validateEvidence(args.evidence);
        const encodedEvidence = encodeEvidenceForComment(validated);
        evidenceComment = `<!-- evidence: ${encodedEvidence} -->`;
    }

    const sectionName = args.sectionName.trim().toLowerCase();
    const subFieldArg = args.subField && args.subField.trim() ? args.subField.trim() : null;
    const isContainer = CONTAINER_SECTIONS.includes(sectionName);

    // Enforce subField requirement for container sections
    if (isContainer && !subFieldArg) {
        throw new Error(
            `sectionName '${args.sectionName}' is a container field and requires a 'subField' parameter identifying which sub-field to update. ` +
            `Use create_sub_field to add a new sub-field. ` +
            `See skills/sequel-world/SKILL.md § "Sub-field rule for container fields".`
        );
    }

    let newContent = args.newContent;
    if (grounded) {
        newContent = stripLeadingEvidenceComments(newContent);
    }

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
            found = true;
            if (!isContainer) {
                // Non-container: whole-section overwrite (existing behaviour)
                if (evidenceComment) {
                    result += '# ' + header + '\n' + evidenceComment + '\n' + newContent + '\n\n';
                } else {
                    result += '# ' + header + '\n' + newContent + '\n\n';
                }
            } else {
                // Container: surgical sub-field replace
                // Preserve any section-level content before first ## (e.g. section-level evidence comment)
                let sectionPreamble = '';
                let sectionBodyStart = 1;
                while (sectionBodyStart < lines.length && lines[sectionBodyStart].trim() === '') sectionBodyStart++;
                while (sectionBodyStart < lines.length && /^\s*<!-- evidence:.*-->\s*$/.test(lines[sectionBodyStart])) {
                    sectionBodyStart++;
                }
                // Re-include preamble lines (blank + section-level evidence) verbatim
                sectionPreamble = lines.slice(1, sectionBodyStart).join('\n');

                const bodyAfterHeader = lines.slice(1).join('\n');
                const sfEntries = splitSubFields(bodyAfterHeader);
                const sfNorm = subFieldArg.toLowerCase();
                const matchIdx = sfEntries.findIndex(sf => sf.name.toLowerCase().trim() === sfNorm);

                if (matchIdx === -1) {
                    throw new Error(
                        `Sub-field '${args.subField}' not found in section '${args.sectionName}'. ` +
                        `Use create_sub_field to add it. ` +
                        `See skills/sequel-world/SKILL.md § "Sub-field rule for container fields".`
                    );
                }

                // Reassemble: each sub-field with its original heading casing preserved
                let sectionOut = '# ' + header + '\n';
                if (sectionPreamble) sectionOut += sectionPreamble + '\n';
                for (let j = 0; j < sfEntries.length; j++) {
                    const sf = sfEntries[j];
                    if (j === matchIdx) {
                        // Write updated sub-field with evidence beneath the ## heading
                        if (evidenceComment) {
                            sectionOut += sf.headerLine + '\n' + evidenceComment + '\n' + newContent + '\n';
                        } else {
                            sectionOut += sf.headerLine + '\n' + newContent + '\n';
                        }
                    } else {
                        // Preserve unchanged sub-field byte-identically
                        sectionOut += sf.headerLine + '\n' + sf.body + '\n';
                    }
                }
                result += sectionOut + '\n';
            }
        } else {
            result += '# ' + sections[i];
        }
    }

    if (!found) {
        if (isContainer) {
            throw new Error(`Section '${args.sectionName}' not found in draft. Cannot update a missing container section.`);
        }
        if (evidenceComment) {
            result = result.trim() + `\n\n# ${args.sectionName.trim()}\n${evidenceComment}\n${newContent}\n\n`;
        } else {
            result = result.trim() + `\n\n# ${args.sectionName.trim()}\n${newContent}\n\n`;
        }
    }

    await fs.writeFile(draftPath, result.trim() + '\n', "utf-8");
    const target = subFieldArg ? `sub-field '${args.subField}' in section '${args.sectionName}'` : `section '${args.sectionName}'`;
    return successResponse(`Successfully updated ${target} in ${draftPath}`);

    } finally {
        release();
    }
}

/**
 * Patch a single labeled field within a sub-field body.
 * Handles both H3-subheader format (`### fieldName\nvalue`) and Key:Value format (`fieldName: value`).
 * Uses a single fence-aware pass so that `### ` or `Key: Value` lines inside fenced code blocks
 * are never matched. Preserves trailing blank lines between the patched field and the next H3 header.
 * If the field is not found, it is inserted at the end using the body's existing format (H3 preferred
 * for empty bodies per draft_schema.md; KV only when body has KV pairs but no H3 headers).
 * @param {string} body - Sub-field body (content after the `## Heading` line)
 * @param {string} fieldName - Labeled field to target
 * @param {string} newValue - Replacement value
 * @returns {{ result: string, inserted: boolean }}
 */
function patchFieldInBody(body, fieldName, newValue) {
    const lines = body.split('\n');
    const fieldNameLower = fieldName.trim().toLowerCase();
    const escapedName = fieldName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const kvPattern = new RegExp(`^(${escapedName})(:\\s*)(.*)$`, 'i');

    // Single fence-aware pass: collect H3 match position, next-H3 boundary, KV match, and
    // whether any real (non-fenced) H3 headers exist (needed for insert-format detection).
    let inFence = false;
    let fenceChar = '';
    let fenceCloseRe = null;
    let h3MatchLine = -1;
    let nextH3Line = -1;
    let kvMatchLine = -1;
    let kvMatch = null;
    let hasRealH3 = false; // any ### outside a fence

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trimEnd();
        if (!inFence) {
            if (/^(`{3,}|~{3,})/.test(trimmed)) {
                inFence = true;
                fenceChar = trimmed.match(/^(`{3,}|~{3,})/)[1][0];
                fenceCloseRe = new RegExp(`^[${fenceChar === '`' ? '`' : '~'}]{3,}\\s*$`);
            }
        } else {
            if (fenceCloseRe.test(trimmed)) { inFence = false; fenceChar = ''; fenceCloseRe = null; }
        }

        if (!inFence) {
            if (/^###\s+/.test(lines[i])) {
                hasRealH3 = true;
                const h3Name = lines[i].replace(/^###\s+/, '').trim().toLowerCase();
                if (h3MatchLine === -1 && h3Name === fieldNameLower) {
                    h3MatchLine = i;
                } else if (h3MatchLine !== -1 && nextH3Line === -1) {
                    nextH3Line = i;
                }
            } else if (kvMatchLine === -1) {
                const m = kvPattern.exec(lines[i]);
                if (m) { kvMatchLine = i; kvMatch = m; }
            }
        }
    }

    // H3 match takes precedence
    if (h3MatchLine !== -1) {
        const contentEnd = nextH3Line !== -1 ? nextH3Line : lines.length;
        let trailingBlanks = 0;
        for (let i = contentEnd - 1; i > h3MatchLine; i--) {
            if (lines[i].trim() === '') trailingBlanks++;
            else break;
        }
        const trailing = Array(trailingBlanks).fill('');
        const before = lines.slice(0, h3MatchLine + 1);
        const after = lines.slice(contentEnd);
        return {
            result: [...before, newValue.trimEnd(), ...trailing, ...after].join('\n'),
            inserted: false,
        };
    }

    if (kvMatchLine !== -1) {
        const newLines = lines.slice();
        newLines[kvMatchLine] = `${kvMatch[1]}${kvMatch[2]}${newValue}`;
        return { result: newLines.join('\n'), inserted: false };
    }

    // Not found — insert at end using detected format
    const bodyIsEmpty = lines.every(l => l.trim() === '');
    const toInsert = (hasRealH3 || bodyIsEmpty)
        ? `### ${fieldName.trim()}\n${newValue}`
        : `${fieldName.trim()}: ${newValue}`;
    const trimmedBody = body.trimEnd();
    const sep = trimmedBody.length > 0 ? '\n' : '';
    return { result: `${trimmedBody}${sep}\n${toInsert}`, inserted: true };
}

/**
 * Patch a single labeled field within a draft sub-field without rewriting the entire sub-field body.
 * Only works on container sections (Possible Characters, Other Characters, Extra Instruction Blocks,
 * Keyword Instruction Blocks, Tracked Items, Trigger Events).
 * If the target field does not exist in the sub-field body, it is inserted at the end.
 * @async
 * @param {Object} args
 * @param {string} args.draftPath - Absolute path to the draft .md file
 * @param {string} args.sectionName - Top-level container section (e.g. 'Keyword Instruction Blocks')
 * @param {string} args.subField - Sub-field name within the section (e.g. 'Honeyveil Blossom')
 * @param {string} args.fieldName - Labeled field to patch within the sub-field body (e.g. 'Keywords')
 * @param {string} args.newValue - Replacement value for the targeted field
 * @param {string} [args.evidence] - Required for story_grounded drafts
 * @returns {Promise<{content: Array<{type: string, text: string}>}>}
 */
export async function update_draft_field(args) {
    const draftPath = path.resolve(args.draftPath);
    const release = await acquireDraftLock(draftPath);
    try {

    let draftContent;
    try { draftContent = await fs.readFile(draftPath, 'utf-8'); }
    catch (e) { throw new Error(`Could not read draft file at ${draftPath}`); }

    const grounded = hasStoryGroundedMarker(draftContent);
    let evidenceComment = null;
    if (grounded) {
        const validated = validateEvidence(args.evidence);
        evidenceComment = `<!-- evidence: ${encodeEvidenceForComment(validated)} -->`;
    }

    const sectionName = args.sectionName.trim().toLowerCase();
    const subFieldArg = args.subField && args.subField.trim() ? args.subField.trim() : null;
    const fieldName = args.fieldName && args.fieldName.trim();
    const newValue = args.newValue;

    if (!CONTAINER_SECTIONS.includes(sectionName)) {
        throw new Error(
            `update_draft_field only works on container sections ` +
            `(${CONTAINER_SECTIONS.map(s => s.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')).join(', ')}). ` +
            `'${args.sectionName}' is not a container section.`
        );
    }
    if (!subFieldArg) {
        throw new Error(`'subField' parameter is required.`);
    }
    if (!fieldName) {
        throw new Error(`'fieldName' parameter is required.`);
    }

    const sections = draftContent.split(/^#\s+/m);
    let result = '';
    let found = false;
    let wasInserted = false;

    if (sections[0] !== '') result += sections[0];

    for (let i = 1; i < sections.length; i++) {
        const lines = sections[i].split('\n');
        const header = lines[0].trim();

        if (header.toLowerCase() === sectionName) {
            found = true;

            const bodyAfterHeader = lines.slice(1).join('\n');
            const sfEntries = splitSubFields(bodyAfterHeader);
            const sfNorm = subFieldArg.toLowerCase();
            const matchIdx = sfEntries.findIndex(sf => sf.name.toLowerCase().trim() === sfNorm);

            if (matchIdx === -1) {
                throw new Error(
                    `Sub-field '${args.subField}' not found in section '${args.sectionName}'. ` +
                    `Use create_sub_field to add it.`
                );
            }

            const sf = sfEntries[matchIdx];
            const bodyToProcess = grounded ? stripLeadingEvidenceComments(sf.body) : sf.body;
            const { result: patchedBody, inserted } = patchFieldInBody(bodyToProcess, fieldName, newValue);
            wasInserted = inserted;

            // Preserve section preamble (blank lines + section-level evidence comments)
            let sectionBodyStart = 1;
            while (sectionBodyStart < lines.length && lines[sectionBodyStart].trim() === '') sectionBodyStart++;
            while (sectionBodyStart < lines.length && /^\s*<!-- evidence:.*-->\s*$/.test(lines[sectionBodyStart])) {
                sectionBodyStart++;
            }
            const sectionPreamble = lines.slice(1, sectionBodyStart).join('\n');

            let sectionOut = '# ' + header + '\n';
            if (sectionPreamble) sectionOut += sectionPreamble + '\n';

            for (let j = 0; j < sfEntries.length; j++) {
                const sfEntry = sfEntries[j];
                if (j === matchIdx) {
                    if (evidenceComment) {
                        sectionOut += sfEntry.headerLine + '\n' + evidenceComment + '\n' + patchedBody + '\n';
                    } else {
                        sectionOut += sfEntry.headerLine + '\n' + patchedBody + '\n';
                    }
                } else {
                    sectionOut += sfEntry.headerLine + '\n' + sfEntry.body + '\n';
                }
            }
            result += sectionOut + '\n';
        } else {
            result += '# ' + sections[i];
        }
    }

    if (!found) {
        throw new Error(`Section '${args.sectionName}' not found in draft.`);
    }

    await fs.writeFile(draftPath, result.trim() + '\n', 'utf-8');
    const action = wasInserted ? 'inserted' : 'patched';
    return successResponse(
        `Successfully ${action} field '${args.fieldName}' in sub-field '${args.subField}' ` +
        `(section '${args.sectionName}') in ${draftPath}`
    );

    } finally {
        release();
    }
}

/**
 * Append a new sub-field to a container section in a Markdown draft file.
 * Throws if the section is not a container, or if a sub-field with that name already exists.
 * @async
 * @param {Object} args
 * @param {string} args.draftPath
 * @param {string} args.sectionName
 * @param {string} args.subField - Name for the new sub-field
 * @param {string} args.newContent - Body content (do NOT include the `##` heading)
 * @param {string} [args.evidence] - Required for story_grounded drafts
 * @returns {Promise<{content: Array<{type: string, text: string}>}>}
 */
export async function create_sub_field(args) {
    const draftPath = path.resolve(args.draftPath);
    const release = await acquireDraftLock(draftPath);
    try {

    let draftContent;
    try { draftContent = await fs.readFile(draftPath, "utf-8"); }
    catch (e) { throw new Error(`Could not read draft file at ${draftPath}`); }

    const sectionName = args.sectionName.trim().toLowerCase();
    if (!CONTAINER_SECTIONS.includes(sectionName)) {
        throw new Error(
            `Section '${args.sectionName}' is not a container field. create_sub_field only applies to: ` +
            CONTAINER_SECTIONS.map(s => s.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')).join(', ') + '.'
        );
    }

    const subFieldName = args.subField && args.subField.trim();
    if (!subFieldName) {
        throw new Error(`'subField' parameter is required and must be non-empty.`);
    }

    const grounded = hasStoryGroundedMarker(draftContent);
    let evidenceComment = null;
    if (grounded) {
        const validated = validateEvidence(args.evidence);
        evidenceComment = `<!-- evidence: ${encodeEvidenceForComment(validated)} -->`;
    }

    let newContent = args.newContent || '';
    if (grounded) {
        newContent = stripLeadingEvidenceComments(newContent);
    }

    const sections = draftContent.split(/^#\s+/m);
    let result = '';
    let found = false;

    if (sections[0] !== '') result += sections[0];

    for (let i = 1; i < sections.length; i++) {
        const lines = sections[i].split('\n');
        const header = lines[0].trim();

        if (header.toLowerCase() === sectionName) {
            found = true;
            const bodyAfterHeader = lines.slice(1).join('\n');
            const sfEntries = splitSubFields(bodyAfterHeader);
            const sfNorm = subFieldName.toLowerCase();
            if (sfEntries.some(sf => sf.name.toLowerCase().trim() === sfNorm)) {
                throw new Error(
                    `Sub-field '${args.subField}' already exists in section '${args.sectionName}'. ` +
                    `Use update_draft_section to modify it.`
                );
            }
            // Rebuild section preserving existing sub-fields, then append new one
            let sectionOut = '# ' + header + '\n';
            // Preserve preamble (section-level evidence / blank lines before first ##)
            let preambleEnd = 1;
            while (preambleEnd < lines.length && lines[preambleEnd].trim() === '') preambleEnd++;
            while (preambleEnd < lines.length && /^\s*<!-- evidence:.*-->\s*$/.test(lines[preambleEnd])) preambleEnd++;
            const preamble = lines.slice(1, preambleEnd).join('\n');
            if (preamble) sectionOut += preamble + '\n';
            for (const sf of sfEntries) {
                sectionOut += sf.headerLine + '\n' + sf.body + '\n';
            }
            // Append new sub-field
            if (evidenceComment) {
                sectionOut += `## ${subFieldName}\n${evidenceComment}\n${newContent}\n`;
            } else {
                sectionOut += `## ${subFieldName}\n${newContent}\n`;
            }
            result += sectionOut + '\n';
        } else {
            result += '# ' + sections[i];
        }
    }

    if (!found) {
        throw new Error(`Section '${args.sectionName}' not found in draft.`);
    }

    await fs.writeFile(draftPath, result.trim() + '\n', "utf-8");
    return successResponse(`Successfully created sub-field '${args.subField}' in section '${args.sectionName}' in ${draftPath}`);

    } finally {
        release();
    }
}

/**
 * Rename an existing sub-field within a container section.
 * Body and evidence comment are preserved verbatim; only the ## heading line changes.
 * @async
 * @param {Object} args
 * @param {string} args.draftPath
 * @param {string} args.sectionName
 * @param {string} args.oldSubField
 * @param {string} args.newSubField
 * @returns {Promise<{content: Array<{type: string, text: string}>}>}
 */
export async function rename_sub_field(args) {
    const draftPath = path.resolve(args.draftPath);
    const release = await acquireDraftLock(draftPath);
    try {

    let draftContent;
    try { draftContent = await fs.readFile(draftPath, "utf-8"); }
    catch (e) { throw new Error(`Could not read draft file at ${draftPath}`); }

    const sectionName = args.sectionName.trim().toLowerCase();
    if (!CONTAINER_SECTIONS.includes(sectionName)) {
        throw new Error(
            `Section '${args.sectionName}' is not a container field. rename_sub_field only applies to: ` +
            CONTAINER_SECTIONS.map(s => s.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')).join(', ') + '.'
        );
    }

    const oldName = args.oldSubField && args.oldSubField.trim();
    const newName = args.newSubField && args.newSubField.trim();
    if (!oldName || !newName) {
        throw new Error(`'oldSubField' and 'newSubField' must both be non-empty.`);
    }

    const sections = draftContent.split(/^#\s+/m);
    let result = '';
    let found = false;

    if (sections[0] !== '') result += sections[0];

    for (let i = 1; i < sections.length; i++) {
        const lines = sections[i].split('\n');
        const header = lines[0].trim();

        if (header.toLowerCase() === sectionName) {
            found = true;
            const bodyAfterHeader = lines.slice(1).join('\n');
            const sfEntries = splitSubFields(bodyAfterHeader);

            const oldNorm = oldName.toLowerCase();
            const newNorm = newName.toLowerCase();
            const oldIdx = sfEntries.findIndex(sf => sf.name.toLowerCase().trim() === oldNorm);

            if (oldIdx === -1) {
                throw new Error(`Sub-field '${args.oldSubField}' not found in section '${args.sectionName}'.`);
            }
            const conflictIdx = sfEntries.findIndex((sf, idx) => idx !== oldIdx && sf.name.toLowerCase().trim() === newNorm);
            if (conflictIdx !== -1) {
                throw new Error(
                    `Cannot rename: sub-field '${args.newSubField}' already exists in section '${args.sectionName}'. ` +
                    `Delete or rename the existing entry first.`
                );
            }

            let sectionOut = '# ' + header + '\n';
            let preambleEnd = 1;
            while (preambleEnd < lines.length && lines[preambleEnd].trim() === '') preambleEnd++;
            while (preambleEnd < lines.length && /^\s*<!-- evidence:.*-->\s*$/.test(lines[preambleEnd])) preambleEnd++;
            const preamble = lines.slice(1, preambleEnd).join('\n');
            if (preamble) sectionOut += preamble + '\n';

            for (let j = 0; j < sfEntries.length; j++) {
                const sf = sfEntries[j];
                if (j === oldIdx) {
                    // Replace only the heading line, preserve body exactly
                    sectionOut += `## ${newName}\n` + sf.body + '\n';
                } else {
                    sectionOut += sf.headerLine + '\n' + sf.body + '\n';
                }
            }
            result += sectionOut + '\n';
        } else {
            result += '# ' + sections[i];
        }
    }

    if (!found) {
        throw new Error(`Section '${args.sectionName}' not found in draft.`);
    }

    await fs.writeFile(draftPath, result.trim() + '\n', "utf-8");
    return successResponse(`Successfully renamed sub-field '${args.oldSubField}' to '${args.newSubField}' in section '${args.sectionName}'.`);

    } finally {
        release();
    }
}

/**
 * Remove a sub-field from a container section in a Markdown draft file.
 * Idempotent: returns an informational message if the sub-field is not found rather than throwing.
 * @async
 * @param {Object} args
 * @param {string} args.draftPath
 * @param {string} args.sectionName
 * @param {string} args.subField
 * @returns {Promise<{content: Array<{type: string, text: string}>}>}
 */
export async function delete_draft_sub_field(args) {
    const draftPath = path.resolve(args.draftPath);
    const release = await acquireDraftLock(draftPath);
    try {

    let draftContent;
    try { draftContent = await fs.readFile(draftPath, "utf-8"); }
    catch (e) { throw new Error(`Could not read draft file at ${draftPath}`); }

    const sectionName = args.sectionName.trim().toLowerCase();
    if (!CONTAINER_SECTIONS.includes(sectionName)) {
        throw new Error(
            `Section '${args.sectionName}' is not a container field. delete_draft_sub_field only applies to: ` +
            CONTAINER_SECTIONS.map(s => s.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')).join(', ') + '.'
        );
    }

    const subFieldName = args.subField && args.subField.trim();
    if (!subFieldName) {
        throw new Error(`'subField' parameter is required and must be non-empty.`);
    }

    const sections = draftContent.split(/^#\s+/m);
    let result = '';
    let found = false;

    if (sections[0] !== '') result += sections[0];

    for (let i = 1; i < sections.length; i++) {
        const lines = sections[i].split('\n');
        const header = lines[0].trim();

        if (header.toLowerCase() === sectionName) {
            found = true;
            const bodyAfterHeader = lines.slice(1).join('\n');
            const sfEntries = splitSubFields(bodyAfterHeader);
            const sfNorm = subFieldName.toLowerCase();
            const targetIdx = sfEntries.findIndex(sf => sf.name.toLowerCase().trim() === sfNorm);

            if (targetIdx === -1) {
                // Idempotent: not an error
                result += '# ' + sections[i];
                return successResponse(`Sub-field '${args.subField}' was not found in section '${args.sectionName}' (nothing to delete).`);
            }

            let sectionOut = '# ' + header + '\n';
            let preambleEnd = 1;
            while (preambleEnd < lines.length && lines[preambleEnd].trim() === '') preambleEnd++;
            while (preambleEnd < lines.length && /^\s*<!-- evidence:.*-->\s*$/.test(lines[preambleEnd])) preambleEnd++;
            const preamble = lines.slice(1, preambleEnd).join('\n');
            if (preamble) sectionOut += preamble + '\n';

            for (let j = 0; j < sfEntries.length; j++) {
                if (j === targetIdx) continue; // skip the deleted sub-field
                const sf = sfEntries[j];
                sectionOut += sf.headerLine + '\n' + sf.body + '\n';
            }
            result += sectionOut + '\n';
        } else {
            result += '# ' + sections[i];
        }
    }

    if (!found) {
        throw new Error(`Section '${args.sectionName}' not found in draft.`);
    }

    await fs.writeFile(draftPath, result.trim() + '\n', "utf-8");
    return successResponse(`Successfully deleted sub-field '${args.subField}' from section '${args.sectionName}'.`);

    } finally {
        release();
    }
}
