# Phase 3 — Checklist

One subtask = one pull request.

This phase rebuilds the thread UI as a custom webview. The previous native Comments-panel implementation is being replaced; items done under that model are re-checked against the webview.

## Subtasks

- [x] **Compose panel (Comment + Suggestion tabs)** — `src/comments/compose-panel.ts` webview with a Comment tab and a Suggestion tab that captures `suggestionCode`. Submit returns a `ComposeResult`.
- [ ] **Thread panel webview scaffold** — custom webview (not the native Comments panel) that loads a task and its messages, owned by a host controller; actions post back to the host.
- [ ] **Render messages + attribution** — render messages in `seq` order, indent by `parentId`, distinguish AI authors (badge + color) from human authors; show file:line anchor in the header.
- [ ] **Add user reply** — a reply appends a `TaskMessage` (`messageType: comment`) to the thread log and updates `threadTail` / `messageCount`.
- [ ] **Suggestion diff + Apply/Reject** — render `messageType: suggestion` as a split diff with Apply (replace anchored range, mark applied, history event, re-anchor) and Reject (mark rejected, history event).
- [ ] **Status controls** — Resolve / Reopen / Block on the thread header and sidebar item update the task and append a history event to `history.json`.
- [ ] **Go to code navigation** — sidebar click and the panel's Go to Code button open the anchored file and scroll to the selection.
- [x] **AI thread naming hook** — New threads get a concise generated name from the selection and first message (`ai/thread-namer`, local heuristic; a real provider plugs in at Phase 4).

## Verification

- [ ] `npm run check` passes.
- [ ] Manual: open from sidebar, reply, post + apply a suggestion, change status, navigate to code.
