# Skill Trigger Phrases

This document lists the natural language patterns that trigger each Infinite Worlds Architect skill. Use these phrases to activate the skill that matches your current task.

> **Note for agents**: These trigger phrases are embedded directly in each skill's `description` field in its `SKILL.md` frontmatter. That means the agent can match them against user intent when scanning available skills — before any skill body is loaded. This file is supplementary human-readable reference only; the `description` field is the canonical, always-discoverable source.

## draft-world

**Trigger patterns:**
- "I want to create a new world from scratch"
- "Help me design a world step-by-step"
- "I have an idea for a world and want to build it interactively"
- "Walk me through building a world field by field"
- "Create a new Infinite Worlds world with me"

**Usage:**
```
/infinite-worlds-architect:draft-world
```

**Result:** Interactive step-by-step world builder using a human-readable Markdown draft as an intermediate format. You'll review and refine every field (title, description, background, characters, triggers, etc.) before compiling to final world JSON.

---

## modify-world

**Trigger patterns:**
- "I want to change specific fields in my existing world"
- "Help me edit my world JSON file"
- "I need to modify some aspects of this world"
- "Let me pick which fields to update in my world"
- "I want to refine my existing world"

**Usage:**
```
/infinite-worlds-architect:modify-world
```

**Result:** Interactive world editor that decompiles your world JSON into a readable Markdown draft, lets you select and change specific fields (or give general instructions), shows you a summary of changes, and recompiles to updated JSON.

---

## scaffold-world

**Trigger patterns:**
- "Create a quick world from a simple idea"
- "I want to prototype a world fast"
- "Generate a world from a title and premise"
- "Quick-start a world with defaults"
- "Build me a world in seconds"

**Usage:**
```
/infinite-worlds-architect:scaffold-world
```

**Result:** Rapid world generator that takes your title, genre, and core premise and creates a complete, valid world JSON with token-efficient defaults. Perfect for prototyping or getting a working starting point quickly.

---

## spinoff-world

**Trigger patterns:**
- "Create a new world based on an existing one but with a different angle"
- "Branch off a variation of my world"
- "I want to explore an alternative version of this world"
- "Create a spinoff world from my existing world"
- "Build a new world inspired by this one with a different concept"

**Usage:**
```
/infinite-worlds-architect:spinoff-world
```

**Result:** World branching tool that takes an existing world JSON, applies your new concept or angle to it, and guides you field-by-field to refine the spinoff version before compiling to final JSON. Shows you what diverged from the source.

---

## sequel-world

**Trigger patterns:**
- "Create a sequel world based on a story that was played"
- "Build a new world informed by what happened in a story export"
- "I want a sequel world that continues from a story I played"
- "Create a new world that picks up after this story ended"
- "Use a story export to inform a sequel world"

**Usage:**
```
/infinite-worlds-architect:sequel-world
```

**Result:** Story-aware world creator that reads your story export (the full narrative history of what happened), combines it with your original world JSON, and guides you field-by-field to craft a sequel world that naturally continues the character arcs and world state changes from the story.

---

## inject-logic

**Trigger patterns:**
- "I want to add mechanics to my world"
- "Inject a pre-built system into my world"
- "Add time-tracking or dice-roll mechanics to my world"
- "Install a mechanic into my existing world"
- "I want to use a special mechanic in my world"

**Usage:**
```
/infinite-worlds-architect:inject-logic
```

**Result:** Mechanic injection tool that lists available pre-written systems (like time-tracking integration or dice-roll evaluation overrides), lets you choose one, and safely appends it to your world JSON with full validation.

---

## Quick Decision Guide

Use this table to find the right skill for your task:

| Your Situation | Skill | Why |
|---|---|---|
| Building a brand new world | **draft-world** | Full control, field-by-field guidance, interactive refinement |
| Tweaking an existing world | **modify-world** | Focus on specific changes, see diffs, interactive editing |
| Need something fast | **scaffold-world** | Token-efficient defaults, minimal setup |
| Exploring an alternate take | **spinoff-world** | Start from existing world, apply new concept, preserve what works |
| Continuing after a story | **sequel-world** | Story export informs character/world state evolution |
| Adding special mechanics | **inject-logic** | Pre-built systems, no manual JSON editing |
