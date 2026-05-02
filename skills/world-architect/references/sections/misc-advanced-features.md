# Field Guide: Misc Advanced Features

Fields: `descriptionRequest`, `summaryRequest`

---

## descriptionRequest (`descriptionRequest`)
**Sent to the storyteller AI every turn. Described as "one of the most powerful and therefore important fields available to a world author."**

Controls how the storyteller AI writes its `outcomeDescription`, `secretInfo`, and potentially tracked item updates. The AI interprets and follows these instructions literally — including unusual or very specific directives.

### Default Instructions (applied when field is empty)
> "Briefly describe the immediate results of my action, without any preamble or reminding me of who my character is. Describe any dialogue in full. Describe the physical appearance of any newly introduced characters in detail. Remember that things may go well - or very badly - for my character. Please write your description over several paragraphs."

**Any custom text completely overwrites this default.** If you provide custom instructions, the default text is gone entirely — include what you need from the default in your custom version if you want to keep those behaviours.

### What You Can Control
- **Point-of-view and tense:** `"Always write in first-person point of view, present tense, from my character's perspective."`
- **Naming conventions:** `"Never refer to my character by name — always use 'I' or 'me'. Avoid repeating other characters' names more than once per paragraph."`
- **Information placement:** `"Write all mechanical state changes (inventory, relationship shifts, skill effects) into secretInfo, not outcomeDescription."`
- **Structural rules:** `"Begin every response with a one-sentence summary of what happened. Separate dialogue with line breaks."`
- **Style constraints:** `"Never use adverbs. Never begin a sentence with 'I'."`
- **Character descriptions:** `"When a new character appears, describe their appearance in the first paragraph they appear in."`

### The secretInfo Pipeline
`descriptionRequest` is the primary mechanism for forcing the AI to write important state information into `secretInfo`. The Summary AI weights `secretInfo` heavily — information written there survives into long-term summaries better than information only in `outcomeDescription`.

Pattern: `"Whenever the player's inventory changes, write the complete current inventory to secretInfo under the key [Inventory]."`

### Can be modified mid-game
Use the `changeDescriptionInstructions` trigger effect to replace description instructions during play — useful for shifting narrative perspective or enforcing new rules at a plot transition.

---

## summaryRequest (`summaryRequest`)
**Read by the Summary AI only. Has no effect on the storyteller AI.**

Directs the Summary AI regarding what to focus on, how to handle character records, what plot threads to track, and the level of detail to maintain.

### When the Summary AI Runs
- First summary: **turn 8**
- Subsequently: every 6 turns (turn 14, 20, 26, ...)
- At turn 8, the storyteller AI can no longer see `background` directly — it only sees 2–6 recent turns of history and the Summary AI's output

### Summary Structure
The Summary AI produces: a **main summary** (max 1,500 words before condensation is required), **plot threads**, and **character records**.

### What to Put Here
- Focus directives: `"Prioritise tracking the player's relationships with named characters over environmental details."`
- Character record instructions: `"Maintain detailed records for all named NPCs. Note any changes in their attitude toward the player."`
- Appearance consistency: `"Ensure each character's appearance in their record matches their illustrAppearance and illustrClothes fields."`
- Plot thread guidance: `"Always include the player's current objective status as a plot thread."`
- Condensation rules: `"When condensing, preserve all numerical state values (gold, health, dates) exactly. Do not paraphrase quantities."`

### Important Limitations
- **The Summary AI cannot access Tracked Items.** State tracked in `trackedItems` is invisible to the Summary AI. For important state to survive summarisation, write it to `secretInfo` via `descriptionRequest` instructions, or include it in NPC/character records.
- **Duplicate character names cause collisions.** If two characters share a name (even similar names), the Summary AI may merge or confuse their records. The `names` field in `NPCs` helps — ensure character name uniqueness across the world.
- **1,500-word limit** on the main summary. Guide the Summary AI on what to preserve vs. condense when space is tight.

### Anti-Pattern
Do not instruct the Summary AI to maintain detailed narrative prose — it's meant to track facts and state, not recreate the story. Ask for structured records, not story recaps.
