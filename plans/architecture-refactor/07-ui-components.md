# Phase 7: UI Components

## Status: ADAPTED

This project does not use Svelte UI components. UI is provided through VS Code native comments, tree views, command menus, and gutter decorations.

## Objective

Preserve the chosen native VS Code UI while making UI adapter classes focused and maintainable.

## UI Surfaces

| Surface                      | Current owner                   | Target owner                                       |
| ---------------------------- | ------------------------------- | -------------------------------------------------- |
| Native comment threads       | `FixMyCommentsController`       | `FixMyCommentsController`                          |
| Comment markdown body        | `comment-controller.ts` helpers | `CommentRenderer`                                  |
| Inline draft helper comments | `FixMyCommentsController`       | `DraftModeService` with controller adapter methods |
| Sidebar tree                 | `TasksViewProvider`             | unchanged unless cleanup needed                    |
| Gutter marker                | `GutterDecorator`               | unchanged except asset path                        |
| Commands/menu actions        | `package.json`, `extension.ts`  | `package.json`, `CommandRegistry`                  |

## Native UI Rules

- Keep using `vscode.comments`; do not revive the custom webview direction.
- Keep thread resolve state mapped to native `CommentThreadState`.
- Keep reactions surfaced through command links and existing VS Code comment actions.
- Keep task messages as markdown checkboxes plus command support.
- Keep suggestion messages as markdown with original/suggested code blocks unless a separate feature changes suggestion UX.

## Tasks

- [ ] Extract markdown construction into `CommentRenderer`.
- [ ] Keep `FixMyCommentsController.toComment` or equivalent focused on converting renderer output into `vscode.Comment`.
- [ ] Move helper comment body generation out of the controller.
- [ ] Ensure `TasksViewProvider` still refreshes after thread/message mutations.
- [ ] Update `GutterDecorator` to use `assets/images/gutter-comment.svg`.
- [ ] Update `package.json` contribution icons to use `assets/icons/*`.
- [ ] Remove outdated comments that mention abandoned webview architecture if any remain in active source.

## Outputs

- Native comment UI behavior preserved.
- Rendering logic isolated from persistence and command handling.
- Asset references use the new hierarchy.

## Validation

- [ ] Activity bar icon loads from `assets/icons/fix-my-comments.svg`.
- [ ] Package icon loads from `assets/icons/icon.png`.
- [ ] Gutter marker loads from `assets/images/gutter-comment.svg`.
- [ ] Thread body rendering is unchanged for comments, tasks, suggestions, and reactions.
- [ ] Sidebar status/location display is unchanged.
