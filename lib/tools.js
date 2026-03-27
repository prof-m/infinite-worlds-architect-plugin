export const tools = [
    {
        name: "add_character",
        description: "Append a Player Character to an existing world JSON file.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Absolute path to the existing world JSON file." },
                characterId: { type: "string", description: "Optional: existing character ID to preserve. If omitted, a new unique ID is generated." },
                name: { type: "string", description: "Name of the character." },
                description: { type: "string", description: "Character description." },
                portrait: { type: "string", description: "Portrait identifier or URL." },
                skills: { type: "object", description: "Object mapping skill names to integer values 0-5 (e.g., {\"Strength\": 3, \"Charisma\": 4})." }
            },
            required: ["path", "name"]
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
        name: "add_npc",
        description: "Append an NPC (Other Character) to an existing world JSON file.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Absolute path to the existing world JSON file." },
                id: { type: "string", description: "Optional: existing NPC ID to preserve. If omitted, a new unique ID is generated." },
                name: { type: "string", description: "Name of the NPC." },
                detail: { type: "string", description: "Detailed character description." },
                one_liner: { type: "string", description: "Brief one-line summary of the NPC." },
                appearance: { type: "string", description: "Physical appearance description." },
                location: { type: "string", description: "Where the NPC can be found." },
                secret_info: { type: "string", description: "Hidden information only the AI knows." },
                names: { type: "array", items: { type: "string" }, description: "Full list of names/aliases for the NPC." },
                img_appearance: { type: "string", description: "Image generation appearance prompt." },
                img_clothing: { type: "string", description: "Image generation clothing prompt." }
            },
            required: ["path", "name"]
        }
    },
    {
        name: "add_tracked_item",
        description: "Append a Tracked Item to an existing world JSON file.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Absolute path to the existing world JSON file." },
                id: { type: "string", description: "Optional: existing tracked item ID to preserve. If omitted, a new unique ID is generated." },
                name: { type: "string", description: "Name of the tracked item." },
                dataType: { type: "string", enum: ["text", "number", "xml"], description: "Data type of the tracked item. Default: \"text\"." },
                visibility: { type: "string", enum: ["everyone", "ai_only", "player_only", "nobody"], description: "Visibility of the tracked item. Default: \"everyone\"." },
                description: { type: "string", description: "Description of what this item tracks." },
                updateInstructions: { type: "string", description: "Instructions for the AI on how to update this item." },
                initialValue: { type: "string", description: "Starting value for the tracked item." }
            },
            required: ["path", "name"]
        }
    },
    {
        name: "add_trigger",
        description: "Append a Trigger Event to a world JSON file. Supports multiple conditions/effects, all condition and effect types, prerequisites, blockers, and repeat-firing control.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Absolute path to the existing world JSON file." },
                name: { type: "string", description: "Name of the trigger." },
                conditions: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            type: { type: "string", description: "Condition type (e.g., triggerOnEvent, triggerOnTurn, triggerOnStartOfGame, triggerOnCharacter, triggerOnTrackedItem, triggerOnRandomChance)." },
                            data: { description: "Condition data — type depends on condition type." }
                        },
                        required: ["type", "data"]
                    },
                    description: "Array of trigger conditions (AND logic — all must be met)."
                },
                effects: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            type: { type: "string", description: "Effect type (e.g., scriptedText, giveGuidance, setTrackedItemsValue, endsGame, changeInstructions, etc.)." },
                            data: { description: "Effect data — type depends on effect type." }
                        },
                        required: ["type", "data"]
                    },
                    description: "Array of trigger effects (all execute when conditions are met)."
                },
                canTriggerMoreThanOnce: { type: "boolean", description: "If true, trigger can fire every eligible turn. Default: false." },
                prerequisites: { type: "array", items: { type: "string" }, description: "Trigger IDs that must have fired previously." },
                blockers: { type: "array", items: { type: "string" }, description: "Trigger IDs that prevent this trigger from firing." },
                conditionType: { type: "string", description: "LEGACY: Single condition type. Use 'conditions' array instead." },
                conditionData: { type: "string", description: "LEGACY: Single condition data. Use 'conditions' array instead." },
                effectType: { type: "string", description: "LEGACY: Single effect type. Use 'effects' array instead." },
                effectData: { type: "string", description: "LEGACY: Single effect data. Use 'effects' array instead." }
            },
            required: ["path", "name"]
        }
    },
    {
        name: "audit_world",
        description: "Audit a world JSON file for token efficiency, instruction density, and design quality. Returns analysis with optimization suggestions.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Absolute path to the world JSON file to audit." }
            },
            required: ["path"]
        }
    },
    {
        name: "compare_worlds",
        description: "Compare two world JSON files and return a structured diff showing field changes, added/removed/modified entities, and a summary.",
        inputSchema: {
            type: "object",
            properties: {
                pathA: { type: "string", description: "Absolute path to the first (base) world JSON file." },
                pathB: { type: "string", description: "Absolute path to the second (comparison) world JSON file." }
            },
            required: ["pathA", "pathB"]
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
        name: "modify_character",
        description: "Modify an existing Player Character in a world JSON file by name. Only provided fields are updated; others are preserved.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Absolute path to the existing world JSON file." },
                name: { type: "string", description: "Name of the character to find and modify." },
                description: { type: "string", description: "New character description." },
                portrait: { type: "string", description: "New portrait identifier or URL." },
                skills: { type: "object", description: "Object mapping skill names to integer values 0-5. Replaces existing skills entirely." }
            },
            required: ["path", "name"]
        }
    },
    {
        name: "modify_npc",
        description: "Modify an existing NPC (Other Character) in a world JSON file by name. Only provided fields are updated; others are preserved.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Absolute path to the existing world JSON file." },
                name: { type: "string", description: "Name of the NPC to find and modify." },
                detail: { type: "string", description: "New detailed character description." },
                one_liner: { type: "string", description: "New brief one-line summary." },
                appearance: { type: "string", description: "New physical appearance description." },
                location: { type: "string", description: "New location." },
                secret_info: { type: "string", description: "New hidden information." },
                names: { type: "array", items: { type: "string" }, description: "New full list of names/aliases." },
                img_appearance: { type: "string", description: "New image generation appearance prompt." },
                img_clothing: { type: "string", description: "New image generation clothing prompt." }
            },
            required: ["path", "name"]
        }
    },
    {
        name: "modify_tracked_item",
        description: "Modify an existing Tracked Item in a world JSON file by name. Only provided fields are updated; others are preserved.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Absolute path to the existing world JSON file." },
                name: { type: "string", description: "Name of the tracked item to find and modify." },
                dataType: { type: "string", enum: ["text", "number", "xml"], description: "New data type." },
                visibility: { type: "string", enum: ["everyone", "ai_only", "player_only", "nobody"], description: "New visibility." },
                description: { type: "string", description: "New description." },
                updateInstructions: { type: "string", description: "New update instructions." },
                initialValue: { type: "string", description: "New initial value." }
            },
            required: ["path", "name"]
        }
    },
    {
        name: "modify_trigger_event",
        description: "Modify an existing Trigger Event in a world JSON file by name. Only provided fields are updated.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Absolute path to the world JSON file." },
                name: { type: "string", description: "Name of the trigger event to modify." },
                newName: { type: "string", description: "Optional: new name for the trigger." },
                conditions: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            type: { type: "string", description: "Condition type." },
                            data: { description: "Condition data." }
                        },
                        required: ["type", "data"]
                    },
                    description: "Optional: replace all trigger conditions."
                },
                effects: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            type: { type: "string", description: "Effect type." },
                            data: { description: "Effect data." }
                        },
                        required: ["type", "data"]
                    },
                    description: "Optional: replace all trigger effects."
                },
                canTriggerMoreThanOnce: { type: "boolean", description: "Optional: update repeat-firing control." },
                prerequisites: { type: "array", items: { type: "string" }, description: "Optional: update prerequisite trigger IDs." },
                blockers: { type: "array", items: { type: "string" }, description: "Optional: update blocker trigger IDs." }
            },
            required: ["path", "name"]
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
        name: "validate_world",
        description: "Validate a world JSON file against the Infinite Worlds schema. Returns errors (must fix), warnings (should fix), and info (consider).",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Absolute path to the world JSON file to validate." }
            },
            required: ["path"]
        }
    }
];
