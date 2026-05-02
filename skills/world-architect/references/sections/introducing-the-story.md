# Field Guide: Introducing the Story

Fields: `title`, `description`, `background`, `firstInput`, `objective`

---

## title
**User-facing only. Does NOT influence the storyteller AI.**

The world's name, displayed on the world browser card and at the top of the game interface. Keep it evocative and concise. The platform also supports version tracking on the title field (auto-incremented on edits; can be disabled).

---

## description
**User-facing only. Does NOT influence the storyteller AI.**

A short blurb shown beneath the title on the world browser card. Used by players browsing worlds to decide whether to play. Should convey the core premise, tone, and any content context. Think of it as marketing copy — informative but brief.

---

## background (`background`)
**Shown to players before turn 1. Sent to the storyteller AI every turn UNTIL the first Summary event.**

The initial situation and premise of the story. This field is powerful but time-limited: once the Summary AI runs for the first time (turn 8), it incorporates the background into game summaries and Background is no longer directly sent to the storyteller.

**What to put here:**
- The opening world situation — where the player is, what's going on, what kind of story this is
- Tone-setting information the AI needs from the very first turn
- The "status quo before the adventure begins"

**What NOT to put here:**
- Ongoing story developments or evolving state (this field is static after turn 1)
- Redundant character descriptions (player characters go in `possibleCharacters`; NPCs go in `NPCs`)
- Detailed location or faction lore (use keyword instruction blocks for on-demand injection)

**Authoring tip:** Write Background strictly as the situation *at the very beginning* of the story. If something changes during play, use `changeAdventureBackground` trigger effects or `summaryRequest` to handle updates. Background should remain "evergreen" — relevant on turn 50 as much as turn 1.

---

## firstInput (`firstInput`)
**Single-use hidden prompt. Sent only on turn 0, before the player acts.**

Resembles a player action but is written by the world author. Sets the opening scene — the storyteller AI receives this as if it were the player's first move, writing the initial `outcomeDescription` from it. The player never sees this field directly.

**What to put here:**
- The inciting scene-setting action: "A message arrives on your desk..." or "You step off the train into the fog..."
- The specific situation the player wakes up into at story start
- Any opening narration you want the AI to generate

**Key behaviour:** Can be modified during play via the `changeFirstAction` trigger effect. Pairs well with `changeAdventureBackground` for character-specific opening experiences (e.g., one `changeFirstAction` per player character triggered by `triggerOnCharacter`).

---

## objective (`objective`)
**Displayed to the player at the end of turn 1. Sent to the storyteller AI every turn.**

The primary goal for the player. The wiki describes this as "a very powerful tool in the hands of a world author" because the AI receives it every turn with explicit instructions that it represents the player's objective — the AI actively steers the story toward satisfying this goal.

**What to put here:**
- The player's driving goal, written as a clear directive
- Should remain accurate as the story evolves, OR be updated via triggers

**Key behaviour:**
- The AI prioritises this field strongly when making narrative decisions
- Can be silently changed mid-game using the `changeObjective` trigger effect — described as "exceptionally helpful for silently modifying the objective to convince the AI to carry out elements that might be contrary to the desires of the player character" (useful for corruption arcs, quest progression, loyalty shifts)
- Players see the current objective displayed in the UI each turn

**Authoring tip:** If your world has multiple story phases or evolving goals, start with the initial objective and wire up `changeObjective` triggers at phase transitions. The player will see the new objective appear seamlessly.
