# Fix My Comments Product Plan

## Vision

Fix My Comments is a VS Code extension that turns code comments, review notes, and developer requests into durable local tasks attached directly to source code.

The goal is to feel like:

> GitHub Issues + Code Review Threads + AI Agents + VS Code, attached directly to code.

A developer should be able to select code, create a task, discuss it with AI agents, let an AI agent resolve it, review the changes, and preserve the full local history for that repository and branch.

## Core Expectations

The extension must be designed as a serious production-grade developer productivity tool, not a simple comment manager.

Key expectations:

- Tasks are attached to code selections.
- Tasks survive line changes, formatting, refactors, file moves, branch changes, and merges where possible.
- Tasks are stored locally for the developer by default, not committed into the project repository.
- Tasks are scoped by repository and Git branch so different branches can have different comments.
- Git support is used for branch awareness, file tracking, rename detection, diff context, and future synchronization.
- AI agents can discover, understand, work on, and update tasks.
- User and AI discussion history is preserved locally.
- AI-generated changes can be reviewed through a clear diff-oriented experience.
- The architecture must support multiple AI tools and providers without hardcoding one provider.
- The system must scale to large repositories and long-lived projects.

## Primary User Workflow

1. Developer selects code in the editor.
2. A floating action button appears near the cursor.
3. Clicking the button or triggering a keyboard shortcut opens the task creation or history UI, depending on the selection.
4. The task is anchored to the selected code.
5. A gutter or inline indicator appears beside the related code.
6. The task appears in the Fix My Comments sidebar.
7. AI agents add replies to the task thread.
8. An AI agent may modify code and post a completion summary.
9. The user reviews the AI-generated changes.
10. The task is resolved, reopened, blocked, or closed.
11. Full task and history data remain in local extension storage, scoped to the current repository and branch.

## Task States

Supported task states:

- `open`
- `in_progress`
- `resolved`
- `blocked`
- `requires_review`
- `orphaned`
- `closed`

## Local Storage Model

Task data should be stored locally by default. The extension should not create committed project files unless the user explicitly exports or enables a future sync feature.

This product is primarily for a developer's own workflow: personal code notes, AI task tracking, branch-specific TODOs, and local AI collaboration.

Planned local storage identity:

```text
workspace identity + repository root + Git branch
```

Planned storage contents:

```text
tasks          (lightweight task records)
threads        (append-only message logs, keyed by task id)
history        (append-only event logs, keyed by task id)
metadata
attachments
branch index
anchor index
```

The append-only logs are the reason task data is split rather than embedded: see the Data Model section. Each reply or event appends one record instead of rewriting a large task document.

The physical storage location should use VS Code extension storage APIs, such as `ExtensionContext.globalStorageUri` or `ExtensionContext.storageUri`, instead of writing task data into the user's source repository.

The storage model should support:

- Separate comments for separate repositories.
- Separate comments for separate Git branches.
- Local history for each task.
- Local attachments and AI execution metadata.
- Fast lookup by repository, branch, file, status, and anchor.

Future optional features may support export, import, or team sync, but local-only storage is the default product behavior.

## Data Model

A task must not embed its full thread and history as inline arrays. Those collections grow without bound and are append-heavy: every reply or status change would otherwise rewrite the entire task document, which is slow at scale and hostile to Git merges.

The model is therefore split into three concerns:

1. **Task record** — lightweight, bounded metadata. Rewritten freely.
2. **Thread log** — an append-only stream of messages keyed by task id.
3. **History log** — an append-only stream of events keyed by task id.

`labels` and `assignments` stay inline on the task. They are small, bounded, and part of the task's identity, so splitting them adds lookups for no benefit.

### Task record

The task holds metadata and references the head/tail of its logs instead of embedding them:

```json
{
  "id": "task_123",
  "schemaVersion": 1,
  "title": "Refactor validation logic",
  "description": "Reduce duplication",
  "scope": "selection",
  "status": "open",
  "priority": "medium",
  "createdBy": "user",
  "createdAt": "2026-06-18T00:00:00.000Z",
  "updatedAt": "2026-06-18T00:00:00.000Z",
  "anchor": {},
  "labels": [],
  "assignments": [],
  "threadHead": "msg_001",
  "threadTail": "msg_014",
  "messageCount": 14
}
```

- `scope` is one of `selection`, `file`, or `repo`.
- `threadHead` / `threadTail` reference the first and newest message ids for fast access without scanning the log.

### Thread log (append-only, linked)

Messages are stored as their own append-only records, not inside the task. Reading order comes from the append sequence; `parentId` adds threaded reply-to-reply structure without relying on fragile next/prev pointers.

```json
{
  "id": "msg_002",
  "taskId": "task_123",
  "parentId": "msg_001",
  "seq": 2,
  "authorType": "ai",
  "author": "Claude",
  "content": "Extracted a shared validation helper.",
  "timestamp": "2026-06-18T00:01:00.000Z",
  "attachments": [],
  "changes": []
}
```

- `seq` is a monotonically increasing per-task sequence number that defines canonical order.
- `parentId` is `null` for the root message; otherwise it points at the message being replied to.
- Appending a reply writes one new record. The task document is not rewritten except to bump `threadTail`, `messageCount`, and `updatedAt`.

This gives the benefit the user asked for — a linked, append-friendly structure — while keeping O(1) appends and avoiding full-document rewrites. A literal next/prev linked list is intentionally avoided: it would force O(n) traversal to read a thread and break on merges and rebases.

### History log (append-only)

Status changes, anchor relocations, AI executions, and similar events are appended to a separate per-task event log with the same shape discipline:

```json
{
  "id": "evt_005",
  "taskId": "task_123",
  "seq": 5,
  "type": "status_changed",
  "actor": "user",
  "timestamp": "2026-06-18T00:02:00.000Z",
  "details": { "from": "open", "to": "resolved" }
}
```

### Why not a literal linked list

| Approach                                      | Read thread   | Append              | Merge/rebase safe | Random access |
| --------------------------------------------- | ------------- | ------------------- | ----------------- | ------------- |
| Inline array on task                          | Fast          | Rewrites whole task | Poor              | Fast          |
| Pure next/prev linked list                    | O(n) walk     | O(1)                | Fragile pointers  | None          |
| Append-only log + `seq` + `parentId` (chosen) | Fast, ordered | O(1)                | Resilient         | By id/seq     |

The chosen model keeps the append-friendliness that motivated the linked-list idea, the threading that `parentId` provides, and the fast ordered reads that a pure pointer list would lose.

## Anchor Model

The extension must never depend only on line numbers.

Line numbers are useful as hints, but they are not stable enough for durable code-attached tasks.

Planned anchor shape:

```json
{
  "filePath": "src/example.ts",
  "startLine": 100,
  "endLine": 140,
  "startCharacter": 0,
  "endCharacter": 20,
  "selectedText": "...",
  "selectedTextHash": "...",
  "beforeContext": [],
  "afterContext": []
}
```

## Anchor Recovery Strategy

When locating a task, the extension should try recovery in stages:

1. Exact file path and selected text hash match.
2. Exact selected text match.
3. Nearby before/after context match.
4. Fuzzy text similarity search.
5. AST-based matching for supported languages.
6. Semantic matching for advanced AI-assisted recovery.
7. Mark as `orphaned` if recovery fails.

When a task is relocated successfully, its anchor should be updated.

## UI Plan

### 1. Floating Action Button

When the developer makes a selection in the editor, a small floating button appears near the cursor position.

Clicking the button triggers the task creation or history flow depending on the selection overlap rules described in the Selection Overlap Behavior section below.

The button should be unobtrusive, appear quickly, and disappear when the selection is cleared.

### 2. Keyboard Shortcut

The user should be able to configure a keyboard shortcut that performs the same action as clicking the floating button.

Behavior:

- If no selection is active, the shortcut does nothing.
- If a selection is active, the shortcut triggers the same selection overlap logic as the floating button.
- The shortcut is configurable through VS Code keyboard bindings.

Default shortcut can be something like `Cmd+Shift+/` on Mac or `Ctrl+Shift+/` on Windows/Linux, but the user may rebind it.

### 3. Selection Overlap Behavior

This is the core interaction model. When the user selects code and clicks the floating button or presses the shortcut, the extension checks the selection against existing tasks and chooses the correct behavior.

#### Case 1: No existing task overlaps the selection

Open a new task creation panel.

#### Case 2: Selection exactly matches an existing task anchor

Open the existing task thread history directly.

No prompt needed. The user is looking at the same code they commented on before.

#### Case 3: Selection partially overlaps one or more existing tasks

Show a choice:

- **New Chat** — create a new task for this selection
- **Open History** — open the thread of the overlapping task

If multiple tasks partially overlap, show a list of them to choose from.

#### Case 4: Selection is fully contained inside an existing task anchor

Open the existing task thread that fully covers this selection.

The user gets access to all history for the containing task.

#### Summary table

| Selection relationship to existing tasks | Behavior                         |
| ---------------------------------------- | -------------------------------- |
| No overlap                               | New task creation panel          |
| Exact match                              | Open existing thread directly    |
| Partial overlap                          | Prompt: New Chat or Open History |
| Fully inside an existing anchor          | Open the containing task thread  |

### 4. File-Level Task Entry Point

At the top of every file in the editor, show a subtle persistent action that lets the user create or open a task scoped to the entire file.

This should appear as a code lens at the very top of the file:

```text
[ Fix My Comments: Comment on this file ]
```

Clicking it:

- If no file-level task exists: open new task creation scoped to the full file.
- If a file-level task already exists: open that task thread.

### 5. Repository-Level Task Entry Point

In the Fix My Comments sidebar, show a top-level item for creating or opening a task scoped to the entire repository.

This is useful for high-level notes that are not tied to any particular file or code selection.

Example sidebar item:

```text
[+] Comment on this repository
```

Clicking it:

- If no repository-level task exists: open new task creation.
- If one exists: open that task thread.

### 6. Inline and Gutter Decorations

Show task indicators beside anchored code in the editor gutter.

Suggested visual states:

- 🔵 Open
- 🟡 In Progress
- 🟢 Resolved
- 🔴 Blocked
- ⚫ Orphaned

### 7. Hover Card

Hovering over a task gutter marker should show:

- Task title
- Status
- Latest message preview
- Created by
- Last updated

Actions:

- Open Thread
- Resolve
- Reopen
- Delete

### 8. Sidebar

Activity Bar item:

```text
Fix My Comments
```

Sidebar sections:

- Open Tasks
- In Progress
- Resolved
- Blocked
- Orphaned

Each task entry in the sidebar should show:

- AI-generated thread name
- File name and line range (short form, e.g. `user.ts:42–58`)
- Status badge
- Last updated time

Clicking a thread in the sidebar should automatically:

1. Open the file the thread is anchored to.
2. Scroll the editor to the anchored selection.
3. Open the thread panel alongside it.

If the file no longer exists or the anchor cannot be resolved, show an orphaned indicator and still open the thread panel.

A **Go to Code** button should also appear inside the thread panel header as a persistent shortcut for navigating back to the anchor at any time.

Planned filters:

- Search
- Status
- AI tasks
- Human tasks
- Labels
- Priority
- Scope: file, repo, selection

### 9. Thread Naming

All threads must have a name. The user never manually names a thread.

When a new thread is created, the AI automatically generates a short, descriptive name based on:

- The selected code
- The first user message (if provided)
- The file and line context

Examples of AI-generated thread names:

- `Refactor getUser method`
- `Add null check on line 42`
- `Validation logic duplication`
- `Auth middleware cleanup`
- `File: src/routes/user.ts`
- `Repo: Authentication overview`

The name should be concise (under 60 characters) and specific enough that the user can identify the thread from the sidebar without opening it.

If the thread already exists, the name is preserved. The AI should not rename existing threads unless the user explicitly asks.

Thread name is stored as part of the task and displayed in the sidebar, hover card, and thread header.

### 10. Thread View

The thread view should feel similar to GitHub review threads.

Each thread header should show:

- Thread name (AI-generated)
- File name and line range anchor
- A **Go to Code** button that opens the file and scrolls to the anchored selection
- Status badge
- Created date

Each thread should support messages from:

- Users
- Claude
- ChatGPT
- Gemini
- Codex
- Cursor
- Windsurf
- Custom agents

Messages use the thread-log record shape defined in the Data Model section (`id`, `taskId`, `parentId`, `seq`, `authorType`, `author`, `content`, `timestamp`, `attachments`, `changes`). The thread view renders them in `seq` order and uses `parentId` to indent threaded replies.

### 5. AI Change Preview

When an AI agent completes work, the extension should show:

- Files modified
- Diff preview
- Changed ranges
- Summary
- Notes

Actions:

- Accept
- Reject
- Request changes
- Reopen task

## AI Execution Model

The extension should be provider-agnostic.

Supported current/future AI agents:

- Claude Code
- OpenAI Codex
- ChatGPT
- Gemini
- Cursor
- Windsurf
- Custom agents

AI agents should be able to:

1. Read open tasks.
2. Read task thread history.
3. Locate task anchors in the repository.
4. Understand the requested code change.
5. Modify code.
6. Generate an explanation.
7. Attach modified file/range metadata.
8. Update the task thread and task status.

AI response shape:

```json
{
  "taskId": "task_123",
  "status": "resolved",
  "summary": "Extracted shared validation helper and removed duplicated checks.",
  "filesModified": [],
  "rangesModified": [],
  "notes": []
}
```

## AI Change Tracking

Every AI modification should record:

- Execution ID
- Agent name
- Timestamp
- Files modified
- Changed ranges
- Summary
- Reason

This enables later review, auditing, and blame-style inspection.

## Git Integration

The extension should eventually understand:

- File renames
- Branch changes
- Merge operations
- Rebase effects
- Blame data
- Commit metadata
- Task duplication across branches
- History merging

This is important because repository-backed task data will move through normal Git workflows.

## Performance Requirements

The architecture must support:

- 10,000+ tasks
- Large monorepos
- Multi-root workspaces
- Incremental indexing
- Lazy loading
- Fast search
- Background synchronization
- Efficient decoration updates

## Future Feature Areas

The architecture should leave room for:

- Task assignment
- Mentions
- Notifications
- Task dependencies
- Parent/child tasks
- AI-generated tasks
- Code review mode
- Pull request integration
- GitHub integration
- Jira integration
- Linear integration
- Slack integration
- Screenshot attachments
- Log attachments
- Voice notes

## Implementation Roadmap

### Phase 0: Repository Initialization

Done: 1.

Goals:

- Initialize TypeScript VS Code extension project.
- Add linting, formatting, and build scripts.
- Add pre-commit hooks.
- Add initial documentation.

### Phase 1: Minimal Local Task System

Goals:

- Create `.fix-my-comments/` repository storage.
- Define versioned task schema.
- Create task from selected code.
- Save task to `tasks.json`.
- Show basic task list in sidebar.
- Show simple gutter decoration for open tasks.

### Phase 2: Durable Anchoring MVP

Goals:

- Store selected text hash.
- Store before/after context.
- Recover task after line changes.
- Mark task as orphaned when recovery fails.
- Update anchor after successful relocation.

### Phase 3: Thread View

Goals:

- Open task thread from sidebar or gutter marker.
- Add user replies.
- Preserve thread history.
- Add task status changes from the UI.

### Phase 4: AI Agent Contract

Goals:

- Define provider-agnostic task discovery format.
- Allow AI agents to read open tasks.
- Allow AI agents to post replies.
- Allow AI agents to mark tasks as resolved or requiring review.
- Store AI execution metadata.

### Phase 5: AI Change Preview

Goals:

- Track files and ranges changed by AI.
- Show diff preview.
- Support accept, reject, and request changes flows.
- Highlight AI-modified code ranges.

### Phase 6: Git-Aware Recovery

Goals:

- Detect file renames.
- Improve branch and merge behavior.
- Merge duplicated task histories.
- Use Git history to improve anchor recovery.

### Phase 7: Scale and Marketplace Readiness

Goals:

- Optimize indexing and search.
- Add tests.
- Add error handling and telemetry strategy.
- Add extension settings.
- Add marketplace assets.
- Prepare release pipeline.

## Definition of Done for MVP

The first usable MVP should support:

- Creating a task from selected code.
- Persisting the task inside `.fix-my-comments/tasks.json`.
- Displaying task markers in the editor.
- Listing tasks in the sidebar.
- Opening a basic thread view.
- Adding messages to a task.
- Resolving and reopening a task.
- Recovering anchors after simple line movement or formatting changes.

## Non-Goals for Initial MVP

These are important, but not part of the first implementation pass:

- Full semantic anchor recovery.
- Full AST support for every language.
- Real-time multi-user collaboration.
- External integrations such as GitHub, Jira, Linear, or Slack.
- Built-in AI provider execution.
- Complex merge conflict resolution UI.

## Engineering Principles

- Keep repository data human-readable and versioned.
- Avoid hardcoding a single AI provider.
- Prefer small, testable services over large extension classes.
- Keep UI responsive through lazy loading and background indexing.
- Treat line numbers as hints, not identity.
- Preserve history instead of overwriting it.
- Make failure states visible and recoverable.
- Design for monorepos and multi-root workspaces from the start.
