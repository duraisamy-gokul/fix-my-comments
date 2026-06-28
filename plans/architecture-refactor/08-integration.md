# Phase 8: Integration

## Objective

Wire the refactored classes together, remove old code paths, and verify behavior end to end.

## Migration Order

1. App bootstrap extraction
   - Add `ExtensionApp`.
   - Move object graph wiring from `extension.ts`.
   - Keep all existing behavior delegated to current classes.

2. Command extraction
   - Add `CommandRegistry`.
   - Move command registrations from `extension.ts`.
   - Centralize command IDs.

3. Storage watcher extraction
   - Add `StorageWatcher`.
   - Move `setupStorageWatcher` out of `extension.ts`.
   - Keep watcher behavior identical.

4. Asset migration
   - Move `resources/*` into `assets/icons` and `assets/images`.
   - Update `package.json` and `GutterDecorator` references.

5. Low-risk helper extraction
   - Extract `TargetResolver`.
   - Extract `CommentRenderer`.
   - Extract comment helper text.

6. Service extraction
   - Extract `MessageService`.
   - Extract `ThreadService`.
   - Extract `DraftModeService`.
   - Shrink `FixMyCommentsController` to the native UI adapter.

7. Type cleanup
   - Move shared pure-data types into YAML if needed.
   - Run `npm run gen:types`.
   - Remove duplicate local declarations.

8. Comment cleanup
   - Remove redundant comments from files touched by the refactor.
   - Leave generated files and true contract comments alone.

## Integration Risks

| Risk                                    | Mitigation                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| Breaking command target parsing         | Extract `TargetResolver` with same behavior first and keep command context values unchanged. |
| Breaking storage watcher live refresh   | Move watcher as-is before changing controller internals.                                     |
| Breaking MCP compatibility              | Do not change storage paths or JSON shapes in this refactor.                                 |
| Losing disposables                      | Make every service/class that owns VS Code resources implement `vscode.Disposable`.          |
| Native thread map drift                 | Keep one owner for `threadsById`; do not duplicate it across services.                       |
| Asset paths wrong in packaged extension | Update `package.json`, code paths, and run a local extension smoke test.                     |

## Final Verification Commands

Run these before considering the refactor complete:

```bash
npm run gen:types
npm run lint
npm run format:check
npm run check-types
npm run build
npm run check
```

`npm run check` already includes lint, format check, and build, but running the smaller commands first makes failures easier to isolate.

## Manual Smoke Test

- [ ] Launch the extension locally.
- [ ] Confirm activity bar icon appears.
- [ ] Add a comment on a source line.
- [ ] Confirm a native thread appears on the line.
- [ ] Add a normal reply.
- [ ] Add a task message and toggle it complete.
- [ ] Add a suggestion message and confirm original/suggested blocks render.
- [ ] Add and remove a reaction.
- [ ] Resolve and reopen a thread.
- [ ] Confirm sidebar refreshes and opens the selected thread.
- [ ] Confirm gutter marker appears for unresolved threads.
- [ ] Modify the anchored line and confirm outdated behavior still works.
- [ ] Simulate an external storage change and confirm the watcher rebuilds threads.

## Outputs

- Refactored architecture committed as small, reviewable steps.
- Old random helper locations removed.
- Assets organized under `assets/`.
- Verification output recorded in the implementation notes or PR description.

## Validation

- [ ] All verification commands pass.
- [ ] Manual smoke test passes.
- [ ] `src/extension.ts` is minimal.
- [ ] `src/comments/comment-controller.ts` is no longer a mixed 900+ line controller.
- [ ] No stale references to `resources/` remain.
- [ ] No redundant comments remain in touched non-generated source.
