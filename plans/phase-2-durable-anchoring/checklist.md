# Phase 2 — Checklist

One subtask = one pull request.

## Subtasks

- [ ] **Anchor capture** — Build the anchor on task creation: selected text, hash, char/line ranges, before/after context lines.
- [ ] **Live range tracking** — Shift anchors as the document changes while the file is open, so positions stay correct during an editing session.
- [ ] **Hash exact-match recovery** — Locate the anchor by matching the stored text hash in the current file.
- [ ] **Exact text-match recovery** — Fall back to locating the exact selected text when the hash misses.
- [ ] **Context recovery** — Fall back to matching before/after context to relocate a changed selection.
- [ ] **Anchor update after relocation** — When recovery succeeds at a new position, persist the updated anchor.
- [ ] **Orphan detection** — When all recovery stages fail, set the task to `orphaned` and surface it in the UI.
- [ ] **Selection overlap classifier** — Classify a new selection against existing anchors (exact / partial / inside) and route to history or new-task per the product plan.

## Verification

- [ ] `npm run check` passes.
- [ ] Manual: edit, reformat, move, and delete anchored code; confirm correct recovery and orphaning.
