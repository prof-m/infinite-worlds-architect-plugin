# Infinite Worlds - Token Efficiency Guide

Efficient world design ensures lower Credit costs and higher AI performance (less "forgetting"). Follow these mandates when architecting a world.

## The Efficiency vs. Quality Balance
Aggressively trimming field values saves credits, but doing so without care may cause the AI to lose narrative nuance or break logic loops. As an Architect, you must constantly balance credit efficiency with preserving the vital context the AI needs to understand the world's rules and tone.

## 1. The Cost of "Always-On" Static Context
- **The Mechanic**: Fields like `instructions`, `background`, `objective`, and `descriptionRequest` are injected into the AI's context on *every single turn*.
- **Evergreen Content**: Keep `background` and `objective` strictly evergreen—focusing only on the overarching premise and ultimate goals. Avoid highly specific "Turn 1" setups (e.g., "Your first assignment is..."), otherwise you pay for outdated information on Turn 50.
- **The 80/20 Rule**: Keep Main Instructions lean. Only include core mechanics, the overarching tone, and absolute "must-know" world rules.

## 2. Avoid "Double-Charging" (System Redundancy)
- **Rely on Auto-Injection**: The Infinite Worlds engine automatically injects Player Character details, NPC details (when they enter a scene), and Trigger Event effects when triggered.
- **Do Not Reduplicate**: Never put PC details, NPC physical descriptions/personality traits, or Trigger mechanics into your Main Instructions. Doing so forces you to pay for that text redundantly—either paying when it's irrelevant, or getting double-charged when it *is* relevant.
- **Strategic NPC Summaries**: Always provide a high-signal **Brief Summary** for NPCs. Reserve **Character Detail** for deep backstory that only matters once the character is active in the scene.

## 3. Prompt Engineering for Efficiency
- **Hyper-Dense Logic**: Instructions across all fields often bloat with conversational prose. Convert them into hyper-dense, robotic logic. Stripping out conversational prose saves credits and improves AI adherence by reducing "noise" (e.g., use *"Format: '[character]: Suggestion'. Add when character in trance is given suggestion."* instead of *"Whenever a character is given a suggestion..."*).
- **Explicit Exclusivity**: LLMs are terrible at implied negative constraints (e.g., *"Only consider other characters if X is empty"*). To force an LLM to select a single item or stop evaluating a list of rules, use rigid, exclusive language like *"MUST ONLY contain X,"* *"Exclude all others,"* and explicitly command it to *"Skip the remaining rules"*.

## 4. Strategic Use of Keyword Blocks
- **The Ideal Use Case**: Keyword Blocks are your primary tool for moving data out of the expensive "always-on" static context. Use them for deep world lore (history, factions, magic systems), specific location descriptions, conditional mechanics, or individual target dossiers.
- **Effective Structuring**: Your trigger arrays should be robust, including synonyms, related concepts, and likely misspellings (e.g., `["magic", "spell", "casting", "mana"]`). Keep the internal content hyper-focused and bulleted.
- **The Limits (High-Frequency Instructions)**: Keyword blocks do **not** save credits for tasks that happen almost every turn (such as Image Generation rules or persistent formatting requirements). If trigger keywords (like `image` or `prompt`) are present constantly, the block is always injected. Aggressive text condensation is your only optimization tool here.

## 5. The "SecretInfo" Pipeline
- The **Summary AI** (starting Turn 8) is your friend for long-term memory.
- **Mandate**: Instruct the Storyteller AI (via `descriptionRequest`) to write vital state changes (inventory, relationship shifts) into `secretInfo`.
- **Reason**: The Summary AI weights `secretInfo` heavily when condensing the story, ensuring important details survive into the long-term summary without wasting tokens on flavor text.

## 6. Tracked Item Visibility
- While Tracked Items have a 10k character limit, the AI must process them every turn.
- Avoid tracking "flavor" items. If a variable doesn't affect a Trigger or a Skill Check, consider moving it to a narrative summary instead.

## 7. Model Optimization
- If using expensive models like "Smilodon" or "Massivecat," use **AI-Specific Extra Instruction Blocks**.
- Only send complex logic to the models that can actually parse it.

## 8. Auto-Normalization of Instructions
The Architect extension automatically normalizes instructional fields (Main Instructions, Keyword Blocks, Description Request, etc.) during compilation to save tokens.
- **Bold/Italic Removal**: `**Bold**` markers are stripped.
- **Bullet Point Removal**: `-`, `*`, and `+` markers at the start of lines are removed, but **indentation is preserved**.
- **Efficiency Tip**: You can continue using Markdown in your `draft_world.md` for human readability; the compiler will handle the token-saving cleanup for you.