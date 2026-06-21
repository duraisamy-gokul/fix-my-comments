# Sub-task 03 — Type Tooling + Core Domain Types

Part of [Phase 1](../00-overview.md). Maps to the **Type tooling + core domain types** checklist item.

_Plan produced via the Skulls MCP (sveltekit `client-module` phase-file standard), adapted to the VS Code extension stack._

## Objective

Stand up the type toolchain and generate the core domain types from a YAML source of truth, per [03-type-definitions.md](../03-type-definitions.md).

## Tasks

- Add `type-crafter` (dev) and `type-decoder` (runtime) dependencies.
- Author `types/index.yaml` (grouped refs) and `types/task.yaml` (Task, TaskMessage, TaskHistoryEvent, CodeAnchor, enums).
- Generate committed output into `src/generated/` via `npm run gen:types`.
- Confirm the pre-commit hook regenerates and stages `src/generated` now that a spec exists.

## Outputs

- `types/index.yaml`, `types/task.yaml`
- `src/generated/Task.ts`, `src/generated/index.ts` (committed)
- `type-crafter` / `type-decoder` in `package.json`

## How to Test

1. `npm run gen:types` — regenerates `src/generated/` cleanly.
2. `npm run check` — type-check and build pass against the generated types.

**Proof to attach to the PR:** `gen:types` output and `npm run check` passing.

## Validation

- Generated types and decoders (`decodeTask`, etc.) exist and compile.
- Editing the YAML and rerunning regenerates the same shape.
