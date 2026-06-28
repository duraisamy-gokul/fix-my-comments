# Phase 4: State Management

## Objective

Separate in-memory state ownership from VS Code API adapters so each stateful concern has one clear class.

## State Owners

| State                             | Current owner                   | Target owner              |
| --------------------------------- | ------------------------------- | ------------------------- |
| Native comment threads by ID      | `FixMyCommentsController`       | `FixMyCommentsController` |
| Draft mode by thread ID           | `FixMyCommentsController`       | `DraftModeService`        |
| Helper comments by thread ID      | `FixMyCommentsController`       | `DraftModeService`        |
| Active suggestion highlights      | `FixMyCommentsController`       | `DraftModeService`        |
| Line tracking                     | `AnchorTracker`                 | `AnchorTracker`           |
| Cached gutter threads             | `GutterDecorator`               | `GutterDecorator`         |
| Sidebar tree data                 | `TasksViewProvider` reads store | unchanged                 |
| Persistent thread/message records | `ThreadStore`                   | unchanged                 |

## Refactor Direction

### Keep `FixMyCommentsController` as the native adapter

It should own:

- `vscode.CommentController`
- `Map<string, vscode.CommentThread>`
- Creation/upsert/disposal of native comment threads
- Native comment options and commenting range provider

It should not own:

- How messages are persisted.
- How reactions mutate stored records.
- How task/suggestion messages are built.
- Draft-mode state machines.
- Generic command target parsing.
- Markdown rendering details.

### Move draft state to `DraftModeService`

`DraftModeService` should own:

- `Map<string, DraftMode>`
- helper comment lifecycle
- suggestion highlight decoration lifecycle
- normal/task/suggestion mode transitions
- optional clipboard prefill for suggestion mode

Expose methods such as:

- `setNormalMode(threadId: string): Promise<void>`
- `setTaskMode(threadId: string): Promise<void>`
- `setSuggestionMode(threadId: string): Promise<void>`
- `cycleMode(threadId: string): Promise<void>`
- `consumeMode(threadId: string): DraftMode | null`
- `clearThread(threadId: string): void`
- `clearAll(): string[]`

### Move domain mutations to services

`ThreadService` and `MessageService` should own persistence updates, timestamps, and generated record construction.

`FixMyCommentsController` should call services and then refresh/upsert native comments.

## Tasks

- [ ] Add `DraftModeService` and move draft maps into it.
- [ ] Move helper markdown strings out of `comment-controller.ts`.
- [ ] Move suggestion highlight creation/disposal into `DraftModeService`.
- [ ] Move message creation/update logic into `MessageService`.
- [ ] Move thread creation/delete/update logic into `ThreadService`.
- [ ] Keep `ThreadStore` unchanged unless a service boundary exposes duplication.
- [ ] Ensure all services dispose their VS Code resources.

## Outputs

- Focused service classes with explicit state ownership.
- `FixMyCommentsController` becomes smaller and easier to scan.
- No state map appears in a class that does not own that concern.

## Validation

- [ ] Creating a new thread still works.
- [ ] Replying to an existing thread still works.
- [ ] Switching normal/task/suggestion modes still works.
- [ ] Cancelling inline helper clears helper comments and highlights.
- [ ] Toggling task state still works.
- [ ] Toggling resolved state still works.
- [ ] Reactions still render and toggle.
