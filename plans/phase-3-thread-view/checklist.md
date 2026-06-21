# Phase 3 — Checklist

One subtask = one pull request.

## Subtasks

- [ ] **Thread panel webview** — Scaffold the webview panel and its message channel to the extension host.
- [ ] **Render messages** — Display messages in `seq` order with `parentId`-based threaded indentation; show header (name, anchor, status, Go to Code).
- [ ] **Add user reply** — Compose box that appends a new message to the thread log and updates task tail/count.
- [ ] **Status controls** — Resolve / reopen / block actions that update the task and append a history event.
- [ ] **Go to code navigation** — Open the anchored file and scroll to the selection from the panel header and from sidebar clicks.
- [ ] **AI thread naming hook** — On new-thread creation, generate a concise AI name from the selection and first message.

## Verification

- [ ] `npm run check` passes.
- [ ] Manual: open from sidebar, reply, change status, navigate to code.
