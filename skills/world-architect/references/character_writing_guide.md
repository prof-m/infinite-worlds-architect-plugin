# Character Writing Guide

This guide establishes the **just-in-time extraction** workflow for populating character-related fields (`possibleCharacters` / `NPCs`). Follow it every time you write character profiles. It exists to prevent expensive, hallucination-prone blanket queries and to enforce the accuracy guardrails described in `story-accuracy-guardrails.md`.

---

## 1. Cost-Conscious Extraction Policy

**Golden rule: Query only the turns you need, exactly when you need them.**

Most character detail lives in a small number of pivotal turns. Querying every turn that mentions a character wastes tokens and inflates context. The workflow below limits `turn_detail` calls to two categories of turns per character:

| Turn type | What it provides |
|-----------|-----------------|
| **First occurrence** | Physical description, initial introduction, establishing tone |
| **Pivotal turns** (from `tracked_state` deltas) | Relationship shifts, objective changes, status updates, revealed secrets |

Never call `query_story_data(..., 'turn_detail', [...])` with an unbounded list. Always build a short, targeted list using the process below.

---

## 2. Per-Character Workflow

For each character you are writing (process one at a time):

### Step A — Locate the character in the story

```
query_story_data(extraction_dir, 'character_index')
```

This returns `data.characters[<name>].mentions` — an array of objects, one per turn the character appears in:

```json
{
  "turn": 3,
  "lines": [45, 52],
  "context": "Victor nods and steps forward..."
}
```

To get the turn number for a mention, read `mention.turn` (not the mention element itself). Record:
- The **first turn number**: `mentions[0].turn` (first occurrence — for physical description and introduction)
- The **complete set of turn numbers**: `mentions.map(m => m.turn)` (for cross-referencing with `tracked_state`)

If `character_index` is absent (legacy extraction without `character_list`), fall back to `turn_index` keyword search and note the limitation.

### Step B — Check mechanical history in tracked_state

```
query_story_data(extraction_dir, 'tracked_state', mentions.map(m => m.turn))
```

Pass the character's mention turns from Step A as the `turns` filter so only snapshots covering those turns are returned, rather than the entire state history. Review the filtered `snapshots` array for entries linked to this character: stat changes, objective shifts, relationship flags, secret information. Each snapshot's `from_turn` / `to_turn` range identifies which turns caused the change — these are your **pivotal turns**.

Compile a short list: `[first_turn, ...pivotal_turns]`. Cap this list at the minimum required to write the profile accurately. Six turns is already generous; aim for two to four.

### Step C — Extract narrative detail from targeted turns only

```
query_story_data(extraction_dir, 'turn_detail', [T_first, T_pivot1, T_pivot2, ...])
```

Read the returned content to source:
- Verbatim physical descriptions and dialogue
- Relationship tone and context
- Arc progression rationale

Do **not** request all turns from the `character_index` mentions list. Only the turns identified in Steps A and B.

---

## 3. Identity & Appearance

- **Source only from story text.** Physical descriptions, clothing, mannerisms, and named traits must be grounded in `turn_detail` content from the character's first occurrence or a later scene that explicitly re-describes them.
- **No genre defaults.** If a character's appearance is never described, leave `appearance` and `img_appearance` empty or note "not described in story." Do not substitute tropes (e.g., "typical rogue appearance," "stern military bearing").
- **Use the story's own language.** When the story describes how a character looks or speaks, reproduce those phrases rather than paraphrasing. Paraphrase invites distortion.
- See `story-accuracy-guardrails.md` — Proposal 1 guardrails apply in full.

---

## 4. Relationships & Factions

- Map relationships by reading `turn_detail` for the turns where major interactions occur (as identified in `tracked_state` deltas).
- Do **not** infer relationship quality from a single greeting or passing mention. A character being present in a turn is not the same as a meaningful interaction.
- Track faction membership and allegiance shifts through `tracked_state` snapshots. If a character's faction is never stated, leave it blank.
- Distinguish stated relationships from implied ones; flag implied relationships as uncertain in `detail` or `secret_info`.

---

## 5. Arc Progression & Status

- **Quantitative / mechanical state** (health, stats, inventory, objective status) comes entirely from `tracked_state`. Do not re-derive these from narrative text unless `tracked_state` is absent.
- **Narrative rationale** for state changes — why a stat changed, how a relationship broke down — is sourced from the `turn_detail` of the pivotal turn identified in Step B.
- Write arc notes in `detail` as past-tense narrative summary, not speculation. If a character's arc is unresolved at the end of the story, say so explicitly.

---

## 6. No-Citation Rule

If you cannot point to a specific turn number as the source of a detail, do not include that detail. This applies to:
- Backstory not established in the story
- Abilities or skills not demonstrated or stated
- Personality traits inferred from archetype rather than dialogue/action
- Relationships claimed without a scene to support them

Leave the field empty rather than fabricate plausible-sounding content.

---

## Quick Reference

```
1. query character_index
   → data.characters[name].mentions → array of {turn, lines, context}
   → first_turn = mentions[0].turn
   → mention_turns = mentions.map(m => m.turn)

2. query tracked_state(mention_turns)
   → snapshots filtered to character's active turns
   → identify pivotal turns (from_turn / to_turn where state changed)

3. query turn_detail([first_turn, ...pivotal_turns])
   → targeted narrative: appearance, relationships, arc rationale

4. Write profile fields citing only what the above queries returned
5. Leave any unconfirmed detail blank
```
