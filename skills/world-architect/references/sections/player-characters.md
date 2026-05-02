# Field Guide: Player Character Options

Fields: `skills`, `possibleCharacters`, player permission booleans (`canChangeCharacterName`, `canChangeCharacterDescription`, `canChangeCharacterSkills`, `canSelectOtherPortraits`, `canCreateNewPortrait`, `canChangeTrackedItemsStartingValues`)

---

## skills (`skills`)
**Array of skill name strings. Sent to the storyteller AI every turn.**

A list of attributes the storyteller AI uses to evaluate player actions. The AI picks one or more relevant skills from this list and applies them when assessing whether a player's action succeeds or fails (following the Evaluation Instructions built into the platform).

**Scale (0–5):**
| Rating | Label |
|---|---|
| 0 | Incapable |
| 1 | Incompetent |
| 2 | Unskilled |
| 3 | Competent |
| 4 | Highly Skilled |
| 5 | Exceptional |

**Requirements:**
- At least 1 skill is required to run a world
- Typical worlds have 3–5 skills
- **There is no way to describe what a skill does beyond its name in the Player Character Options section.** If you need to explain what a skill covers or how it works, put that explanation in `instructions` (Main Instructions)

**Naming tip:** Use clear, self-describing skill names the AI can interpret without extra context. "Persuasion", "Stealth", "Combat", "Hacking", "Empathy" are self-evident. Avoid cryptic or world-specific names without explaining them in Main Instructions.

---

## possibleCharacters
**Each character's data is sent to the storyteller AI every turn (for the selected character only).**

An array of player character options. At least 1 character is required. The platform defaults to generating 3–4 options.

**CRITICAL:** Only the selected character's information passes to the AI. Unselected character definitions are invisible to the AI during play — if you want a character to exist as an NPC regardless of player choice, list them in `NPCs` (Other Characters) as well.

### Character sub-fields:

**`name`**
The identifier passed to the storyteller AI. The AI uses this name to avoid accidentally naming other characters the same thing. Can be modified mid-game via the `changeName` trigger effect.

**`description`**
Physical appearance, personality traits, plot hooks, and related information. "This information is passed to the AI every turn, so it always influences the AI's decisions and processing." Write it as the AI's reference for who this character is at all times — not just at game start. Can be modified via `changeDescription` trigger effect.

**`portrait`**
Optional image for the character selection screen. **Important:** Built-in portrait generation prompts are NOT saved and do NOT affect in-game illustration prompts. For consistent character appearance in gameplay images, describe the character in the `description` field or add them to `NPCs` (Other Characters) with `img_appearance`/`img_clothing` fields populated.

**`skills`**
The character-specific skill ratings mapping (e.g., `{"Strength": 4, "Stealth": 2}`). Must map to the world-level `skills` array. The AI uses these ratings when evaluating the character's actions.

**Player constraint note:** "It is impossible for a player to distribute more than the original total skill value" — players can only redistribute, not inflate, their skill total.

---

## Player Permission Booleans

Controls what players can customise before starting the adventure:

| JSON key | Default | What it allows |
|---|---|---|
| `canChangeCharacterName` | `true` | Player can rename their character |
| `canChangeCharacterDescription` | `true` | Player can rewrite their character description |
| `canChangeCharacterSkills` | `true` | Player can redistribute skill points (total cannot increase) |
| `canSelectOtherPortraits` | **`false`** | Player can cycle through pre-generated portrait images |
| `canCreateNewPortrait` | `true` | Player can generate a new portrait image |
| `canChangeTrackedItemsStartingValues` | **`false`** | Player can adjust tracked item starting values before play |

**Authoring guidance:** Defaults are reasonable for most worlds. Lock skill redistribution (`canChangeCharacterSkills: false`) for worlds where specific skill loadouts are essential to intended difficulty. Enable `canChangeTrackedItemsStartingValues` only if starting values are meant to be player-configurable (e.g., a "point buy" mechanic for item quantities).
