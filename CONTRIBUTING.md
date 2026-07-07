# Contributing to NaborNet

This document defines strict guardrails to prevent unintended UI/UX and architecture drift.

## Core Rules

### No Refactors Unless Explicitly Requested
- Do not refactor code unless the task explicitly requests it.
- No "while-I'm-here" edits. If you notice something unrelated that could be improved, note it separately—do not change it.

### No New Abstractions Without Approval
- Do not introduce new abstractions, patterns, or architectural changes without explicit approval.
- Do not extract shared logic, create new utilities, or add layers of indirection unless requested.

### No File Moves/Renames Without Approval
- Do not move or rename files without explicit approval.
- File structure changes have ripple effects and must be intentional.

## DO-NOT-TOUCH Files

The following files are critical to app stability. Do NOT modify them unless explicitly authorized in writing:

- `server/routes.ts` (auth/session logic, kill switches, API endpoints)
- `client/src/lib/auth.ts` (authentication state management)
- `client/src/lib/syncEngine.ts` (offline sync state machine)
- `client/src/lib/offlineDb.ts` (IndexedDB operations)
- `client/public/sw.js` (service worker, caching logic)
- `shared/schema.ts` (database schema, types)
- `client/src/components/LegalGate.tsx` (legal consent gate)

## Change Documentation

For any change affecting more than 10 lines of code, document:

1. **Files changed**: List all files modified
2. **What changed**: Describe the specific changes made
3. **Why**: Explain the reason for each change
4. **Risks**: Identify potential side effects or breaking changes

## Checkpoint Discipline

- Commit/checkpoint after each small, logical step.
- Do not batch unrelated changes into a single commit.
- Each checkpoint should be independently revertable.

## Uncertainty Rule

> If you are uncertain whether a change violates these rules, ASK before proceeding. Do not "interpret" in your favor.

## Summary

| Rule | Action |
|------|--------|
| Refactors | Only if explicitly requested |
| While-I'm-here edits | Forbidden |
| New abstractions | Requires approval |
| File moves/renames | Requires approval |
| DO-NOT-TOUCH files | Requires explicit written authorization |
| Changes >10 lines | Must document files, changes, reasons, risks |
| Checkpoints | After each small step |
