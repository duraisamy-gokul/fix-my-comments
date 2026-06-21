# Phase 1 — Checklist

One subtask = one pull request. Claim a subtask before starting so two people don't collide.

## Subtasks

- [x] **Bundler & build setup** — esbuild for the extension host, `compile`/`watch`/`build` scripts, `vscode` kept external, `npm run check` green.
- [x] **Type tooling + core domain types** — `types/*.yaml`, `gen:types` script, committed `src/generated`; task record, thread message, history event, TaskFile, WorkspaceIdentity modelled and generated.
- [x] **Storage layer** — Local storage keyed by repository root + Git branch using `globalStorageUri`. TaskStore reads/writes `tasks.json` via generated decoder.
- [x] **Create-task command + inline comment widget** — VS Code Comments API inline thread widget appears on selection; Enter submits, Shift+Enter adds a line. Auto-generates title from filename and code snippet. Comment text saved as task description.
- [x] **Persist task** — Task record saved atomically to storage; sidebar refreshes after save.
- [x] **Sidebar tree view** — Activity bar view listing tasks with title and `filename:line`; live-refreshes when a task is created.
- [ ] **Floating action button** — Show a CodeLens or cursor-adjacent button that opens the comment widget when a selection is active; hide when selection clears.
- [ ] **Keyboard shortcut** — Global keybinding (e.g. `Cmd+Shift+/`) to open the comment widget on the current selection without right-clicking.
- [ ] **Gutter decoration** — Render a coloured gutter marker beside each line range that has an open task.

## Verification

- [ ] `npm run check` passes.
- [ ] Manual: create a task, reload window, confirm it persists per repo + branch.
