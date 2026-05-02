# Field Guide: Keyword Instruction Blocks

JSON key: `loreBookEntries` — array of keyword block objects

Each entry has: `id`, `name`, `keywords` (string[]), `content`

---

## What Keyword Instruction Blocks Do

KIBs are conditional instruction blocks delivered to the storyteller AI only when specific keywords appear in recent context. They act like "Lore Books" — invisible until triggered, then injected into the AI's context for a window of turns.

**The AI has zero awareness of a KIB's existence until it is triggered.** The AI cannot reference, hint at, or be aware of content in an unfired KIB. This is by design — unfired blocks cost zero tokens.

---

## Keyword Matching Mechanics

**Substring match, case-insensitive.** Keywords are matched by simple string comparison:
- The keyword `"hat"` will match "whatever", "chatter", "hatchet" — any word containing that letter sequence
- The keyword `"magic"` will match "magical", "magician", "magic"
- Case does not matter: `"Dragon"` matches "dragon", "DRAGON", "A Dragon Appears"

**What triggers matching:**
- Keywords found in the **player's input** → block activates for that turn's AI response
- Keywords found in the **AI's output** → block activates for the **following** turn

**Injection window:** Once triggered, the KIB content remains active for **the next 3 turns** regardless of whether the keyword continues to appear.

---

## The Awareness Paradox

Because the AI has no awareness of a KIB until it fires, there is a design challenge: **if a topic is never mentioned, the KIB that covers it will never activate**.

For topics that might never organically surface, you may need a brief mention in Main Instructions to ensure the AI references the topic when appropriate. Example: include "The ruins of Valdrath are accessible from the western forest path" in instructions even if the full Valdrath lore is in a KIB — this creates a path for the keyword "Valdrath" to appear naturally.

---

## What to Put in KIBs

**Ideal use cases:**
- Deep world lore: history, faction backgrounds, magic system mechanics
- Location descriptions: what a place looks, sounds, smells like
- Conditional mechanics: rules that only apply in specific situations (e.g., underwater combat rules only when underwater)
- Character-specific context: detailed dossiers on characters the player may never meet
- Optional content players may never encounter

**Not suited for KIBs:**
- High-frequency instructions (e.g., image generation format rules that trigger every turn) — if the keyword appears constantly, the block is always injected and you pay for it every turn. Use Main Instructions or EIBs instead
- Content the AI needs from turn 1 — use `instructions` or `background` for always-needed context

---

## Keyword Design Guidelines

- Include synonyms, related concepts, and likely misspellings: `["magic", "spell", "casting", "mana", "sorcery"]`
- Use specific multi-word phrases for precision when single words would over-trigger: `["haunted forest", "the forest"]` vs just `["forest"]`
- Keep internal block content hyper-focused and bulleted — this content will be injected mid-narrative, so clarity matters
- The first keyword in the array becomes the block's display name in the UI

---

## Relationship to Extra Instruction Blocks

| Feature | Keyword Blocks (`loreBookEntries`) | Extra Instruction Blocks (`instructionBlocks`) |
|---|---|---|
| Activation | Keyword match in context | Always-on (or trigger-modified) |
| Token cost | Zero until triggered | Every turn |
| Best for | Conditional/optional lore | Core mechanics, phase instructions |
| Can be modified by triggers | Yes (`changeLorebook`) | Yes (`changeInstructionBlock`) |
