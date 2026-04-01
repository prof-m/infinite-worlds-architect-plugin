# Story Accuracy Guardrails

Before proceeding with field-by-field refinement, establish these non-negotiable accuracy requirements:

## Core Principles

**ONLY include details explicitly stated in story text.** When updating any field—character appearances, relationships, abilities, motivations, terminology, or events—source your proposals directly from the story export (via `query_story_data` results). Use the exact language from the story where possible.

**NEVER substitute genre stereotypes for missing details.** If a character's appearance isn't described, do not invent "typical" descriptions based on their role or background. Leave the field empty, uncertain, or explicitly note "appearance not described in story."

**NEVER invent proper nouns, named abilities, or coined terminology.** Do not create official-sounding ability names, secret project titles, or world-specific terms that don't appear in the story text. If the story mentions a concept without naming it, use the story's own language rather than creating a name.

**Distinguish literal statements from sarcasm, jokes, and figurative language.** When parsing character dialogue and narration, be alert to tone. A character's sarcastic comment about their abilities is not a literal statement of fact. Self-deprecating humor should not be taken as character truth.

**Do NOT sanitize morally complex events.** If the story contains manipulation, betrayal, coercion, exploitation, or other dark elements, represent them accurately in the world description. Do not soften language or omit uncomfortable truths in an attempt to make the world more "wholesome." When citing dark content, preserve the story's tone in your field proposal while using the Evidence tag to document the extraction data source. This allows transparent tracking of where dark content originates (the story itself, not agent invention).

**For appearance fields, prefer copying the story's own descriptions verbatim.** When the story explicitly describes how a character looks, dresses, or moves, use those exact descriptions rather than paraphrasing or embellishing them.

**For tracked items, preserve the exact state and descriptions from the story.** When extracting tracked item values, character motivations, secret projects, or hidden information, use only what appears explicitly in the story export. Do not invent "secret projects" a character might be working on, fabricate hidden motivations, or create mysterious "hidden tracked item" entries. If the story doesn't describe an item's state or a character's secret, leave it empty or mark it as "not described in story."

## Decision Rules for Empty or Missing Fields

**If a field is empty in the original world AND no extraction data explicitly defines its value:** Leave the field empty in the sequel world. Do NOT invent character definitions, abilities, properties, or background details not present in the story.

**If the story mentions a concept but doesn't name it:** Use the story's own language rather than creating an official-sounding name for the concept.

**If extraction data is missing or incomplete for a field:** Mark the field as "not described in story" rather than attempting to fill it with inference or stereotype.

**For dark/complex content found in extraction data:** Preserve the story's tone in your field proposal even if the content is disturbing or morally complex. The Evidence tag documents the raw data; the proposal reflects story-accurate tone.
