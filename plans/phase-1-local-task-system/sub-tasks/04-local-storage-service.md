# Sub-task 04 — Local Storage Service

Part of [Phase 1](../00-overview.md). Maps to the **Storage layer** checklist item.

_Plan produced via the Skulls MCP (sveltekit `client-module` phase-file standard), adapted to the VS Code extension stack._

## Objective

Persist tasks locally, scoped to repository + Git branch, using VS Code extension storage. Nothing is written into the user's source repository.

## Tasks

- Resolve a workspace identity (`repoRoot` + `branch`) and derive a stable storage key.
  - Branch is read from `.git/HEAD`; falls back to `detached` / `no-git`.
- Store tasks under `globalStorageUri/<key>/tasks.json`.
- Validate task data on read using the generated `decodeTask`; corrupt/unknown entries are dropped.
- Provide `listTasks()` and `saveTask()` (upsert by id).

## Outputs

- `src/storage/workspace-identity.ts`
- `src/storage/task-store.ts`

## How to Test

1. `npm run check` passes.
2. After creating a task (sub-task 05), confirm `tasks.json` appears under the extension's global storage for the current repo+branch key, and switching branch yields a different key/file.

**Proof to attach to the PR:** `npm run check` output, plus the persisted `tasks.json` contents from a created task.

## Validation

- Tasks persist across window reloads for the same repo+branch.
- Different branches resolve to different storage keys.
- Reads tolerate a missing or malformed file (return empty).
