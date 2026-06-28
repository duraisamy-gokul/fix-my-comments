# Phase 6: Utilities

## Objective

Move free helper functions into focused modules or classes so utilities are discoverable and not randomly attached to large files.

## Current Helper Functions to Extract

From `src/comments/comment-controller.ts`:

| Function                  | Target                                                        |
| ------------------------- | ------------------------------------------------------------- |
| `currentUser`             | `MessageService` or `author-factory.ts` if reused             |
| `threadLabel`             | `CommentRenderer` or `thread-label.ts`                        |
| `fallbackAnchor`          | `ThreadService` or anchoring helper module                    |
| `normalCommentHelper`     | `comment-helpers.ts`                                          |
| `taskHelper`              | `comment-helpers.ts`                                          |
| `suggestionHelper`        | `comment-helpers.ts`                                          |
| `renderMessageBody`       | `CommentRenderer`                                             |
| `escapeFence`             | private function in `comment-helpers.ts` or `CommentRenderer` |
| `appendInlineReactionBar` | `CommentRenderer`                                             |
| `threadIdFromTarget`      | `TargetResolver`                                              |
| `messageIdFromTarget`     | `TargetResolver`                                              |
| `stripContextPrefix`      | private function in `TargetResolver`                          |

From `src/anchoring/anchor-tracker.ts`:

| Function    | Target                                              |
| ----------- | --------------------------------------------------- |
| `shiftLine` | Keep private unless tests or another class need it. |

From `src/decorations/gutter-decorator.ts`:

| Function      | Target                                             |
| ------------- | -------------------------------------------------- |
| `lineToRange` | Keep private; tiny and local to gutter decoration. |

## Utility Rules

- Prefer private functions inside the class module when only one class uses them.
- Create a utility module only when multiple classes need the same logic.
- Do not export broad `utils.ts` files with unrelated helpers.
- Name modules by behavior, not by generic category.
- Keep command IDs centralized in `CommandRegistry`; do not scatter string literals.

## Comment Cleanup Rules

Delete comments that only restate code, such as:

- “Create or refresh...” when the method name already says `upsertThread`.
- “Add an emoji reaction...” when the method name says `toggleReactionOnMessage`.
- “Home-relative root...” if the constant name and surrounding contract comment already explain it.

Keep comments for:

- The home-directory storage path shared with the MCP server.
- VS Code API limitations, for example immutable `CommentThread.uri` if the code still needs dispose/recreate behavior.
- Non-obvious anchoring behavior where line shifting and content drift differ.

## Tasks

- [ ] Extract `TargetResolver` first because it is low-risk and easy to test through commands.
- [ ] Extract `CommentRenderer` next because it is pure rendering logic.
- [ ] Extract helper markdown into `comment-helpers.ts` or methods on `DraftModeService`.
- [ ] Move message/thread construction helpers into services.
- [ ] Delete redundant comments while touching each file.
- [ ] Avoid creating a generic exported `utils.ts` dumping ground.

## Outputs

- Focused helper modules with narrow exports.
- Fewer random free functions in controller files.
- Reduced comments in non-generated source.

## Validation

- [ ] `rg -n "function .*" src/comments/comment-controller.ts` shows only controller-local behavior or no free functions.
- [ ] `rg -n "//|/\\*|^\\s*\\*" src --glob '!generated/**'` shows only useful comments.
- [ ] `npm run lint` passes.
- [ ] Rendering of comment markdown, task checkboxes, suggestions, and reaction links is unchanged.
