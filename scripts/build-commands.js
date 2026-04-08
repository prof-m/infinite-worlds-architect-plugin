import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const skillsDir = path.join(__dirname, '..', 'skills');
const commandsDir = path.join(__dirname, '..', 'commands', 'infinite-worlds-architect');

// Ensure the commands directory exists
if (!fs.existsSync(commandsDir)) {
    fs.mkdirSync(commandsDir, { recursive: true });
}

console.log('Synchronizing SKILL.md files to Gemini Extension commands...');

const skills = fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

let successCount = 0;

for (const skill of skills) {
    const skillMdPath = path.join(skillsDir, skill, 'SKILL.md');
    
    if (!fs.existsSync(skillMdPath)) {
        continue;
    }

    const content = fs.readFileSync(skillMdPath, 'utf8');

    // Simple robust Regex to extract the frontmatter block
    const fmRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(fmRegex);

    if (!match) {
        console.warn(`WARNING: Invalid frontmatter in ${skillMdPath}`);
        continue;
    }

    const frontmatterRaw = match[1];
    let markdownBody = match[2];

    // Safely trim leading newlines from the body
    markdownBody = markdownBody.replace(/^\n+/, '');

    // Extract name and description from the raw frontmatter text via regex
    // We assume the description is contained on a single line and wrapped in quotes or naked
    const nameMatch = frontmatterRaw.match(/^name:\s*(.+)$/m);
    let descMatch = frontmatterRaw.match(/^description:\s*(.+)$/m);

    if (!nameMatch) {
        console.warn(`WARNING: Missing 'name:' field in ${skillMdPath}`);
        continue;
    }
    
    let commandName = nameMatch[1].trim().replace(/^["']|["']$/g, '');
    let description = descMatch ? descMatch[1].trim().replace(/^["']|["']$/g, '') : "No description provided.";

    // Use JSON.stringify to safely format the strings as TOML basic strings
    // JSON strings perfectly map to TOML basic strings (handles \n, \t, and escaping " characters).
    const safeDesc = JSON.stringify(description);
    const safePrompt = JSON.stringify(markdownBody);

    const tomlContent = `description = ${safeDesc}\nprompt = ${safePrompt}\n`;
    
    const outPath = path.join(commandsDir, `${commandName}.toml`);
    fs.writeFileSync(outPath, tomlContent, 'utf8');
    
    console.log(`✅ Synced ${commandName}.toml`);
    successCount++;
}

console.log(`\nSuccessfully built ${successCount} commands.`);
