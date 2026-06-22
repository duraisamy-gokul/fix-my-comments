# Phase 2 — Checklist

One subtask = one pull request.

## Subtasks

- [x] **Anchor capture** — Build the anchor on task creation: selected text, hash, char/line ranges, before/after context lines.
- [x] **Live range tracking** — Shift anchors as the document changes while the file is open, so positions stay correct during an editing session.
- [x] **Hash exact-match recovery** — Locate the anchor by matching the stored text hash in the current file.
- [x] **Exact text-match recovery** — Fall back to locating the exact selected text when the hash misses.
- [x] **Context recovery** — Fall back to matching before/after context to relocate a changed selection.
- [x] **Anchor update after relocation** — When recovery succeeds at a new position, persist the updated anchor.
- [x] **Orphan detection** — When all recovery stages fail, set the task to `orphaned` and surface it in the UI.
- [~] **Selection overlap classifier** — Dropped in favour of a simpler model: every selection always creates a new comment thread, and follow-ups are added as replies inside that thread. No exact/partial/inside routing.

## Verification

- [x] `npm run check` passes.
- [ ] Manual: edit, reformat, move, and delete anchored code; confirm correct recovery and orphaning.
