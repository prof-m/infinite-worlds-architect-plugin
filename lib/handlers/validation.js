import { loadWorld, successResponse, VALID_CONDITION_TYPES, VALID_EFFECT_TYPES } from "../helpers.js";

export async function validate_world(args) {
    const { world } = await loadWorld(args.path);

    const errors = [];
    const warnings = [];
    const info = [];

    // --- ERRORS ---

    // Required fields
    const requiredFields = ["title", "background", "instructions"];
    for (const field of requiredFields) {
        if (!world[field] || typeof world[field] !== "string" || world[field].trim() === "") {
            errors.push(`Required field "${field}" is missing or empty.`);
        }
    }

    // Enum validation for tracked items
    const validDataTypes = ["text", "number", "xml"];
    const validVisibilities = ["everyone", "ai_only", "player_only", "nobody"];
    for (const item of (world.trackedItems || [])) {
        if (item.dataType && !validDataTypes.includes(item.dataType)) {
            errors.push(`Tracked item "${item.name}": invalid dataType "${item.dataType}". Must be one of: ${validDataTypes.join(", ")}.`);
        }
        if (item.visibility && !validVisibilities.includes(item.visibility)) {
            errors.push(`Tracked item "${item.name}": invalid visibility "${item.visibility}". Must be one of: ${validVisibilities.join(", ")}.`);
        }
    }

    // Trigger condition types
    for (const trigger of (world.triggerEvents || [])) {
        for (const cond of (trigger.triggerConditions || [])) {
            if (cond.type && !VALID_CONDITION_TYPES.includes(cond.type)) {
                errors.push(`Trigger "${trigger.name}": invalid condition type "${cond.type}". Must be one of: ${VALID_CONDITION_TYPES.join(", ")}.`);
            }
        }
    }

    // Trigger effect types
    for (const trigger of (world.triggerEvents || [])) {
        for (const eff of (trigger.triggerEffects || [])) {
            if (eff.type && !VALID_EFFECT_TYPES.includes(eff.type)) {
                errors.push(`Trigger "${trigger.name}": invalid effect type "${eff.type}". Must be one of: ${VALID_EFFECT_TYPES.join(", ")}.`);
            }
        }
    }

    // Skill values (0-5 integer)
    for (const char of (world.possibleCharacters || [])) {
        if (char.skills && typeof char.skills === "object") {
            for (const [skillName, skillValue] of Object.entries(char.skills)) {
                if (!Number.isInteger(skillValue) || skillValue < 0 || skillValue > 5) {
                    errors.push(`Character "${char.name}": skill "${skillName}" has invalid value ${skillValue}. Must be an integer between 0 and 5.`);
                }
            }
        }
    }

    // ID uniqueness across all entity arrays
    const idMap = new Map();
    const entityArrays = [
        { key: "triggerEvents", label: "triggerEvents" },
        { key: "trackedItems", label: "trackedItems" },
        { key: "instructionBlocks", label: "instructionBlocks" },
        { key: "loreBookEntries", label: "loreBookEntries" },
        { key: "NPCs", label: "NPCs" }
    ];
    for (const { key, label } of entityArrays) {
        for (const item of (world[key] || [])) {
            if (item.id) {
                if (idMap.has(item.id)) {
                    errors.push(`Duplicate id "${item.id}" found in ${label} ("${item.name}") and ${idMap.get(item.id)}.`);
                } else {
                    idMap.set(item.id, `${label} ("${item.name}")`);
                }
            }
        }
    }

    // Duplicate characterId across possibleCharacters
    const charIdMap = new Map();
    for (const char of (world.possibleCharacters || [])) {
        if (char.characterId) {
            if (charIdMap.has(char.characterId)) {
                charIdMap.set(char.characterId, [...charIdMap.get(char.characterId), char.name]);
            } else {
                charIdMap.set(char.characterId, [char.name]);
            }
        }
    }
    for (const [cid, names] of charIdMap) {
        if (names.length > 1) {
            errors.push(`Duplicate characterId "${cid}" shared by characters: ${names.join(", ")}.`);
        }
    }

    // --- WARNINGS ---

    // Orphaned trigger references in prerequisites and blockers
    const allTriggerIds = new Set((world.triggerEvents || []).map(t => t.id).filter(Boolean));
    for (const trigger of (world.triggerEvents || [])) {
        for (const prereqId of (trigger.prerequisites || [])) {
            if (!allTriggerIds.has(prereqId)) {
                warnings.push(`Trigger "${trigger.name}": prerequisite ID "${prereqId}" does not match any existing trigger.`);
            }
        }
        for (const blockerId of (trigger.blockers || [])) {
            if (!allTriggerIds.has(blockerId)) {
                warnings.push(`Trigger "${trigger.name}": blocker ID "${blockerId}" does not match any existing trigger.`);
            }
        }
    }

    // NPC name consistency
    for (const npc of (world.NPCs || [])) {
        if (npc.names && npc.names.length > 0 && npc.name) {
            if (npc.names[0].toLowerCase() !== npc.name.toLowerCase()) {
                warnings.push(`NPC "${npc.name}": first entry in names array ("${npc.names[0]}") does not match name field.`);
            }
        }
    }

    // Empty keyword blocks
    for (const entry of (world.loreBookEntries || [])) {
        if (!entry.keywords || entry.keywords.length === 0) {
            warnings.push(`Keyword block "${entry.name}": keywords array is empty.`);
        }
    }

    // Empty instruction blocks
    for (const block of (world.instructionBlocks || [])) {
        if (!block.content || block.content.trim() === "") {
            warnings.push(`Instruction block "${block.name}": content is empty.`);
        }
    }

    // Tracked item size
    for (const item of (world.trackedItems || [])) {
        if (item.initialValue && item.initialValue.length > 10000) {
            warnings.push(`Tracked item "${item.name}": initialValue exceeds 10,000 characters (${item.initialValue.length}).`);
        }
        if (item.updateInstructions && item.updateInstructions.length > 10000) {
            warnings.push(`Tracked item "${item.name}": updateInstructions exceeds 10,000 characters (${item.updateInstructions.length}).`);
        }
    }

    // Missing description
    if (!world.description || typeof world.description !== "string" || world.description.trim() === "") {
        warnings.push(`World has no description or it is empty.`);
    }

    // --- INFO ---

    // No victory/defeat conditions
    if ((!world.victoryCondition || world.victoryCondition.trim() === "") && (!world.defeatCondition || world.defeatCondition.trim() === "")) {
        info.push(`Neither victoryCondition nor defeatCondition are set.`);
    }

    // No NPCs
    if (!world.NPCs || world.NPCs.length === 0) {
        info.push(`No NPCs defined.`);
    }

    // No tracked items
    if (!world.trackedItems || world.trackedItems.length === 0) {
        info.push(`No tracked items defined.`);
    }

    // No triggers
    if (!world.triggerEvents || world.triggerEvents.length === 0) {
        info.push(`No trigger events defined.`);
    }

    // Large skill count
    if (world.skills && world.skills.length > 8) {
        info.push(`${world.skills.length} skills defined (more than 8 may overwhelm the AI).`);
    }

    // triggerOnEvent count
    let triggerOnEventCount = 0;
    for (const trigger of (world.triggerEvents || [])) {
        for (const cond of (trigger.triggerConditions || [])) {
            if (cond.type === "triggerOnEvent") triggerOnEventCount++;
        }
    }
    if (triggerOnEventCount > 10) {
        info.push(`${triggerOnEventCount} triggerOnEvent conditions found across all triggers (platform limit is 10).`);
    }

    // --- OUTPUT ---
    const title = world.title || "Untitled World";
    const status = errors.length === 0 ? "VALID" : "INVALID";

    let report = `# World Validation Report: ${title}\n\n`;
    report += `## Errors (${errors.length})\n`;
    if (errors.length === 0) report += `None.\n`;
    else errors.forEach(e => report += `- [ERROR] ${e}\n`);

    report += `\n## Warnings (${warnings.length})\n`;
    if (warnings.length === 0) report += `None.\n`;
    else warnings.forEach(w => report += `- [WARNING] ${w}\n`);

    report += `\n## Info (${info.length})\n`;
    if (info.length === 0) report += `None.\n`;
    else info.forEach(i => report += `- [INFO] ${i}\n`);

    report += `\n## Summary\n`;
    report += `${errors.length} errors, ${warnings.length} warnings, ${info.length} info items\n`;
    report += `Status: ${status}`;

    return successResponse(report);
}

export async function audit_world(args) {
    const { world } = await loadWorld(args.path);

    const title = world.title || "Untitled World";
    const recommendations = [];

    // --- 1. Token Cost Estimation ---
    const alwaysOnFields = ["instructions", "background", "objective", "descriptionRequest", "authorStyle", "summaryRequest"];
    const fieldCosts = {};
    let totalChars = 0;
    for (const field of alwaysOnFields) {
        const chars = (world[field] || "").length;
        fieldCosts[field] = chars;
        totalChars += chars;
    }

    let costTier;
    if (totalChars < 2000) costTier = "Light";
    else if (totalChars <= 5000) costTier = "Moderate";
    else if (totalChars <= 10000) costTier = "Heavy";
    else costTier = "Very Heavy";

    let tokenCostTable = "## Token Cost Estimate\n";
    tokenCostTable += "| Field | Characters | Est. Tokens |\n";
    tokenCostTable += "|-------|-----------|-------------|\n";
    for (const field of alwaysOnFields) {
        const chars = fieldCosts[field];
        tokenCostTable += `| ${field} | ${chars} | ~${Math.round(chars / 4)} |\n`;
    }
    tokenCostTable += `| **Total Always-On** | **${totalChars}** | **~${Math.round(totalChars / 4)}** |\n`;
    tokenCostTable += `\nCost Tier: ${costTier}\n`;

    if (costTier === "Heavy" || costTier === "Very Heavy") {
        recommendations.push(`Always-on context is ${costTier} (${totalChars} chars). Review instructions and background for content that can be moved to keyword blocks.`);
    }

    // --- 2. Instruction Density Analysis ---
    let densityReport = "## Instruction Density\n";
    const densityFlags = [];
    for (const field of alwaysOnFields) {
        const text = world[field] || "";
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        if (wordCount > 500) {
            densityFlags.push(`- **${field}**: ${wordCount} words (exceeds 500-word limit). Consider moving content to keyword blocks.`);
            recommendations.push(`Field '${field}' has ${wordCount} words. Move specialized content (location descriptions, lore, mechanics) to keyword blocks to reduce per-turn cost.`);
        }
    }
    densityReport += densityFlags.length > 0 ? densityFlags.join("\n") + "\n" : "All fields within recommended limits.\n";

    // --- 3. Keyword Block Trigger Coverage ---
    let keywordReport = "## Keyword Block Analysis\n";
    const loreEntries = world.loreBookEntries || [];
    const totalBlocks = loreEntries.length;
    let totalKeywords = 0;
    const singleKeywordFlags = [];

    for (const entry of loreEntries) {
        const keywords = entry.keywords || [];
        totalKeywords += keywords.length;
        if (keywords.length === 1) {
            singleKeywordFlags.push(`- **${entry.name}**: Only 1 keyword ("${keywords[0]}"). Add synonyms and related terms for robust triggering.`);
            recommendations.push(`Add synonyms to keyword block '${entry.name}' (currently only 1 keyword: '${keywords[0]}').`);
        }
    }

    const avgKeywords = totalBlocks > 0 ? (totalKeywords / totalBlocks).toFixed(1) : 0;
    keywordReport += `- Total blocks: ${totalBlocks}\n`;
    keywordReport += `- Average keywords per block: ${avgKeywords}\n`;
    if (singleKeywordFlags.length > 0) {
        keywordReport += singleKeywordFlags.join("\n") + "\n";
    }

    // --- 4. Tracked Item Analysis ---
    let trackedReport = "## Tracked Items\n";
    const trackedItems = world.trackedItems || [];
    let trackedTotalChars = 0;
    const trackedFlags = [];

    // Collect all triggerOnTrackedItem references
    const triggerTrackedRefs = new Set();
    const triggers = world.triggerEvents || [];
    for (const trigger of triggers) {
        for (const cond of (trigger.triggerConditions || [])) {
            if (cond.type === "triggerOnTrackedItem" && cond.data) {
                const dataStr = typeof cond.data === "object" ? JSON.stringify(cond.data) : String(cond.data);
                triggerTrackedRefs.add(dataStr);
            }
        }
    }

    // Build combined always-on text for reference checks
    const alwaysOnText = alwaysOnFields.map(f => world[f] || "").join(" ");

    for (const item of trackedItems) {
        const desc = (item.description || "").length;
        const update = (item.updateInstructions || "").length;
        const init = (item.initialValue || "").length;
        const itemTotal = desc + update + init;
        trackedTotalChars += itemTotal;

        if (itemTotal > 5000) {
            trackedFlags.push(`- **${item.name}**: ${itemTotal} chars total (exceeds 5,000 char warning threshold).`);
            recommendations.push(`Tracked item '${item.name}' is ${itemTotal} chars. Consider condensing description and update instructions.`);
        }

        // Check if this item is referenced in any trigger condition or instruction field
        const itemName = item.name || "";
        let referenced = false;
        for (const ref of triggerTrackedRefs) {
            if (ref.includes(itemName)) { referenced = true; break; }
        }
        if (!referenced && !alwaysOnText.includes(itemName)) {
            // Also check instruction blocks
            const allBlocks = [...(world.instructionBlocks || []), ...loreEntries];
            for (const block of allBlocks) {
                if ((block.content || "").includes(itemName)) { referenced = true; break; }
            }
        }
        if (!referenced) {
            trackedFlags.push(`- **${item.name}**: No matching reference found in trigger conditions or instruction fields. May be a "flavor" item with unnecessary per-turn cost.`);
            recommendations.push(`Tracked item '${item.name}' has no trigger references — consider removing or converting to a narrative approach.`);
        }
    }

    trackedReport += `- Total items: ${trackedItems.length}\n`;
    trackedReport += `- Total characters: ${trackedTotalChars}\n`;
    if (trackedFlags.length > 0) {
        trackedReport += trackedFlags.join("\n") + "\n";
    }

    // --- 5. Trigger Chain Visualization ---
    let triggerReport = "## Trigger Dependencies\n";
    const triggerMap = {};
    for (const t of triggers) {
        triggerMap[t.id] = t;
    }

    const triggerNameById = {};
    for (const t of triggers) {
        triggerNameById[t.id] = t.name || t.id;
    }

    const depLines = [];
    let hasDeps = false;
    for (const t of triggers) {
        const prereqs = t.prerequisites || [];
        const blockers = t.blockers || [];
        if (prereqs.length > 0 || blockers.length > 0) {
            hasDeps = true;
            let line = `- **${t.name || t.id}**`;
            if (prereqs.length > 0) {
                line += ` | Prerequisites: ${prereqs.map(id => triggerNameById[id] || id).join(", ")}`;
            }
            if (blockers.length > 0) {
                line += ` | Blockers: ${blockers.map(id => triggerNameById[id] || id).join(", ")}`;
            }
            depLines.push(line);
        }
    }

    if (!hasDeps) {
        triggerReport += "No prerequisite/blocker chains found.\n";
    } else {
        triggerReport += depLines.join("\n") + "\n";
    }

    // Cycle detection via DFS on prerequisites
    let cycleFound = false;
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = {};
    for (const t of triggers) { color[t.id] = WHITE; }

    function dfsCycle(nodeId) {
        color[nodeId] = GRAY;
        const node = triggerMap[nodeId];
        if (node) {
            for (const prereqId of (node.prerequisites || [])) {
                if (color[prereqId] === GRAY) { cycleFound = true; return; }
                if (color[prereqId] === WHITE) { dfsCycle(prereqId); }
                if (cycleFound) return;
            }
        }
        color[nodeId] = BLACK;
    }

    for (const t of triggers) {
        if (color[t.id] === WHITE) { dfsCycle(t.id); }
        if (cycleFound) break;
    }

    if (cycleFound) {
        triggerReport += "**ERROR: Cycle detected in prerequisite chains!**\n";
        recommendations.push("CRITICAL: Cycle detected in trigger prerequisite chains. This will cause triggers to never fire. Review and break the cycle.");
    }

    // Max chain depth
    const depthCache = {};
    function chainDepth(nodeId, visited) {
        if (depthCache[nodeId] !== undefined) return depthCache[nodeId];
        if (visited.has(nodeId)) return 0; // Avoid infinite loops on cycles
        visited.add(nodeId);
        const node = triggerMap[nodeId];
        if (!node || !(node.prerequisites || []).length) {
            depthCache[nodeId] = 0;
            return 0;
        }
        let maxD = 0;
        for (const prereqId of node.prerequisites) {
            maxD = Math.max(maxD, 1 + chainDepth(prereqId, visited));
        }
        depthCache[nodeId] = maxD;
        return maxD;
    }

    let maxDepth = 0;
    for (const t of triggers) {
        maxDepth = Math.max(maxDepth, chainDepth(t.id, new Set()));
    }
    triggerReport += `Max chain depth: ${maxDepth}\n`;

    // --- 6. NPC Redundancy Detection ---
    let npcReport = "## NPC Redundancy\n";
    const npcs = world.NPCs || [];
    const npcFlags = [];
    const alwaysOnFieldsForNPC = ["instructions", "background", "authorStyle"];

    for (const npc of npcs) {
        const npcName = npc.name || "";
        if (!npcName) continue;
        const foundIn = [];
        for (const field of alwaysOnFieldsForNPC) {
            if ((world[field] || "").includes(npcName)) {
                foundIn.push(field);
            }
        }
        if (foundIn.length > 0) {
            npcFlags.push(`- **${npcName}**: Referenced in ${foundIn.join(", ")}. NPC details are auto-injected when relevant — mentioning them in always-on fields causes double-charging.`);
            recommendations.push(`NPC '${npcName}' is mentioned in ${foundIn.join(", ")}. Remove NPC-specific details from always-on fields to avoid double-charging (NPC data is auto-injected by the engine).`);
        }
    }
    npcReport += npcFlags.length > 0 ? npcFlags.join("\n") + "\n" : "No redundant NPC references found in always-on fields.\n";

    // --- 7. Image Instruction Efficiency ---
    let imageReport = "## Image Instructions\n";
    const imageFields = ["imageStyleCharacterPre", "imageStyleCharacterPost", "imageStyleNonCharacterPre", "imageStyleNonCharacterPost"];
    const imageFlags = [];
    for (const field of imageFields) {
        const len = (world[field] || "").length;
        if (len > 200) {
            imageFlags.push(`- **${field}**: ${len} chars (exceeds 200-char recommendation). These are sent with every image generation.`);
            recommendations.push(`Image field '${field}' is ${len} chars. Condense to under 200 chars to reduce per-image cost.`);
        }
    }
    imageReport += imageFlags.length > 0 ? imageFlags.join("\n") + "\n" : "All image instruction fields within recommended limits.\n";

    // --- 8. Overall Efficiency Rating ---
    let issueCount = densityFlags.length + singleKeywordFlags.length + trackedFlags.length + npcFlags.length + imageFlags.length + (cycleFound ? 1 : 0);
    let overallRating;
    if (issueCount === 0) overallRating = "Good";
    else if (issueCount <= 3) overallRating = "Fair";
    else overallRating = "Needs Optimization";

    // --- Build Final Report ---
    let report = `# World Audit Report: ${title}\n\n`;
    report += tokenCostTable + "\n";
    report += densityReport + "\n";
    report += keywordReport + "\n";
    report += trackedReport + "\n";
    report += triggerReport + "\n";
    report += npcReport + "\n";
    report += imageReport + "\n";

    report += "## Recommendations\n";
    if (recommendations.length > 0) {
        recommendations.forEach((rec, i) => { report += `${i + 1}. ${rec}\n`; });
    } else {
        report += "No issues found. World design looks efficient!\n";
    }

    report += `\n## Summary\nOverall efficiency: ${overallRating}\n`;

    return successResponse(report);
}
