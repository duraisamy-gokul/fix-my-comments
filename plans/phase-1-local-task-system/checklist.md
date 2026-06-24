# Phase 1 — Checklist

One subtask = one pull request. Claim a subtask before starting so two people don't collide.

## Subtasks

- [x] **Bundler & build setup** — esbuild for the extension host, `compile`/`watch`/`build` scripts, `vscode` kept external, `npm run check` green.
- [x] **Type tooling + core domain types** — `types/*.yaml`, `gen:types` script, committed `src/generated`; task record, thread message, history event, TaskFile, WorkspaceIdentity modelled and generated.
- [x] **Storage layer** — Local storage at the home directory root under `~/.fixmycomments/<repo>-<hash>/<branch>/`, keyed by repository root + Git branch. TaskStore reads/writes `tasks.json` via generated decoder. Data lives outside the source repo.
- [x] **Create-task command + inline comment widget** — VS Code Comments API inline thread widget appears on selection; Enter submits, Shift+Enter adds a line. Auto-generates title from filename and code snippet. Comment text saved as task description.
- [x] **Persist task** — Task record saved atomically to storage; sidebar refreshes after save.
- [x] **Sidebar tree view** — Activity bar view listing tasks with title and `filename:line`; live-refreshes when a task is created.
- [x] **Floating action button** — CodeLens `$(comment) Add Comment` appears above the selection while text is selected; disappears when selection clears.
- [x] **Keyboard shortcut** — `Cmd+Shift+/` (Mac) / `Ctrl+Shift+/` (Win/Linux) opens the comment widget on the active selection.
- [x] **Gutter decoration** — Blue comment-bubble gutter marker rendered on every line range that has an open task; refreshes on task save and editor switch.

## Verification

- [x] `npm run check` passes.
- [x] Manual: create a task, reload window, confirm it persists per repo + branch.
