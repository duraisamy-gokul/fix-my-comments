# Phase 6 — Checklist

One subtask = one pull request.

## Subtasks

- [ ] **Branch reactivity** — Watch `.git/HEAD` and the active branch; on `git checkout`, refresh the sidebar, gutter decorations, and open threads to show the new branch's comments.
- [ ] **Git rename detection** — Follow file renames reported by Git and update anchor `filePath`.
- [ ] **Git-history-assisted recovery** — Use Git history as an extra signal when relocating a changed anchor.

## Verification

- [ ] `npm run check` passes.
- [ ] Manual: switch branches and confirm the sidebar/decorations refresh to the new branch; rename a file and confirm its tasks follow.
