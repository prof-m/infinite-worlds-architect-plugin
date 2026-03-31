# Subagent Prompt Requirements

Dispatch to implementation subagents must include this required prompt block at the top, before the task description:

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

Provide the exact branch name — never leave branching to the agent's discretion.

## Why This Matters

These instructions ensure subagents:
- Create isolated worktrees (not modifying master)
- Work on feature branches
- Establish clear boundaries before file operations
