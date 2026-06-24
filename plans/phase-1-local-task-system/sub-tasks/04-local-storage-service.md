# Sub-task 04 — Local Storage Service

Part of [Phase 1](../00-overview.md). Maps to the **Storage layer** checklist item.

_Plan produced via the Skulls MCP (sveltekit `client-module` phase-file standard), adapted to the VS Code extension stack._

## Objective

Persist tasks at the **home directory root** under `~/.fixmycomments/<repo>-<hash>/<branch>/`, scoped by repository + Git branch. Data lives outside the source repo, so nothing is ever committed. The on-disk path rule is shared with the separate `fix-my-comments-mcp` server, which reads the same directory.

## Tasks

- Resolve a workspace identity (`repoRoot` + `branch`) and derive a storage path:
  `~/.fixmycomments/<basename(repoRoot)>-<sha1(repoRoot)[:8]>/<branch-with-slashes-as-dashes>/`.
  - Branch is read from `.git/HEAD`; falls back to `detached` / `no-git`.
- Store tasks under that directory's `tasks.json` (via `vscode.workspace.fs`).
- Validate task data on read using the generated `decodeTask`; corrupt/unknown entries are dropped.
- Provide `listTasks()` and `saveTask()` (upsert by id).

## Outputs

- `src/storage/workspace-identity.ts`
- `src/storage/task-store.ts`

## How to Test

1. `npm run check` passes.
2. After creating a task (sub-task 05), confirm `tasks.json` appears under `~/.fixmycomments/<repo>-<hash>/<branch>/` (outside the repo). Switching branch yields a different directory.

**Proof to attach to the PR:** `npm run check` output, plus the persisted `tasks.json` contents from a created task.

## Validation

- Tasks persist across window reloads for the same repo+branch.
- Different branches resolve to different directories.
- Reads tolerate a missing or malformed file (return empty).
