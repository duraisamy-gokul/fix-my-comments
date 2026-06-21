# Sub-task 05 — Create-Task Command

Part of [Phase 1](../00-overview.md). Maps to the **Create-task command** checklist item.

_Plan produced via the Skulls MCP (sveltekit `client-module` phase-file standard), adapted to the VS Code extension stack._

## Objective

Add a command that turns the current editor selection into a persisted task, anchored to the selected code.

## Tasks

- Contribute `fixMyComments.createTask` (command + `editor/context` menu when `editorHasSelection`).
- Read the active selection; warn if there is none.
- Prompt for a title.
- Build a `Task` (generated type): minimal anchor from the selection, `scope: selection`, `status: open`, timestamps, empty thread fields.
- Save via the storage service and refresh the sidebar.

## Outputs

- `src/commands/create-task.ts`
- `package.json` command + menu contribution
- `src/extension.ts` registration

## How to Test

1. `npm run compile`, launch the Extension Development Host (`fn`+`F5`).
2. Select code → right-click → **Create Task from Selection** (or Command Palette).
3. Enter a title → confirm the "Task created" notification.
4. Verify `tasks.json` under the extension global storage now contains the task with its anchor.

**Proof to attach to the PR:** a screenshot of the notification + the persisted `tasks.json` entry.

## Validation

- Creating a task with no selection is blocked with a warning.
- A created task is persisted with a correct anchor (file path, lines, selected text).
- `npm run check` passes.
