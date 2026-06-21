# Phase 1 — Sub-tasks

Each sub-task here is a **small, single-PR unit** of the Phase 1 checklist. They are ordered; later ones build on earlier ones. A sub-task gets its own plan file when it is picked up (we plan just-in-time, then implement and push).

Plans are produced with the **Skulls MCP** workflow, following its phase-file content standard: **Objective → Tasks → Outputs → Validation** (plus a **How to Test** section for our mandatory test proof). Skulls only ships rust/sveltekit templates, so the sveltekit `client-module` template's content standard is applied and adapted to the VS Code extension stack — its Svelte store / HTTP-API specifics do not apply here.

## Order

`Done`: `1` = done, `0` = not done.

| #   | Sub-task                         | Plan                                                           | Done |
| --- | -------------------------------- | -------------------------------------------------------------- | ---- |
| 01  | esbuild bundler & build setup    | [01-esbuild-bundler.md](01-esbuild-bundler.md)                 | 0    |
| 02  | Sidebar view container (empty)   | [02-sidebar-view.md](02-sidebar-view.md)                       | 0    |
| 03  | Type tooling + core domain types | [03-type-tooling-core-types.md](03-type-tooling-core-types.md) | 0    |
| 04  | Local storage service            | [04-local-storage-service.md](04-local-storage-service.md)     | 0    |
| 05  | Create-task command              | [05-create-task-command.md](05-create-task-command.md)         | 0    |
| 06  | Floating action button           | _planned when picked_                                          | 0    |
| 07  | Keyboard shortcut                | _planned when picked_                                          | 0    |
| 08  | Persist task + root message      | _planned when picked_                                          | 0    |
| 09  | Populate sidebar from storage    | _planned when picked_                                          | 0    |
| 10  | Gutter decoration for open tasks | _planned when picked_                                          | 0    |

These roll up into the Phase 1 [checklist.md](../checklist.md).
