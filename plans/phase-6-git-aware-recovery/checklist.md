# Phase 6 — Checklist

One subtask = one pull request.

## Subtasks

- [ ] **Git rename detection** — Follow file renames reported by Git and update anchor file paths.
- [ ] **Branch / merge behavior** — Define and implement how tasks behave across branch switches and merges.
- [ ] **Merge duplicated histories** — Detect the same task on multiple branches and merge their thread/history logs.
- [ ] **Git-history-assisted recovery** — Use Git history as an extra signal when relocating a changed anchor.

## Verification

- [ ] `npm run check` passes.
- [ ] Manual: rename files, switch/merge branches, confirm tasks follow correctly.
