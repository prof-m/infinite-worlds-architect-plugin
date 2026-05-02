# Field Guide: Image Style

Fields: `imageModel`, `imageStyle`, `imageStyleCharacterPre`, `imageStyleCharacterPost`, `imageStyleNonCharacterPre`, `imageStyleNonCharacterPost`

---

## Important Scoping Note
Image style settings control the **image generation AI only**. They have no influence on how the storyteller AI generates its narrative outputs. These two AI systems are entirely independent.

---

## imageModel (`imageModel`)
The image generation model to use. Two categories:

**Natural Language Models** (accept descriptive prose):
- `flux.1-schnell` — Flux model; ~300 word prompt limit before elements are dropped
- `manticore` — Manticore model; ~400 word prompt limit; supports Manticore-specific LoRA keywords
- `wyvern` — Wyvern model; natural language

**Tag-based Models** (use priority tag lists rather than prose):
- Limited space for descriptive content; structured differently from natural language prompts

For most worlds, `manticore` or `flux.1-schnell` are the standard choices.

---

## imageStyle (`imageStyle`)
A style descriptor string passed to the image model. Examples: `photo_beautiful`, `oil_painting`, `anime_detailed`. Manticore accepts custom style definitions; Flux and Wyvern offer preset options.

---

## Wrapper Fields (Pre/Post)
The four wrapper fields provide text that wraps around the AI-generated image subject description:

| Field | JSON key | When used |
|---|---|---|
| Character prefix | `imageStyleCharacterPre` | Before character description |
| Character suffix | `imageStyleCharacterPost` | After character description |
| Non-character prefix | `imageStyleNonCharacterPre` | Before setting/scene description |
| Non-character suffix | `imageStyleNonCharacterPost` | After setting/scene description |

**What goes in these fields:**
- **Pre fields (Prompt Beginning):** Style keywords, quality modifiers, genre tags. Examples: `"masterpiece, professional photography, cinematic lighting"`, `"oil painting, impressionist style, vibrant colors"`
- **Post fields (Prompt Ending):** LoRA trigger keywords, negative prompt guidance, technical quality tags. Examples: `"IWUpsaleFaceSmooth, IWBeautiful"`, `"IWAnime"`

---

## LoRA Keywords (Flux-specific)
Trigger specific Flux model behaviours by including these in the wrapper fields:
- `IWDefault` — default Flux style
- `IWClassic` — classic Flux style
- `IWAnime` — anime art style
- `IWRemoveNudityWordsWhenNoNudity` — sanitises prompt when nudity flag is off

## LoRA Keywords (Manticore-specific)
- `IWUpsaleFace` — face quality improvement with upscaling
- `IWUpsaleFaceSmooth` — upscaling with smoothing applied
- `IWBeautiful` — general beauty enhancement
- `IWBeautiful2` — alternative beauty enhancement variant

---

## Authoring Techniques

**Style fusion:** Combine artist styles for unique aesthetics: `"mixture of Vincent van Gogh and Banksy"`, `"blend of art nouveau and cyberpunk"`.

**Layered descriptions:** Structure non-character prompts by depth: `"layer 1 (foreground): cobblestones and puddles, layer 2 (midground): gas lamps and fog, layer 3 (background): gothic spires"`. This gives the image AI a spatial composition framework.

**Word limit awareness:** Stay within model limits (Flux ~300w, Manticore ~400w). Prompts that exceed the limit have elements dropped unpredictably — prioritise the most important style descriptors at the beginning of the wrapper fields.

**Consistent character appearance:** The image style fields alone are not sufficient for character consistency across turns. Put character appearance details in the `possibleCharacters` description or the NPC `img_appearance`/`img_clothing` fields — those are injected per-character by the engine.
