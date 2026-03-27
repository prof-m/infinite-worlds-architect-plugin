import { fs, path, writeWorld, readWorld, successResponse, stripIds, ROOT_FIELDS, ENTITY_ARRAYS } from "../helpers.js";

export async function confirm_path(args) {
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
        return successResponse(`Path NOT_FOUND: Could not find a ${type} at "${input}". Please provide a more specific or absolute path.`);
    }

    return successResponse(`RESOLVED_PATH: ${resolvedPath}\n\nIs this the correct ${type}?`);
}

export async function scaffold_world(args) {
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
    return successResponse(`World scaffolded successfully at ${worldPath}`);
}

export async function compare_worlds(args) {
    const worldA = await readWorld(path.resolve(args.pathA));
    const worldB = await readWorld(path.resolve(args.pathB));
    if (!worldA) throw new Error(`Could not read world file at ${args.pathA}`);
    if (!worldB) throw new Error(`Could not read world file at ${args.pathB}`);

    // Compare root fields
    const rootChanges = [];
    let rootUnchanged = 0;
    for (const field of ROOT_FIELDS) {
        const valA = worldA[field];
        const valB = worldB[field];
        if (JSON.stringify(valA) !== JSON.stringify(valB)) {
            if (typeof valA === 'string' && typeof valB === 'string') {
                const truncate = (s, max) => s.length > max ? s.slice(0, max) + '...' : s;
                if (valA.length > 80 || valB.length > 80) {
                    // Find common prefix to show context around the divergence point
                    let prefixLen = 0;
                    while (prefixLen < valA.length && prefixLen < valB.length && valA[prefixLen] === valB[prefixLen]) {
                        prefixLen++;
                    }
                    if (prefixLen > 20) {
                        // Strings share a long common prefix — show around the divergence
                        const prefix = truncate(valA.slice(0, prefixLen), 30);
                        const diffA = truncate(valA.slice(prefixLen), 50);
                        const diffB = truncate(valB.slice(prefixLen), 50);
                        rootChanges.push(`- ${field}: [${prefix}] "${diffA}" → "${diffB}"`);
                    } else {
                        rootChanges.push(`- ${field}: "${truncate(valA, 80)}" → "${truncate(valB, 80)}"`);
                    }
                } else {
                    rootChanges.push(`- ${field}: "${valA}" → "${valB}"`);
                }
            } else {
                rootChanges.push(`- ${field}: ${JSON.stringify(valA)} → ${JSON.stringify(valB)}`);
            }
        } else {
            rootUnchanged++;
        }
    }

    // Skills comparison
    let skillsLine = "";
    if (JSON.stringify(worldA.skills) !== JSON.stringify(worldB.skills)) {
        skillsLine = `- Changed: ${JSON.stringify(worldA.skills || [])} → ${JSON.stringify(worldB.skills || [])}`;
    }

    // Entity array comparison helper
    function compareArrays(arrA, arrB, ignoreKeys) {
        const listA = arrA || [];
        const listB = arrB || [];
        const namesA = new Set(listA.map(i => i.name));
        const namesB = new Set(listB.map(i => i.name));
        const added = [...namesB].filter(n => !namesA.has(n));
        const removed = [...namesA].filter(n => !namesB.has(n));
        const common = [...namesA].filter(n => namesB.has(n));
        const modified = [];
        for (const itemName of common) {
            const a = listA.find(i => i.name === itemName);
            const b = listB.find(i => i.name === itemName);
            const cleanA = stripIds(a);
            const cleanB = stripIds(b);
            const changedFields = [];
            const allKeys = new Set([...Object.keys(cleanA), ...Object.keys(cleanB)]);
            for (const key of allKeys) {
                if (ignoreKeys.includes(key)) continue;
                if (JSON.stringify(cleanA[key]) !== JSON.stringify(cleanB[key])) changedFields.push(key);
            }
            if (changedFields.length > 0) modified.push({ name: itemName, changedFields });
        }
        const unchanged = common.length - modified.length;
        return { added, removed, modified, unchanged };
    }

    const ignoreKeys = ['id', 'characterId'];

    const entitySections = [];
    let totalAdded = 0, totalRemoved = 0, totalModified = 0;

    for (const { key, label } of ENTITY_ARRAYS) {
        const result = compareArrays(worldA[key], worldB[key], ignoreKeys);
        totalAdded += result.added.length;
        totalRemoved += result.removed.length;
        totalModified += result.modified.length;

        const lines = [];
        for (const n of result.added) lines.push(`- Added: "${n}"`);
        for (const n of result.removed) lines.push(`- Removed: "${n}"`);
        for (const m of result.modified) lines.push(`- Modified: "${m.name}" (changed: ${m.changedFields.join(', ')})`);
        if (lines.length === 0) lines.push('No changes.');
        entitySections.push({ label, lines, hasChanges: lines[0] !== 'No changes.' });
    }

    // Build report
    const titleA = worldA.title || 'Untitled';
    const titleB = worldB.title || 'Untitled';
    let report = `# World Comparison: "${titleA}" vs "${titleB}"\n\n`;

    report += `## Root Field Changes (${rootChanges.length})\n`;
    if (rootChanges.length === 0) report += 'No changes.\n';
    else report += rootChanges.join('\n') + '\n';

    report += `\n## Skills\n`;
    report += skillsLine ? skillsLine + '\n' : 'No changes.\n';

    for (const section of entitySections) {
        report += `\n## ${section.label}\n`;
        report += section.lines.join('\n') + '\n';
    }

    report += `\n## Summary\n`;
    report += `Root fields: ${rootChanges.length} changed, ${rootUnchanged} unchanged\n`;
    report += `Skills: ${skillsLine ? 'changed' : 'unchanged'}\n`;
    report += `Entities: ${totalAdded} added, ${totalRemoved} removed, ${totalModified} modified\n`;

    return successResponse(report);
}
