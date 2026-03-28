import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { tools } from "./lib/tools.js";
import { get_diff_summary, compile_draft, decompile_json, read_draft_section, update_draft_section } from "./lib/handlers/draft.js";
import { add_instruction_block, add_trigger, add_character, add_npc, add_tracked_item, modify_character, modify_npc, modify_tracked_item, modify_trigger_event } from "./lib/handlers/entities.js";
import { validate_world, audit_world } from "./lib/handlers/validation.js";
import { confirm_path, scaffold_world, compare_worlds } from "./lib/handlers/utility.js";
import { extractStoryData } from "./lib/handlers/extraction.js";
import { queryStoryData } from "./lib/handlers/query.js";

const server = new Server({ name: "iw-json-tools", version: "1.3.0" }, { capabilities: { tools: {} } });

const toolHandlers = {
    add_character,
    add_instruction_block,
    add_npc,
    add_tracked_item,
    add_trigger,
    audit_world,
    compare_worlds,
    compile_draft,
    confirm_path,
    decompile_json,
    extract_story_data: extractStoryData,
    get_diff_summary,
    modify_character,
    modify_npc,
    modify_tracked_item,
    modify_trigger_event,
    query_story_data: queryStoryData,
    read_draft_section,
    scaffold_world,
    update_draft_section,
    validate_world
};

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = toolHandlers[name];
    if (!handler) throw new Error(`Unknown tool: ${name}`);
    return handler(args);
});

const transport = new StdioServerTransport();
await server.connect(transport);
