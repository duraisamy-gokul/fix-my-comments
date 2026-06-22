# Phase 3 — Checklist

One subtask = one pull request.

## Subtasks

- [x] **Thread panel** — Conversations are hosted in VS Code's native Comments panel (chosen over a custom webview in Phase 2). Threads carry their task id via `contextValue`.
- [x] **Render messages** — Messages persist to `messages.json` and render in `seq` order; the thread header shows the task name and `filename:line`.
- [x] **Add user reply** — Replies append a new `TaskMessage` to the thread log and update the task `threadTail` / `messageCount`.
- [x] **Status controls** — Resolve / Reopen / Block actions on the thread header and sidebar item update the task and append a history event to `history.json`.
- [x] **Go to code navigation** — Sidebar click and the panel open the anchored file and scroll to the selection.
- [x] **AI thread naming hook** — New threads get a concise generated name from the selection and first message (`ai/thread-namer`, local heuristic; a real provider plugs in at Phase 4).

## Verification

- [x] `npm run check` passes.
- [ ] Manual: open from sidebar, reply, change status, navigate to code.
