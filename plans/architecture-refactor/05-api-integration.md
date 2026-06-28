# Phase 5: API Integration

## Status: ADAPTED

This project is a VS Code extension with local JSON storage and MCP-server interoperability, not a SvelteKit client module with HTTP APIs.

## Objective

Treat local storage, VS Code APIs, and MCP-written JSON files as the integration boundaries that need clean class ownership.

## Integration Points

| Integration                 | Current location                             | Target owner                           |
| --------------------------- | -------------------------------------------- | -------------------------------------- |
| VS Code activation          | `src/extension.ts`                           | `ExtensionApp`                         |
| VS Code commands            | `src/extension.ts`                           | `CommandRegistry`                      |
| VS Code native comments     | `src/comments/comment-controller.ts`         | `FixMyCommentsController`              |
| VS Code comment targets     | `src/comments/comment-controller.ts` helpers | `TargetResolver`                       |
| VS Code tree view           | `src/views/tasks-view.ts`                    | unchanged unless cleanup needed        |
| VS Code gutter decorations  | `src/decorations/gutter-decorator.ts`        | unchanged except asset path            |
| Home-directory JSON storage | `src/storage/thread-store.ts`                | `ThreadStore`, called through services |
| Git/workspace identity      | `src/storage/workspace-identity.ts`          | unchanged contract                     |
| External MCP writes         | `setupStorageWatcher` in `src/extension.ts`  | `StorageWatcher`                       |

## Storage Contract

The storage contract must remain stable:

```text
~/.fixmycomments/<repo-basename>-<repo-hash>/<branch>/threads.json
~/.fixmycomments/<repo-basename>-<repo-hash>/<branch>/messages.json
```

The MCP server shares this path and file shape. Do not change it during the architecture refactor unless a separate migration plan updates both sides.

## Service Contracts

### `ThreadService`

Expected methods:

- `resolveStore(): Promise<ThreadStore | null>`
- `listThreads(): Promise<ReviewThread[]>`
- `getThread(threadId: string): Promise<ReviewThread | null>`
- `createEmptyThread(document: vscode.TextDocument, line: number): Promise<ReviewThread | null>`
- `createThreadFromComment(thread: vscode.CommentThread, text: string): Promise<ReviewThread | null>`
- `toggleResolved(threadId: string): Promise<ReviewThread | null>`
- `deleteThread(threadId: string): Promise<void>`

### `MessageService`

Expected methods:

- `appendComment(threadId: string, markdown: string): Promise<ReviewMessage | null>`
- `appendTask(threadId: string, markdown: string): Promise<ReviewMessage | null>`
- `appendSuggestion(threadId: string, originalCode: string, suggestedCode: string): Promise<ReviewMessage | null>`
- `toggleTaskMessage(messageId: string): Promise<ReviewThread | null>`
- `toggleReaction(messageId: string, emoji: string): Promise<ReviewThread | null>`
- `findMessage(messageId: string): Promise<{ ownerThread: ReviewThread; message: ReviewMessage } | null>`

## Tasks

- [ ] Move storage resolution out of `FixMyCommentsController` into the owning storage/thread service module.
- [ ] Move external storage watcher into `StorageWatcher`.
- [ ] Keep watcher refresh behavior: rebuild native threads, refresh sidebar, refresh gutter via existing event chain.
- [ ] Ensure services return generated records instead of directly mutating UI where possible.
- [ ] Ensure UI classes decide when to refresh native comments/sidebar after service results.
- [ ] Avoid introducing HTTP-oriented abstractions that do not fit this extension.

## Outputs

- Clear local integration boundaries.
- Stable MCP-compatible storage behavior.
- Smaller adapter classes that delegate domain mutations to services.

## Validation

- [ ] MCP-written replies still surface live after storage file changes.
- [ ] Reloading VS Code rebuilds native threads from disk.
- [ ] Thread/message JSON files remain backward compatible.
- [ ] No API/fetch library is introduced unnecessarily.
