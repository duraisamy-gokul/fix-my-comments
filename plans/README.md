# Sub-Product Plans

Each directory here is one **sub-product** — one roadmap phase. A phase contains an `00-overview.md` (goal, scope, acceptance criteria) and a `checklist.md` (the subtasks).

One subtask = one pull request. Multiple contributors can work in the same phase by picking different subtasks.

See the master [roadmap](../docs/roadmap.md) and the [contribution guide](../CONTRIBUTING.md).

## Two repos, one storage contract

This is the **VS Code extension** repo. The MCP server lives in a **separate, publishable package**, `fix-my-comments-mcp` (a sibling repo). Both read/write the same `~/.fixmycomments/<repo>-<hash>/<branch>/` storage (home directory root), so the JSON shapes defined in [`types/`](../types/) and the path rule in `src/storage/workspace-identity.ts` must stay byte-compatible across both repos. Phase 4 owns keeping the two in sync; the extension must **not** ship a duplicate server.

## Phases

| Phase | Plan                                                                |
| ----- | ------------------------------------------------------------------- |
| 1     | [Local Task System](phase-1-local-task-system/00-overview.md)       |
| 2     | [Durable Anchoring](phase-2-durable-anchoring/00-overview.md)       |
| 3     | [Thread View](phase-3-thread-view/00-overview.md)                   |
| 4     | [AI Agent Contract (MCP)](phase-4-ai-agent-contract/00-overview.md) |
| 5     | [AI Change Preview](phase-5-ai-change-preview/00-overview.md)       |
| 6     | [Git-Aware Recovery](phase-6-git-aware-recovery/00-overview.md)     |
| 7     | [Scale & Marketplace](phase-7-scale-marketplace/00-overview.md)     |
