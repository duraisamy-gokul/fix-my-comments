# Sub-task 02 — Sidebar View Container (empty)

Part of [Phase 1](../00-overview.md). Maps to the **Sidebar tree view** checklist item (scaffold stage).

_Plan produced via the Skulls MCP (sveltekit `client-module` phase-file standard), adapted to the VS Code extension stack._

## Objective

Add the **Fix My Comments** Activity Bar container and an empty **Tasks** tree view. No data yet — this is the UI shell that later sub-tasks (populate sidebar, gutter) build on. It must render with a friendly empty state.

## Tasks

- Add an Activity Bar icon asset (`resources/fix-my-comments.svg`, monochrome, `currentColor`).
- Contribute in `package.json`:
  - `viewsContainers.activitybar` → container id `fixMyComments` with the icon.
  - `views.fixMyComments` → one tree view, id `fixMyComments.tasks`, name `Tasks`.
  - `viewsWelcome` → empty-state message for `fixMyComments.tasks`.
- Implement a `TreeDataProvider` (`src/views/tasks-view.ts`) that currently returns no items.
- Register the provider in `src/extension.ts` and add it to `context.subscriptions`.

## Outputs

- `resources/fix-my-comments.svg`
- `src/views/tasks-view.ts`
- Updated `package.json` contributions and `src/extension.ts`

## How to Test

1. `npm run compile`
2. Launch the Extension Development Host (green ▶ Run Extension, or `fn`+`F5`).
3. Confirm a **Fix My Comments** icon appears in the Activity Bar.
4. Click it → the **Tasks** view shows the empty-state welcome message.

**Proof to attach to the PR:** a screenshot of the Activity Bar icon and the empty Tasks view.

## Validation

- `npm run check` passes.
- The container and view appear; the empty state renders.
- The provider is disposed via `context.subscriptions`.
