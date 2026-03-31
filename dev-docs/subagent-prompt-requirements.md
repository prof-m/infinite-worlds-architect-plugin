# Subagent Prompt Requirements

Every implementation subagent must be given clear first-action instructions in their prompt.

## Required Prompt Block

Every prompt dispatched to an implementation subagent must include this block at the top, before the task description:

```
## Your first action (do this before anything else)
1. Create a git worktree: `git worktree add .worktrees/<branch-name> -b feature/<branch-name>`
2. All file reads and writes must happen within that worktree path
3. Never touch files on master

## Do NOT
- Commit to master
- Push to master
- Make any changes outside the worktree
```

Provide the exact branch name in the prompt — never leave branching to the agent's discretion.

## Why This Matters

These first-action instructions ensure that:
- Subagents create isolated worktrees (not modifying master)
- All changes are on feature branches
- Clear boundaries are established before any file operations

This prevents accidental modification of master and ensures proper git workflow for multi-agent work.
