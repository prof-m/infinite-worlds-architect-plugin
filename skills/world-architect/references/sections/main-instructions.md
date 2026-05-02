# Field Guide: Main Instructions

Fields: `instructions`, `instructionBlocks`, `authorStyle`, `designNotes`, `nsfw`, `contentWarnings`

---

## instructions (`instructions`)
**Sent to the storyteller AI every turn. Highest cost field.**

The core block on which all other AI decision-making is built. Establishes setting, tone, mechanics, key rules, and anything the AI must know on every single turn. Instruction length directly impacts token cost — every word here is paid for on every turn.

**What to put here:**
- Core mechanics the AI must apply every turn (skill checks, evaluation rules, formatting requirements)
- The overarching tone and absolute "must-know" world rules
- Constraints on AI behaviour that cannot be conditionalised (e.g., "Never break the fourth wall")
- High-frequency formatting rules (image generation instructions, HUD formats)

**What NOT to put here:**
- Player character details (auto-injected by the engine)
- NPC physical descriptions/personality (auto-injected when the character appears)
- Deep lore that only matters in specific situations (use keyword instruction blocks)
- Trigger mechanics (auto-injected when triggered)
- Anything that only applies in some turns — redundant context costs credits every turn

**Efficiency principle (80/20 rule):** Keep instructions lean. Only core mechanics, overarching tone, and absolute must-know rules. Offload conditional, situational, and deep lore to `loreBookEntries` (keyword blocks).

**Prompt engineering tips:**
- Use hyper-dense, robotic logic over conversational prose: strip filler words
- Use rigid exclusive language for constraints: "MUST ONLY contain X", "Exclude all others", "Skip remaining rules"
- LLMs struggle with implied negative constraints — always make exclusions explicit
- The compiler strips bold/italic markers and bullet point characters during compilation (they cost tokens without helping the AI)

---

## instructionBlocks (Extra Instruction Blocks)
**Appended after main instructions. Can be modified via triggers.**

Separated blocks of instructions that extend the main instructions block. Each block has a `name`, `content`, and optionally an AI model restriction (when `enableAISpecificInstructionBlocks` is true).

**Key advantages over cramming everything into `instructions`:**
- Can be fully replaced by `changeInstructionBlock` trigger effects without touching main instructions
- AI-specific EIBs allow sending different instruction variants to different AI models (reduces cost by only sending complex logic to models that can parse it)
- Modular — easy to update one section without rewriting the whole instructions block

**When to use:** Phase-specific content (chapter 2 rules), model-specific optimisations, anything that needs to be swappable mid-game.

---

## authorStyle (`authorStyle`)
**Sent to the storyteller AI every turn. Controls the AI's writing role and voice.**

Defines how the AI writes its `outcomeDescription` output — the writing style, tone, narrative perspective, and genre. The AI "adopts the role and approach that the instructions appear to use/assign them."

**What to put here:**
- Writing style descriptor: "Gritty noir detective fiction", "Whimsical fairy tale", "Clinical psychological horror"
- Narrative person and tense if not enforced in `descriptionRequest`
- Author persona: "You are a master storyteller in the style of Ursula K. Le Guin"
- Any stylistic rules the AI should follow consistently

**Power technique:** Explicitly stating AI capabilities in Author Style improves performance. Example: "You excel at tracking numerical state changes precisely" will make the AI more careful with numbers. "You are an expert at maintaining consistent character voices across dialogue" improves dialogue fidelity.

**Can be replaced mid-game** via the `changeAuthorStyle` trigger effect — useful for genre transitions or tonal shifts as the story progresses.

---

## designNotes (`designNotes`)
**NEVER sent to the AI. Personal author notes only.**

A scratchpad for the world author — original prompts, implementation notes, design intentions, reminders. Completely excluded from AI processing. Use freely without any concern about token cost or AI behaviour.

---

## nsfw (`nsfw`)
**Boolean flag. Controls platform categorisation, NOT AI behaviour.**

When `true`, the world is categorised as containing adult themes (drugs, violence, gore, etc.) in the platform's world browser. This is a thematic sorting mechanism for the platform — it does NOT change how the storyteller AI behaves during play. AI content behaviour is controlled via `instructions` and `authorStyle`.

---

## contentWarnings (`contentWarnings`)
**Comma-separated string. Displayed as acknowledgement prompt before gameplay.**

Lists specific themes players must acknowledge before the story begins. Examples: "graphic violence, non-consensual situations, substance abuse". Purely a player-facing disclosure mechanism — no effect on AI behaviour.
