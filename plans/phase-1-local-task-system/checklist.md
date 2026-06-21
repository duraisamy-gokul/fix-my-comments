# Phase 1 — Checklist

One subtask = one pull request. Claim a subtask before starting so two people don't collide.

## Subtasks

- [ ] **Bundler & build setup** — Add esbuild for the extension host, wire `npm run build`/`watch`, keep `vscode` external, keep `npm run check` green. Record the bundler decision.
- [ ] **Type tooling + core domain types** — Introduce `types/*.yaml`, the `gen:types` script, and committed `src/generated`; model the task record, thread message, and history event per [03-type-definitions.md](03-type-definitions.md); generate and commit output.
- [ ] **Storage layer** — Local storage service keyed by repository root + Git branch, using extension storage APIs. Read/write task records and append-only thread/history logs.
- [ ] **Create-task command** — Command that reads the active selection, builds a task + root message, and saves via the storage layer.
- [ ] **Floating action button** — Show a button near the selection that triggers the create-task command; hide it when selection clears.
- [ ] **Keyboard shortcut** — Configurable keybinding that triggers the same command when a selection is active.
- [ ] **Persist task + root message** — Write task record and append the first message atomically; update `threadTail`/`messageCount`/`updatedAt`.
- [ ] **Sidebar tree view** — Activity bar view grouping tasks by status (Open, In Progress, Resolved, Blocked, Orphaned).
- [ ] **Gutter decoration** — Render a gutter marker on lines that have an open task.

## Verification

- [ ] `npm run check` passes.
- [ ] Manual: create a task, reload window, confirm it persists per repo + branch.
