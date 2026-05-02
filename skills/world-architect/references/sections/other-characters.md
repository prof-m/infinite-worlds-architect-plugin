# Field Guide: Other Characters (NPCs)

JSON key: `NPCs` — array of NPC objects

Each NPC has: `name`, `one_liner`, `detail`, `appearance`, `location`, `secret_info`, `names`, `img_appearance`, `img_clothing`, `id`

---

## How the Engine Uses NPCs

NPCs populate the game's **character database** at startup. This database is never modified mid-game from the Other Characters section itself — changes to the world JSON after the game starts don't affect an in-progress session.

The **Summary AI** (runs every 6 turns starting turn 8) updates NPC records as the game progresses, incorporating new information about characters from recent context.

---

## NPC Sub-Fields

### `one_liner` (Brief Summary)
**THE ONLY NPC FIELD VISIBLE TO THE STORYTELLER AI until the turn after the character (or their location) is first mentioned.**

Every other NPC field — detail, appearance, location, secret info — is invisible to the storyteller AI until the character appears in the story. This makes `one_liner` the most important field to get right.

**What to put here:**
- The highest-signal facts about this character: role, key personality trait, one defining physical feature, their relationship to the player
- Written for the AI's benefit, not for the player — dense, useful, not stylistic
- Examples: "Veteran detective, cynical but fair, short-cropped grey hair; player's reluctant partner", "The café owner who knows everyone's secrets; warm on the surface, calculating underneath"

**Length guidance:** Keep it under 100 words. It's injected every turn once the character has appeared — treat it like the NPC equivalent of `instructions`.

### `detail` (Character Detail)
**Loaded after the character is first mentioned. Full character development.**

The primary section for comprehensive character background: backstory, personality depth, motivations, history, how they speak, their arc. This is only loaded by the AI after the character enters the scene, so it can be much more expansive than `one_liner` without wasting tokens.

### `appearance`
**Warning: The storytelling AI "frequently ignores" these specifications.**

Physical description for the storyteller AI's reference. Do not rely on this field for narrative consistency — if consistent appearance is critical, repeat key appearance details in `one_liner` or in `instructions`. Use `img_appearance` for image generation consistency instead (that system is independent and more reliable).

### `location`
The setting where the character should first appear. Guides the AI's initial placement of the character in the scene. Can be a place name, a description, or a situational context.

### `secret_info` (Secret Information)
**Carries "less influence on the AI than the other sections."**

Background details hidden from the player but available to the AI for story consistency. The Summary AI weights `secretInfo` heavily during summarisation. Good for: hidden motivations, secret relationships, information the player may eventually discover. Not a strong enforcement mechanism — the AI may not act on it reliably. Can be left blank.

### `names` (Full List of Names)
**Comma-separated string. Prevents the AI treating different name forms as separate characters.**

Include all name variants: full name, nicknames, titles, how they're addressed in dialogue. Example: `"Dr. Sharon Stone, Dr. Stone, Sharon Stone, Sharon"`. If omitted, the AI may create separate character records for "Dr. Stone" and "Sharon" as if they were two different people.

### `img_appearance` and `img_clothing`
**For the image generation AI, not the storytelling AI.**

These fields feed the image generation system's character portrait prompts. Since image AI and storyteller AI are independent, explicit appearance details here are more reliably applied to generated images than the `appearance` field is to narrative text.

- `img_appearance`: Physical description formatted for image generation (age, hair, eyes, skin tone, build)
- `img_clothing`: Current clothing description (exclude footwear — standard image generation convention)

**Author note:** These fields typically require author input and should not be invented if the story doesn't describe the character's appearance. Prompt the user to confirm or supply these values.

---

## Authoring Checklist

- [ ] `one_liner` is dense, high-signal, and under 100 words — it's the only thing the AI sees until the character appears
- [ ] `names` includes all name variants to prevent character identity fragmentation
- [ ] Critical appearance details are in `one_liner` (not just `appearance`) if consistency matters
- [ ] `img_appearance` and `img_clothing` are confirmed by the author, not invented
- [ ] `detail` contains the full backstory and personality — this can be rich and expansive
