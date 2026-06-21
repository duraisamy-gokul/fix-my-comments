# Phase 4 — Checklist

One subtask = one pull request.

## Subtasks

- [ ] **Discovery format** — Define and document a versioned, provider-agnostic format for exposing open tasks and threads to agents.
- [ ] **Read path** — Implement listing open tasks and fetching a task thread through the contract.
- [ ] **Agent reply** — Allow an agent to append a reply attributed to its name/type.
- [ ] **Status transitions** — Allow agents to set `resolved` / `requires_review`, appending history events.
- [ ] **AI execution metadata** — Persist execution records (id, agent, timestamp, files, ranges, summary, reason) linked to the message.

## Verification

- [ ] `npm run check` passes.
- [ ] Manual: simulate an agent reading, replying, and resolving a task.
