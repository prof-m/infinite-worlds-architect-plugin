#!/usr/bin/env node

/**
 * MCP Parity Test Harness
 *
 * Spawns two MCP server processes (original and refactored), sends identical
 * tool-call requests to both via newline-delimited JSON over stdio, and
 * compares the responses after stripping non-deterministic fields.
 *
 * Usage:
 *   node test-parity.mjs
 *
 * Exit code 0 = all tests passed, 1 = at least one failure.
 */

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdtemp, rm, readFile, cp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ORIGINAL_SERVER = "/tmp/claude-1000/iw-master/index.js";
const REFACTORED_SERVER = join(
  "/home/moose/personalProjects/infinite-worlds-architect-plugin",
  "index.js",
);

const TEST_WORLD = "/home/moose/personalProjects/infinite-worlds-architect-plugin/test-files/world_v1_7.json";
const TEST_DRAFT = "/home/moose/personalProjects/infinite-worlds-architect-plugin/test-files/draft_world_v1_7.md";

const TMP_ROOT = "/tmp/claude-1000/";

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const HEX_ID_RE = /"[0-9a-f]{8}"/g;
const HEX_ID_BARE_RE = /\b[0-9a-f]{8}\b/g;

const TMP_PATH_RE = /\/tmp\/claude-1000\/parity-(?:orig|refac)-[A-Za-z0-9]+/g;

function stripIds(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(UUID_RE, "<UUID>")
    .replace(HEX_ID_RE, '"<ID>"')
    .replace(HEX_ID_BARE_RE, "<ID>")
    .replace(TMP_PATH_RE, "<TMPDIR>");
}

function normaliseJson(obj) {
  return stripIds(JSON.stringify(obj, null, 2));
}

// ---------------------------------------------------------------------------
// MCP Client — wraps a child process speaking newline-delimited JSON-RPC 2.0
// ---------------------------------------------------------------------------

class McpClient {
  constructor(label, serverPath) {
    this.label = label;
    this.serverPath = serverPath;
    this._nextId = 1;
    this._pending = new Map();
    this._proc = null;
    this._ready = false;
  }

  async start() {
    this._proc = spawn("node", [this.serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    // Collect stderr for diagnostics but don't print unless needed
    this._stderr = "";
    this._proc.stderr.on("data", (chunk) => {
      this._stderr += chunk.toString();
    });

    const rl = createInterface({ input: this._proc.stdout });
    rl.on("line", (line) => {
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        return; // ignore non-JSON lines (e.g. logging)
      }
      if (msg.id != null && this._pending.has(msg.id)) {
        const { resolve } = this._pending.get(msg.id);
        this._pending.delete(msg.id);
        resolve(msg);
      }
    });

    // Handshake: initialize + initialized notification
    await this._request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "parity-test", version: "1.0.0" },
    });
    this._send({ jsonrpc: "2.0", method: "notifications/initialized" });
    this._ready = true;
  }

  async callTool(name, args = {}) {
    return this._request("tools/call", { name, arguments: args });
  }

  async listTools() {
    return this._request("tools/list", {});
  }

  async stop() {
    if (this._proc) {
      this._proc.stdin.end();
      await new Promise((resolve) => this._proc.on("close", resolve));
      this._proc = null;
    }
  }

  // -- internal --

  _send(obj) {
    this._proc.stdin.write(JSON.stringify(obj) + "\n");
  }

  _request(method, params) {
    const id = this._nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(id);
        reject(
          new Error(
            `[${this.label}] Timeout waiting for response to ${method} (id=${id})\nstderr: ${this._stderr.slice(-500)}`,
          ),
        );
      }, 30_000);

      this._pending.set(id, {
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
      });
      this._send({ jsonrpc: "2.0", id, method, params });
    });
  }
}

// ---------------------------------------------------------------------------
// Diff helper — returns null if equal, or a string describing the difference
// ---------------------------------------------------------------------------

function diff(a, b) {
  const na = stripIds(typeof a === "string" ? a : JSON.stringify(a, null, 2));
  const nb = stripIds(typeof b === "string" ? b : JSON.stringify(b, null, 2));
  if (na === nb) return null;

  const linesA = na.split("\n");
  const linesB = nb.split("\n");
  const out = [];
  const maxLines = Math.max(linesA.length, linesB.length);
  let diffs = 0;
  for (let i = 0; i < maxLines && diffs < 20; i++) {
    if (linesA[i] !== linesB[i]) {
      diffs++;
      out.push(`  line ${i + 1}:`);
      out.push(`    original:   ${linesA[i] ?? "(missing)"}`);
      out.push(`    refactored: ${linesB[i] ?? "(missing)"}`);
    }
  }
  if (diffs >= 20) out.push("  ... (truncated)");
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Extract text content from an MCP tools/call response
// ---------------------------------------------------------------------------

function extractText(response) {
  const result = response?.result;
  if (!result) return "";
  if (typeof result.content === "string") return result.content;
  if (Array.isArray(result.content)) {
    return result.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
  }
  return JSON.stringify(result);
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

const results = [];

function report(name, passed, detail) {
  results.push({ name, passed });
  const tag = passed ? "PASS" : "FAIL";
  console.log(`  [${tag}] ${name}`);
  if (!passed && detail) {
    console.log(detail);
  }
}

async function compareCalls(original, refactored, name, args, opts = {}) {
  const { compareFiles, label } = opts;
  const testName = label || `${name}(${Object.values(args).join(", ").slice(0, 60)})`;

  let rOrig, rRefac;
  try {
    [rOrig, rRefac] = await Promise.all([
      original.callTool(name, args),
      refactored.callTool(name, args),
    ]);
  } catch (err) {
    report(testName, false, `    Error: ${err.message}`);
    return { rOrig: null, rRefac: null };
  }

  // Check for error responses
  const origErr = rOrig?.result?.isError || rOrig?.error;
  const refacErr = rRefac?.result?.isError || rRefac?.error;
  if (origErr && !refacErr) {
    report(testName, false, `    Original returned error, refactored did not.\n    Original: ${JSON.stringify(rOrig?.result || rOrig?.error)}`);
    return { rOrig, rRefac };
  }
  if (!origErr && refacErr) {
    report(testName, false, `    Refactored returned error, original did not.\n    Refactored: ${JSON.stringify(rRefac?.result || rRefac?.error)}`);
    return { rOrig, rRefac };
  }

  // Compare text content
  const textA = extractText(rOrig);
  const textB = extractText(rRefac);
  const textDiff = diff(textA, textB);

  if (textDiff) {
    report(testName, false, `    Text content differs:\n${textDiff}`);
    return { rOrig, rRefac };
  }

  // Optionally compare generated files
  if (compareFiles) {
    for (const { pathA, pathB, fileLabel } of compareFiles) {
      try {
        const [fA, fB] = await Promise.all([
          readFile(pathA, "utf-8"),
          readFile(pathB, "utf-8"),
        ]);
        const fileDiff = diff(fA, fB);
        if (fileDiff) {
          report(testName, false, `    File content differs (${fileLabel}):\n${fileDiff}`);
          return { rOrig, rRefac };
        }
      } catch (err) {
        report(testName, false, `    Could not read output files (${fileLabel}): ${err.message}`);
        return { rOrig, rRefac };
      }
    }
  }

  report(testName, true);
  return { rOrig, rRefac };
}

// ---------------------------------------------------------------------------
// Individual test definitions
// ---------------------------------------------------------------------------

async function testScaffoldWorld(original, refactored, tmpOrig, tmpRefac) {
  const pathA = join(tmpOrig, "scaffold_test.json");
  const pathB = join(tmpRefac, "scaffold_test.json");

  await compareCalls(original, refactored, "scaffold_world", {
    path: pathA,
    title: "Parity Test World",
    background: "A test background for parity comparison.",
    instructions: "Some test instructions.",
  }, {
    label: "scaffold_world",
  });

  // Also call for the refactored server with its own path
  await refactored.callTool("scaffold_world", {
    path: pathB,
    title: "Parity Test World",
    background: "A test background for parity comparison.",
    instructions: "Some test instructions.",
  });

  // Compare the generated files directly
  try {
    const [fA, fB] = await Promise.all([
      readFile(pathA, "utf-8"),
      readFile(pathB, "utf-8"),
    ]);
    const fileDiff = diff(fA, fB);
    if (fileDiff) {
      report("scaffold_world (file content)", false, `    Generated files differ:\n${fileDiff}`);
    } else {
      report("scaffold_world (file content)", true);
    }
  } catch (err) {
    report("scaffold_world (file content)", false, `    Could not read scaffolded files: ${err.message}`);
  }

  return { pathA, pathB };
}

async function testValidateWorld(original, refactored) {
  await compareCalls(original, refactored, "validate_world", {
    path: TEST_WORLD,
  }, { label: "validate_world" });
}

async function testAuditWorld(original, refactored) {
  await compareCalls(original, refactored, "audit_world", {
    path: TEST_WORLD,
  }, { label: "audit_world" });
}

async function testDecompileJson(original, refactored, tmpOrig, tmpRefac) {
  const outA = join(tmpOrig, "decompiled.md");
  const outB = join(tmpRefac, "decompiled.md");

  const [rA, rB] = await Promise.all([
    original.callTool("decompile_json", { inputPath: TEST_WORLD, outputPath: outA }),
    refactored.callTool("decompile_json", { inputPath: TEST_WORLD, outputPath: outB }),
  ]);

  const textDiff = diff(extractText(rA), extractText(rB));
  if (textDiff) {
    report("decompile_json (response)", false, `    Text differs:\n${textDiff}`);
  } else {
    report("decompile_json (response)", true);
  }

  try {
    const [fA, fB] = await Promise.all([
      readFile(outA, "utf-8"),
      readFile(outB, "utf-8"),
    ]);
    const fileDiff = diff(fA, fB);
    if (fileDiff) {
      report("decompile_json (file content)", false, `    Decompiled files differ:\n${fileDiff}`);
    } else {
      report("decompile_json (file content)", true);
    }
  } catch (err) {
    report("decompile_json (file content)", false, `    Could not read decompiled files: ${err.message}`);
  }
}

async function testCompileDraft(original, refactored, tmpOrig, tmpRefac) {
  const outA = join(tmpOrig, "compiled.json");
  const outB = join(tmpRefac, "compiled.json");

  const [rA, rB] = await Promise.all([
    original.callTool("compile_draft", { draftPath: TEST_DRAFT, outputPath: outA }),
    refactored.callTool("compile_draft", { draftPath: TEST_DRAFT, outputPath: outB }),
  ]);

  const textDiff = diff(extractText(rA), extractText(rB));
  if (textDiff) {
    report("compile_draft (response)", false, `    Text differs:\n${textDiff}`);
  } else {
    report("compile_draft (response)", true);
  }

  try {
    const [fA, fB] = await Promise.all([
      readFile(outA, "utf-8"),
      readFile(outB, "utf-8"),
    ]);
    const fileDiff = diff(fA, fB);
    if (fileDiff) {
      report("compile_draft (file content)", false, `    Compiled files differ:\n${fileDiff}`);
    } else {
      report("compile_draft (file content)", true);
    }
  } catch (err) {
    report("compile_draft (file content)", false, `    Could not read compiled files: ${err.message}`);
  }
}

async function testReadDraftSectionBackground(original, refactored) {
  await compareCalls(original, refactored, "read_draft_section", {
    draftPath: TEST_DRAFT,
    sectionName: "Background",
  }, { label: "read_draft_section (Background)" });
}

async function testReadDraftSectionTitle(original, refactored) {
  await compareCalls(original, refactored, "read_draft_section", {
    draftPath: TEST_DRAFT,
    sectionName: "Title",
  }, { label: "read_draft_section (Title)" });
}

async function testUpdateDraftSection(original, refactored, tmpOrig, tmpRefac) {
  // Copy draft to temp dirs
  const draftA = join(tmpOrig, "draft_update_test.md");
  const draftB = join(tmpRefac, "draft_update_test.md");

  await Promise.all([
    cp(TEST_DRAFT, draftA),
    cp(TEST_DRAFT, draftB),
  ]);

  const [rA, rB] = await Promise.all([
    original.callTool("update_draft_section", {
      draftPath: draftA,
      sectionName: "Background",
      newContent: "This is a replaced background for parity testing.",
    }),
    refactored.callTool("update_draft_section", {
      draftPath: draftB,
      sectionName: "Background",
      newContent: "This is a replaced background for parity testing.",
    }),
  ]);

  const textDiff = diff(extractText(rA), extractText(rB));
  if (textDiff) {
    report("update_draft_section (response)", false, `    Text differs:\n${textDiff}`);
  } else {
    report("update_draft_section (response)", true);
  }

  try {
    const [fA, fB] = await Promise.all([
      readFile(draftA, "utf-8"),
      readFile(draftB, "utf-8"),
    ]);
    const fileDiff = diff(fA, fB);
    if (fileDiff) {
      report("update_draft_section (file content)", false, `    Updated drafts differ:\n${fileDiff}`);
    } else {
      report("update_draft_section (file content)", true);
    }
  } catch (err) {
    report("update_draft_section (file content)", false, `    Could not read updated drafts: ${err.message}`);
  }
}

async function testCompareWorlds(original, refactored, scaffoldPathA, scaffoldPathB) {
  // Compare the test world with the scaffolded world — each server uses its own scaffolded file
  const [rA, rB] = await Promise.all([
    original.callTool("compare_worlds", { pathA: TEST_WORLD, pathB: scaffoldPathA }),
    refactored.callTool("compare_worlds", { pathA: TEST_WORLD, pathB: scaffoldPathB }),
  ]);

  const textDiff = diff(extractText(rA), extractText(rB));
  if (textDiff) {
    report("compare_worlds", false, `    Text differs:\n${textDiff}`);
  } else {
    report("compare_worlds", true);
  }
}

async function testConfirmPathExists(original, refactored) {
  await compareCalls(original, refactored, "confirm_path", {
    inputPath: "/home/moose/personalProjects/infinite-worlds-architect-plugin/test-files",
    type: "directory",
  }, { label: "confirm_path (existing directory)" });
}

async function testConfirmPathNotExists(original, refactored) {
  await compareCalls(original, refactored, "confirm_path", {
    inputPath: "/nonexistent/path/that/does/not/exist",
    type: "file",
  }, { label: "confirm_path (nonexistent path)" });
}

async function testGetDiffSummary(original, refactored) {
  await compareCalls(original, refactored, "get_diff_summary", {
    originalPath: TEST_WORLD,
    draftPath: TEST_DRAFT,
  }, { label: "get_diff_summary" });
}

async function testAddInstructionBlock(original, refactored, tmpOrig, tmpRefac) {
  // Scaffold fresh worlds to add blocks to
  const worldA = join(tmpOrig, "add_block_test.json");
  const worldB = join(tmpRefac, "add_block_test.json");

  await Promise.all([
    original.callTool("scaffold_world", {
      path: worldA,
      title: "Block Test",
      background: "Test background.",
    }),
    refactored.callTool("scaffold_world", {
      path: worldB,
      title: "Block Test",
      background: "Test background.",
    }),
  ]);

  const [rA, rB] = await Promise.all([
    original.callTool("add_instruction_block", {
      path: worldA,
      name: "Test Block",
      content: "This is a test instruction block for parity testing.",
    }),
    refactored.callTool("add_instruction_block", {
      path: worldB,
      name: "Test Block",
      content: "This is a test instruction block for parity testing.",
    }),
  ]);

  const textDiff = diff(extractText(rA), extractText(rB));
  if (textDiff) {
    report("add_instruction_block (response)", false, `    Text differs:\n${textDiff}`);
  } else {
    report("add_instruction_block (response)", true);
  }

  try {
    const [fA, fB] = await Promise.all([
      readFile(worldA, "utf-8"),
      readFile(worldB, "utf-8"),
    ]);
    const fileDiff = diff(fA, fB);
    if (fileDiff) {
      report("add_instruction_block (file content)", false, `    Files differ:\n${fileDiff}`);
    } else {
      report("add_instruction_block (file content)", true);
    }
  } catch (err) {
    report("add_instruction_block (file content)", false, `    Could not read files: ${err.message}`);
  }
}

async function testAddTrigger(original, refactored, tmpOrig, tmpRefac) {
  // Scaffold fresh worlds
  const worldA = join(tmpOrig, "add_trigger_test.json");
  const worldB = join(tmpRefac, "add_trigger_test.json");

  await Promise.all([
    original.callTool("scaffold_world", {
      path: worldA,
      title: "Trigger Test",
      background: "Test background.",
    }),
    refactored.callTool("scaffold_world", {
      path: worldB,
      title: "Trigger Test",
      background: "Test background.",
    }),
  ]);

  // Test with modern conditions/effects arrays
  const triggerArgs = {
    name: "Test Event",
    conditions: [
      { type: "triggerOnEvent", data: "Player enters the room" },
      { type: "triggerOnTurn", data: { turn: 5 } },
    ],
    effects: [
      { type: "scriptedText", data: "A loud boom echoes through the hall." },
      { type: "giveGuidance", data: "The player should feel uneasy." },
    ],
    canTriggerMoreThanOnce: true,
  };

  const [rA, rB] = await Promise.all([
    original.callTool("add_trigger", { path: worldA, ...triggerArgs }),
    refactored.callTool("add_trigger", { path: worldB, ...triggerArgs }),
  ]);

  const textDiff = diff(extractText(rA), extractText(rB));
  if (textDiff) {
    report("add_trigger (conditions/effects)", false, `    Text differs:\n${textDiff}`);
  } else {
    report("add_trigger (conditions/effects)", true);
  }

  try {
    const [fA, fB] = await Promise.all([
      readFile(worldA, "utf-8"),
      readFile(worldB, "utf-8"),
    ]);
    const fileDiff = diff(fA, fB);
    if (fileDiff) {
      report("add_trigger (conditions/effects file)", false, `    Files differ:\n${fileDiff}`);
    } else {
      report("add_trigger (conditions/effects file)", true);
    }
  } catch (err) {
    report("add_trigger (conditions/effects file)", false, `    Could not read files: ${err.message}`);
  }
}

async function testAddTriggerLegacy(original, refactored, tmpOrig, tmpRefac) {
  // Scaffold fresh worlds for legacy params test
  const worldA = join(tmpOrig, "add_trigger_legacy_test.json");
  const worldB = join(tmpRefac, "add_trigger_legacy_test.json");

  await Promise.all([
    original.callTool("scaffold_world", {
      path: worldA,
      title: "Legacy Trigger Test",
      background: "Test background.",
    }),
    refactored.callTool("scaffold_world", {
      path: worldB,
      title: "Legacy Trigger Test",
      background: "Test background.",
    }),
  ]);

  // Test with legacy single condition/effect params
  const legacyArgs = {
    name: "Legacy Event",
    conditionType: "triggerOnEvent",
    conditionData: "Someone says the magic word",
    effectType: "scriptedText",
    effectData: "Lightning strikes the tower!",
  };

  const [rA, rB] = await Promise.all([
    original.callTool("add_trigger", { path: worldA, ...legacyArgs }),
    refactored.callTool("add_trigger", { path: worldB, ...legacyArgs }),
  ]);

  const textDiff = diff(extractText(rA), extractText(rB));
  if (textDiff) {
    report("add_trigger (legacy params)", false, `    Text differs:\n${textDiff}`);
  } else {
    report("add_trigger (legacy params)", true);
  }

  try {
    const [fA, fB] = await Promise.all([
      readFile(worldA, "utf-8"),
      readFile(worldB, "utf-8"),
    ]);
    const fileDiff = diff(fA, fB);
    if (fileDiff) {
      report("add_trigger (legacy params file)", false, `    Files differ:\n${fileDiff}`);
    } else {
      report("add_trigger (legacy params file)", true);
    }
  } catch (err) {
    report("add_trigger (legacy params file)", false, `    Could not read files: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Entity add/modify tool tests (P2a parity)
// ---------------------------------------------------------------------------

async function testEntityTool(original, refactored, tmpOrig, tmpRefac, toolName, toolArgs) {
  const worldA = join(tmpOrig, `${toolName}_test.json`);
  const worldB = join(tmpRefac, `${toolName}_test.json`);

  await Promise.all([
    original.callTool("scaffold_world", { path: worldA, title: `${toolName} Test` }),
    refactored.callTool("scaffold_world", { path: worldB, title: `${toolName} Test` }),
  ]);

  const [rA, rB] = await Promise.all([
    original.callTool(toolName, { path: worldA, ...toolArgs }),
    refactored.callTool(toolName, { path: worldB, ...toolArgs }),
  ]);

  const textDiff = diff(extractText(rA), extractText(rB));
  report(`${toolName} (response)`, !textDiff, textDiff ? `    Text differs:\n${textDiff}` : undefined);

  try {
    const [fA, fB] = await Promise.all([readFile(worldA, "utf-8"), readFile(worldB, "utf-8")]);
    const fileDiff = diff(fA, fB);
    report(`${toolName} (file)`, !fileDiff, fileDiff ? `    Files differ:\n${fileDiff}` : undefined);
  } catch (err) {
    report(`${toolName} (file)`, false, `    Could not read files: ${err.message}`);
  }
}

async function testModifyTool(original, refactored, tmpOrig, tmpRefac, addTool, addArgs, modTool, modArgs) {
  const worldA = join(tmpOrig, `${modTool}_test.json`);
  const worldB = join(tmpRefac, `${modTool}_test.json`);

  await Promise.all([
    original.callTool("scaffold_world", { path: worldA, title: `${modTool} Test` }),
    refactored.callTool("scaffold_world", { path: worldB, title: `${modTool} Test` }),
  ]);

  await Promise.all([
    original.callTool(addTool, { path: worldA, ...addArgs }),
    refactored.callTool(addTool, { path: worldB, ...addArgs }),
  ]);

  const [rA, rB] = await Promise.all([
    original.callTool(modTool, { path: worldA, ...modArgs }),
    refactored.callTool(modTool, { path: worldB, ...modArgs }),
  ]);

  const textDiff = diff(extractText(rA), extractText(rB));
  report(`${modTool} (response)`, !textDiff, textDiff ? `    Text differs:\n${textDiff}` : undefined);

  try {
    const [fA, fB] = await Promise.all([readFile(worldA, "utf-8"), readFile(worldB, "utf-8")]);
    const fileDiff = diff(fA, fB);
    report(`${modTool} (file)`, !fileDiff, fileDiff ? `    Files differ:\n${fileDiff}` : undefined);
  } catch (err) {
    report(`${modTool} (file)`, false, `    Could not read files: ${err.message}`);
  }
}

async function testModifyTriggerEvent(original, refactored, tmpOrig, tmpRefac) {
  const worldA = join(tmpOrig, "modify_trigger_test.json");
  const worldB = join(tmpRefac, "modify_trigger_test.json");

  await Promise.all([
    original.callTool("scaffold_world", { path: worldA, title: "Modify Trigger Test" }),
    refactored.callTool("scaffold_world", { path: worldB, title: "Modify Trigger Test" }),
  ]);

  const triggerArgs = {
    name: "Original Trigger",
    conditions: [{ type: "triggerOnEvent", data: "Something happens" }],
    effects: [{ type: "scriptedText", data: "Boom!" }],
  };

  await Promise.all([
    original.callTool("add_trigger", { path: worldA, ...triggerArgs }),
    refactored.callTool("add_trigger", { path: worldB, ...triggerArgs }),
  ]);

  const modArgs = {
    name: "Original Trigger",
    newName: "Renamed Trigger",
    conditions: [{ type: "triggerOnTurn", data: 10 }],
    canTriggerMoreThanOnce: true,
  };

  const [rA, rB] = await Promise.all([
    original.callTool("modify_trigger_event", { path: worldA, ...modArgs }),
    refactored.callTool("modify_trigger_event", { path: worldB, ...modArgs }),
  ]);

  const textDiff = diff(extractText(rA), extractText(rB));
  report("modify_trigger_event (response)", !textDiff, textDiff ? `    Text differs:\n${textDiff}` : undefined);

  try {
    const [fA, fB] = await Promise.all([readFile(worldA, "utf-8"), readFile(worldB, "utf-8")]);
    const fileDiff = diff(fA, fB);
    report("modify_trigger_event (file)", !fileDiff, fileDiff ? `    Files differ:\n${fileDiff}` : undefined);
  } catch (err) {
    report("modify_trigger_event (file)", false, `    Could not read files: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("MCP Parity Test Harness");
  console.log("=======================\n");
  console.log(`Original server:   ${ORIGINAL_SERVER}`);
  console.log(`Refactored server: ${REFACTORED_SERVER}\n`);

  // Create isolated temp directories
  const tmpOrig = await mkdtemp(join(TMP_ROOT, "parity-orig-"));
  const tmpRefac = await mkdtemp(join(TMP_ROOT, "parity-refac-"));

  console.log(`Temp dir (original):   ${tmpOrig}`);
  console.log(`Temp dir (refactored): ${tmpRefac}\n`);

  const original = new McpClient("original", ORIGINAL_SERVER);
  const refactored = new McpClient("refactored", REFACTORED_SERVER);

  try {
    // Start both servers
    console.log("Starting MCP servers...");
    await Promise.all([original.start(), refactored.start()]);
    console.log("Both servers initialized.\n");

    // Verify tools/list parity first
    console.log("--- tools/list parity ---");
    const [toolsOrig, toolsRefac] = await Promise.all([
      original.listTools(),
      refactored.listTools(),
    ]);
    const toolsDiff = diff(
      normaliseJson(toolsOrig?.result),
      normaliseJson(toolsRefac?.result),
    );
    if (toolsDiff) {
      report("tools/list", false, `    Tool definitions differ:\n${toolsDiff}`);
    } else {
      report("tools/list", true);
    }

    // Run tests
    console.log("\n--- scaffold_world ---");
    const { pathA: scaffoldPathA, pathB: scaffoldPathB } =
      await testScaffoldWorld(original, refactored, tmpOrig, tmpRefac);

    console.log("\n--- validate_world ---");
    await testValidateWorld(original, refactored);

    console.log("\n--- audit_world ---");
    await testAuditWorld(original, refactored);

    console.log("\n--- decompile_json ---");
    await testDecompileJson(original, refactored, tmpOrig, tmpRefac);

    console.log("\n--- compile_draft ---");
    await testCompileDraft(original, refactored, tmpOrig, tmpRefac);

    console.log("\n--- read_draft_section ---");
    await testReadDraftSectionBackground(original, refactored);
    await testReadDraftSectionTitle(original, refactored);

    console.log("\n--- update_draft_section ---");
    await testUpdateDraftSection(original, refactored, tmpOrig, tmpRefac);

    console.log("\n--- compare_worlds ---");
    await testCompareWorlds(original, refactored, scaffoldPathA, scaffoldPathB);

    console.log("\n--- confirm_path ---");
    await testConfirmPathExists(original, refactored);
    await testConfirmPathNotExists(original, refactored);

    console.log("\n--- get_diff_summary ---");
    await testGetDiffSummary(original, refactored);

    console.log("\n--- add_instruction_block ---");
    await testAddInstructionBlock(original, refactored, tmpOrig, tmpRefac);

    console.log("\n--- add_trigger ---");
    await testAddTrigger(original, refactored, tmpOrig, tmpRefac);
    await testAddTriggerLegacy(original, refactored, tmpOrig, tmpRefac);

    console.log("\n--- add_character ---");
    await testEntityTool(original, refactored, tmpOrig, tmpRefac, "add_character", {
      name: "Hero", description: "A brave warrior", portrait: "hero.png",
      skills: { Strength: 4, Charisma: 2 }
    });

    console.log("\n--- add_npc ---");
    await testEntityTool(original, refactored, tmpOrig, tmpRefac, "add_npc", {
      name: "Villager", detail: "A friendly villager", one_liner: "Just a villager",
      appearance: "Tall and thin", location: "Town square", secret_info: "Secretly a spy",
      names: ["Villager", "Bob"], img_appearance: "tall thin man", img_clothing: "brown tunic"
    });

    console.log("\n--- add_tracked_item ---");
    await testEntityTool(original, refactored, tmpOrig, tmpRefac, "add_tracked_item", {
      name: "Gold", dataType: "number", visibility: "everyone",
      description: "Currency", updateInstructions: "Add gold on loot", initialValue: "100"
    });

    console.log("\n--- modify_character ---");
    await testModifyTool(original, refactored, tmpOrig, tmpRefac,
      "add_character", { name: "Editable Hero", description: "Original" },
      "modify_character", { name: "Editable Hero", description: "Updated hero desc", skills: { Wisdom: 3 } }
    );

    console.log("\n--- modify_npc ---");
    await testModifyTool(original, refactored, tmpOrig, tmpRefac,
      "add_npc", { name: "Editable NPC", detail: "Original detail" },
      "modify_npc", { name: "Editable NPC", detail: "Updated detail", location: "New location" }
    );

    console.log("\n--- modify_tracked_item ---");
    await testModifyTool(original, refactored, tmpOrig, tmpRefac,
      "add_tracked_item", { name: "Editable Item", dataType: "text", visibility: "everyone", initialValue: "start" },
      "modify_tracked_item", { name: "Editable Item", dataType: "number", initialValue: "42" }
    );

    console.log("\n--- modify_trigger_event ---");
    await testModifyTriggerEvent(original, refactored, tmpOrig, tmpRefac);

  } finally {
    // Stop servers
    console.log("\nShutting down servers...");
    await Promise.all([original.stop(), refactored.stop()]);

    // Clean up temp dirs
    await Promise.all([
      rm(tmpOrig, { recursive: true, force: true }),
      rm(tmpRefac, { recursive: true, force: true }),
    ]);
  }

  // Summary
  console.log("\n=======================");
  console.log("Summary");
  console.log("=======================");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;
  console.log(`  Total:  ${total}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);

  if (failed > 0) {
    console.log("\nFailed tests:");
    for (const r of results) {
      if (!r.passed) console.log(`  - ${r.name}`);
    }
  }

  console.log();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
