import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const skillsDir = path.join(__dirname, '..', 'skills');
const commandsDir = path.join(__dirname, '..', 'commands', 'infinite-worlds-architect');

// Ensure the commands directory exists
if (!fs.existsSync(commandsDir)) {
    fs.mkdirSync(commandsDir, { recursive: true });
}

// Skills that provide context/knowledge to the AI but are not user-invokable
// slash commands. They should not be generated as TOML command files.
const SKILLS_ONLY = new Set(['world-architect']);

console.log('Synchronizing SKILL.md files to Gemini Extension commands...');

const skills = fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

let successCount = 0;
let errorCount = 0;

for (const skill of skills) {
    const skillMdPath = path.join(skillsDir, skill, 'SKILL.md');

    if (!fs.existsSync(skillMdPath)) {
        continue;
    }

    // Skip skills that are AI context documents, not slash commands.
    if (SKILLS_ONLY.has(skill)) {
        console.log(`⏭️  Skipping ${skill} (skill-only, not a command).`);
        continue;
    }

    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Split frontmatter from body using the --- delimiters
    const fmRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(fmRegex);

    if (!match) {
        console.warn(`WARNING: Invalid or missing frontmatter in ${skillMdPath}`);
        continue;
    }

    const frontmatterRaw = match[1];
    let markdownBody = match[2];

    // Safely trim leading newlines from the body
    markdownBody = markdownBody.replace(/^\n+/, '');

    // Use js-yaml to robustly parse the frontmatter block, handling multi-line
    // values, quoted strings, YAML escape sequences, and block scalars correctly.
    let frontmatter;
    try {
        frontmatter = yaml.load(frontmatterRaw);
    } catch (e) {
        console.warn(`WARNING: Could not parse YAML frontmatter in ${skillMdPath}: ${e.message}`);
        errorCount++;
        continue;
    }

    if (!frontmatter || !frontmatter.name) {
        console.warn(`WARNING: Missing 'name:' field in ${skillMdPath}`);
        errorCount++;
        continue;
    }

    const rawCommandName = String(frontmatter.name).trim();
    const description = frontmatter.description
        ? String(frontmatter.description).trim()
        : 'No description provided.';

    // Sanitize commandName against path traversal (e.g. "../" in the name field).
    // path.basename strips all directory components, leaving only the final filename segment.
    const commandName = path.basename(rawCommandName);
    if (commandName !== rawCommandName) {
        console.warn(`WARNING: Unsafe name field "${rawCommandName}" in ${skillMdPath} — skipping.`);
        errorCount++;
        continue;
    }

    // Use JSON.stringify to safely format the strings as TOML basic strings.
    // JSON and TOML basic strings share the same escape rules, so this handles
    // embedded newlines, tabs, and quotes safely without any custom escaping.
    const safeDesc = JSON.stringify(description);
    const safePrompt = JSON.stringify(markdownBody);

    const tomlContent = `description = ${safeDesc}\nprompt = ${safePrompt}\n`;

    const outPath = path.join(commandsDir, `${commandName}.toml`);
    fs.writeFileSync(outPath, tomlContent, 'utf8');

    console.log(`✅ Synced ${commandName}.toml`);
    successCount++;
}

console.log(`\nSuccessfully built ${successCount} commands.`);

// Exit non-zero if every eligible skill failed — this ensures the pre-commit
// exit guard catches not just crashes but also "all files were malformed" cases.
const eligibleCount = skills.filter(s =>
    fs.existsSync(path.join(skillsDir, s, 'SKILL.md')) && !SKILLS_ONLY.has(s)
).length;
if (successCount === 0 && eligibleCount > 0) {
    console.error(`❌ No commands were successfully built (${errorCount} error(s)). Check SKILL.md files.`);
    process.exit(1);
}
