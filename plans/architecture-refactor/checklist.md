# Implementation Checklist

## Phase 1: Planning

- [x] Confirm target class names and responsibilities.
- [x] Inventory all command handlers currently registered in `src/extension.ts`.
- [x] Inventory all `resources/` references.
- [x] Decide generated vs local ownership for `DraftMode`.
- [x] Decide generated vs local ownership for `AnchorState` and `RecoveryResult`.
- [x] Confirm no webview rewrite is part of this refactor.

## Phase 2: Setup

- [x] Create `src/lib/modules/` and module folders under it.
- [x] Add `src/lib/modules/app/extension-app.ts`.
- [x] Move activation object graph into `ExtensionApp`.
- [x] Add `src/lib/modules/app/command-registry.ts`.
- [x] Move command registrations into `CommandRegistry`.
- [x] Add `src/lib/modules/app/storage-watcher.ts`.
- [x] Move storage watcher setup into `StorageWatcher`.
- [x] Reduce `src/extension.ts` to bootstrap only.
- [x] Create `assets/icons/` and `assets/images/`.
- [x] Move `resources/icon.png` to `assets/icons/icon.png`.
- [x] Move `resources/fix-my-comments.svg` to `assets/icons/fix-my-comments.svg`.
- [x] Move `resources/gutter-comment.svg` to `assets/images/gutter-comment.svg`.
- [x] Update `package.json.icon`.
- [x] Update `package.json` activity bar icon contribution.
- [x] Update `GutterDecorator` gutter icon path.

## Phase 3: Type Definitions

- [x] Keep persistent/shared data shapes in `types/*.yaml`.
- [x] Keep implementation-only VS Code/callback/class types local.
- [x] Add `types/anchoring.yaml` if anchoring result types become shared contracts.
- [x] Register any new schema in `types/index.yaml`.
- [x] Run `npm run gen:types` after schema changes.
- [x] Remove duplicate manual types after generated imports exist.
- [x] Do not hand-edit `src/generated/*` for comment cleanup.

## Phase 4: State Management

- [ ] Add `src/lib/modules/comments/draft-mode-service.ts`.
- [ ] Move draft mode map to `DraftModeService`.
- [ ] Move helper comments map to `DraftModeService`.
- [ ] Move suggestion highlight map to `DraftModeService`.
- [ ] Add `src/lib/modules/comments/thread-service.ts`.
- [ ] Move thread creation/update/delete flows to `ThreadService`.
- [ ] Add `src/lib/modules/comments/message-service.ts`.
- [ ] Move message append/update/reaction/task flows to `MessageService`.
- [ ] Keep native `threadsById` ownership in `FixMyCommentsController` only.
- [ ] Ensure all stateful classes dispose owned VS Code resources.

## Phase 5: API Integration

- [x] Treat `ThreadStore` and VS Code APIs as integration boundaries.
- [x] Keep `~/.fixmycomments/<repo>-<hash>/<branch>/` storage path unchanged.
- [x] Keep `threads.json` and `messages.json` shapes backward compatible.
- [x] Ensure MCP-written storage changes still rebuild threads.
- [x] Avoid introducing HTTP/fetch abstractions.

## Phase 6: Utilities

- [x] Add `src/lib/modules/comments/target-resolver.ts`.
- [x] Move `threadIdFromTarget`, `messageIdFromTarget`, and context-prefix parsing into `TargetResolver`.
- [x] Add `src/lib/modules/comments/renderer.ts`.
- [x] Move `renderMessageBody` and reaction markdown into `CommentRenderer`.
- [x] Add `src/lib/modules/comments/comment-helpers.ts` if helper markdown remains separate.
- [ ] Move or localize `currentUser`, `threadLabel`, and `fallbackAnchor`.
- [ ] Remove random free functions from `comment-controller.ts`.
- [x] Remove redundant comments from touched source files.

## Phase 7: UI Components

- [x] Keep native `vscode.comments` architecture.
- [x] Preserve thread resolve state mapping to `CommentThreadState`.
- [x] Preserve comment/task/suggestion markdown rendering.
- [x] Preserve reaction command links.
- [x] Preserve sidebar tree behavior.
- [x] Preserve gutter marker behavior with new asset path.

## Phase 8: Integration

- [x] Complete app bootstrap extraction.
- [x] Complete command extraction.
- [x] Complete watcher extraction.
- [x] Complete asset migration.
- [x] Complete helper extraction.
- [ ] Complete service extraction.
- [x] Complete type cleanup.
- [x] Complete comment cleanup.
- [x] Remove stale imports and dead code.
- [x] Confirm no stale `resources/` references remain.

## Verification

- [x] `npm run gen:types`
- [x] `npm run lint`
- [x] `npm run format:check`
- [x] `npm run check-types`
- [x] `npm run build`
- [x] `npm run check`

## Manual Smoke Test

- [ ] Launch extension locally.
- [ ] Activity bar icon appears.
- [ ] Create a line comment.
- [ ] Reply to a thread.
- [ ] Add and toggle a task message.
- [ ] Add a suggestion message.
- [ ] Add/remove a reaction.
- [ ] Resolve/reopen a thread.
- [ ] Sidebar refreshes and opens selected thread.
- [ ] Gutter marker appears for unresolved threads.
- [ ] Edited anchored line marks thread outdated.
- [ ] External storage change rebuilds native threads.
