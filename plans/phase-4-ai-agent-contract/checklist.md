# Phase 4 — Checklist

One subtask = one pull request.

## Subtasks

- [x] **Discovery format** — branch-scoped storage under `~/.fixmycomments/<repo>-<hash>/<branch>/` (home directory root), read by both the extension and the MCP server.
- [x] **Read path** — `list_open_tasks` (with optional filePath filter) and `get_task_thread` tools return tasks and messages from disk.
- [x] **Agent reply** — `post_agent_reply` appends a `TaskMessage` with `authorType: ai` and records an `AgentExecution` to `executions.json`.
- [x] **Status transitions** — `set_task_status` allows agents to set `resolved` or `requires_review`, appends a history event.
- [x] **AI execution metadata** — `AgentExecution` type persisted to `executions.json`; linked to the message via `messageId`.
- [ ] **Agent suggestions** — `post_agent_reply` accepts `messageType: suggestion` + `suggestionCode` so an agent can post an apply-able suggestion; extension storage and server stay shape-compatible.
- [ ] **Connect AI Agent onboarding** — `fixMyComments.connectAgent` command shows both the terminal install command and a copy-paste `.mcp.json` snippet.
- [ ] **Single source of truth** — remove the duplicate `src/mcp/server.ts` from the extension repo; the `fix-my-comments-mcp` npm package is the only server. Keep storage shapes byte-compatible across both repos.

## Verification

- [ ] `npm run check` passes in both repos.
- [ ] Manual: run `Connect AI Agent`, install via the shown command/snippet, call `list_open_tasks`, `post_agent_reply` (incl. a suggestion), `set_task_status`.
