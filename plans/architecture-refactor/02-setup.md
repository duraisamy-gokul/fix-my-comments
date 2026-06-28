# Phase 2: Setup

## Objective

Create the directory and class scaffolding needed for the new architecture before moving behavior.

## Target Directories

```text
src/lib/modules/app/
src/lib/modules/comments/
src/lib/modules/anchoring/
src/lib/modules/storage/
src/lib/modules/decorations/
src/lib/modules/tasks/
assets/icons/
assets/images/
```

Each module gets a `main.ts` public entrypoint and internal files for its own responsibility.

## New / Moved Files

```text
src/lib/modules/app/main.ts
src/lib/modules/app/extension-app.ts
src/lib/modules/app/command-registry.ts
src/lib/modules/app/storage-watcher.ts
src/lib/modules/app/utils.ts

src/lib/modules/comments/main.ts
src/lib/modules/comments/controller.ts
src/lib/modules/comments/thread-service.ts
src/lib/modules/comments/message-service.ts
src/lib/modules/comments/draft-mode-service.ts
src/lib/modules/comments/renderer.ts
src/lib/modules/comments/target-resolver.ts
src/lib/modules/comments/utils.ts

src/lib/modules/anchoring/main.ts
src/lib/modules/anchoring/engine.ts
src/lib/modules/anchoring/recovery.ts
src/lib/modules/anchoring/tracker.ts
src/lib/modules/anchoring/utils.ts

src/lib/modules/storage/main.ts
src/lib/modules/storage/thread-store.ts
src/lib/modules/storage/workspace-identity.ts
src/lib/modules/storage/git-info.ts
src/lib/modules/storage/utils.ts

src/lib/modules/decorations/main.ts
src/lib/modules/decorations/gutter-decorator.ts
src/lib/modules/decorations/utils.ts

src/lib/modules/tasks/main.ts
src/lib/modules/tasks/tasks-view.ts
src/lib/modules/tasks/utils.ts
```

Only create `utils.ts` when the module actually needs private helpers. Do not create empty exported modules that are not used by the end of the same implementation step.

## Class Responsibilities

### `ExtensionApp`

- Accept `vscode.ExtensionContext` in the constructor.
- Instantiate `TasksViewProvider`, `AnchorTracker`, `AnchorEngine`, `GutterDecorator`, `FixMyCommentsController`, `CommandRegistry`, and `StorageWatcher`.
- Register disposables with `context.subscriptions` or a private disposable list.
- Expose `start(): void` and `dispose(): void`.

### `CommandRegistry`

- Own the list of command IDs.
- Register command handlers.
- Delegate command execution to `FixMyCommentsController` or services.
- Return a disposable that disposes all command registrations.

### `StorageWatcher`

- Own the `vscode.workspace.createFileSystemWatcher` for `STORAGE_ROOT`.
- Call `rebuildAllThreads()` and `tasksProvider.refresh()` after external changes.
- Keep the shared storage path comment only if needed to document why the watcher uses an absolute home-root pattern.

### Comment module classes

- `FixMyCommentsController`: native `vscode.comments` adapter and thread map.
- `ThreadService`: persistence-backed thread creation/update/delete/rebuild orchestration.
- `MessageService`: message append/update flows, reactions, tasks, suggestions.
- `DraftModeService`: draft state, helper comments, suggestion highlight and prefill behavior.
- `CommentRenderer`: message body and reaction markdown generation.
- `TargetResolver`: command target ID extraction.

## Tasks

- [ ] Create `src/lib/modules/` and module folders under it.
- [ ] Add `ExtensionApp` with minimal start/dispose methods.
- [ ] Move activation object graph from `src/extension.ts` into `ExtensionApp` without changing behavior.
- [ ] Add `CommandRegistry` and move command registration into it.
- [ ] Add `StorageWatcher` and move watcher setup into it.
- [ ] Update `src/extension.ts` to only instantiate/start `ExtensionApp`.
- [ ] Create asset directories.
- [ ] Move asset files to `assets/icons` and `assets/images`.
- [ ] Update all asset references.

## Outputs

- A small `src/extension.ts` bootstrap file.
- New app-level classes under `src/lib/modules/app/`.
- Asset files in the new `assets/` hierarchy.
- No behavioral changes yet.

## Validation

- [ ] `npm run check-types` passes after app bootstrap extraction.
- [ ] `npm run lint` passes after command/watcher extraction.
- [ ] VS Code extension still activates.
- [ ] Activity bar icon and package icon still display.
- [ ] Gutter icon still displays.
