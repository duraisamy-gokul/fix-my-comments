# Fix My Comments — Work Tracker

Running log of work done on `fix-my-comments` (VS Code extension) and
`fix-my-comments-mcp` (MCP server). Newest session at the top.

---

## 2026-06-25 — Native comment UI workaround for emoji, task, suggestion

Native VS Code comments do not automatically open an emoji picker from an empty reaction area, and they do not support Bitbucket-style tabs inside the reply box. Added explicit command buttons as the workaround:

- Added per-message **React** action in `comments/comment/title` (`fixMyComments.react`). It opens a QuickPick emoji picker (`👍 👎 🎉 ❤️ 🚀 👀`) and writes the selected reaction to the message's `Record<string,string[]>` reaction map. Clicking an already-visible native reaction now toggles that exact emoji instead of incorrectly opening the picker.
- Added thread-top **Task** and **Suggestion** buttons in `comments/commentThread/title`.
  - **Task** prompts for task text, then appends a `ReviewMessage` with `type: 'task'` and renders as a native checkbox-style markdown item (`- [ ]` / `- [x]`).
  - **Suggestion** copies the current editor selection (or current line if no selection) into the suggested-code input, so the previous/current code is prefilled before editing. The message renders original + suggested code blocks.
- Added per-task-message **Toggle Task** action (shown only for task messages via `comment =~ /task:.+/`) to check/uncheck the task message.
- Added extension commands: `fixMyComments.react`, `fixMyComments.addTaskMessage`, `fixMyComments.addSuggestionMessage`, `fixMyComments.toggleTaskMessage`; wired them in `extension.ts` and `package.json`.
- Verification: `npm run check` ✅ and `vsce package` ✅ (`fix-my-comments-0.0.1.vsix`, 17 files / 36.25 KB).

---

## 2026-06-25 — Anchor is per-branch, not per-commit (correction)

Two corrections after reviewing the rewrite:

### Removed `commitHash` from the anchor (storage is per-branch, never per-commit)

The rewrite had added a `commitHash` field to `ThreadAnchor`, implying
commit-level tracking — but comments are maintained **per branch**, not per
commit. Stripped it out everywhere:

- `types/task.yaml`: removed `commitHash` from `ThreadAnchor` (now `required:
[type, filePath, lineHash]`). Synced identical YAML to both repos,
  regenerated `src/generated` in both — confirmed `commitHash` absent from both
  generated files.
- `src/storage/git-info.ts`: `buildAnchor`/`buildFileAnchor` are now
  **synchronous** (no git commit reading); removed all `.git/refs` /
  `packed-refs` reading plumbing. `hashLine` helper kept.
- `src/comments/comment-controller.ts`: dropped the `await` on `buildAnchor`
  and removed `commitHash` from the fallback anchor.
- MCP server never used `commitHash` — no change needed beyond regen.

### Non-git folders now store directly under the folder bucket (no `no-git` segment)

Previously a non-git folder stored at `~/.fixmycomments/<folder>-<hash>/no-git/`
(literal `no-git` branch segment). Now it stores at
`~/.fixmycomments/<folder>-<hash>/` directly — threads.json + messages.json at
the folder level. Git repos keep the per-branch subfolder; detached HEAD keeps
a `detached` subfolder. This is a **cross-repo contract**; both sides updated:

- Extension `src/storage/workspace-identity.ts`: `computeStoragePath` drops the
  branch segment when `branch === NO_GIT_BRANCH` (`'no-git'`); exported
  `NO_GIT_BRANCH` constant.
- MCP `src/server.ts`: `getStoragePath` mirrors the exact same rule.

### Verification

- **Path parity** (extension logic vs MCP logic) computed identical paths for
  git, non-git, and nested non-git cases. ✅
- Both repos `npm run check` (lint + format + build) ✅
- MCP **end-to-end** (resolve → reply-rejected → reopen → reply-accepted)
  against the real repo storage path: all passed. Persisted thread anchor
  keys are `type, filePath, line, lineHash, snippet` (no `commitHash`),
  `resolved` flag round-trips correctly, reply authored as "Claude". ✅
- Storage reset to empty after the test; leftover empty smoke bucket removed.

### Unchanged decisions

Storage layout is per-branch by design: `~/.fixmycomments/<projname>-<hash>/<branch>/`
— each branch maintains its own comments. This was already correct; the
`commitHash` field was the only thing implying per-commit tracking, and it's gone.

---

## 2026-06-25 — Bitbucket-style Thread + Message rewrite + packaging

Two repos changed in one pass: **fix-my-comments** (extension) and
**fix-my-comments-mcp** (server). Both share an identical type schema
(`types/task.yaml` + `types/storage.yaml`, regenerated in both via
`npm run gen:types`).

### Decisions made (this session)

- **Native VS Code comment threads**, not a custom webview. The native Comment
  API (`@types/vscode@1.125.0`) supports reactions (`CommentReaction` +
  `reactionHandler`) and a resolved checkbox (`CommentThreadState.Resolved`),
  which map cleanly onto the Bitbucket schema. Supersedes the earlier "webview
  because native can't auto-focus reply" decision — that trade-off is now
  accepted.
- **Start fresh**: the new Thread+Message schema is incompatible with old
  `tasks.json`/`messages.json`. No migration; old on-disk data is ignored
  (early dev, no real users).
- **Resolve** = native checkbox in the UI **and** MCP `set_thread_status`.
  MCP enforces: `post_agent_reply` is rejected on a resolved thread until it is
  reopened.
- **Build it all in one pass** (schema → stores → controller → reactions →
  resolve/outdated → MCP tools → refresh-surfacing).
- Schema model (decided by the user): **Thread + Message** (no nested replies),
  Bitbucket-style. Reactions are `Record<string, string[]>` (emoji → author ids).

### Schema (`types/task.yaml` + `types/storage.yaml` — identical in both repos)

- `ReviewThread`: id, `anchor` (type line/file, filePath, line, commitHash,
  lineHash, snippet), `status` (resolved, outdated, resolvedBy, resolvedAt),
  `metadata`.
- `ReviewMessage`: id, threadId, `author` (type/id/name), type
  (comment/task/suggestion), `content.markdown`, optional `suggestion`, optional
  `task`, `reactions: Record<string,string[]>`, `metadata`.
- Storage files: `threads.json` (`ThreadFile`) + `messages.json`
  (`ReviewMessageFile`). Abandoned `tasks.json`/`history.json`/`executions.json`.
- Tooling note: `type-crafter@0.13.4` emits `Record<string,string[]>` via
  `additionalProperties`, plus nested inline + optional (`| null`) sub-objects —
  verified with a throwaway probe before the rewrite.

### Extension changes (`fix-my-comments`)

- **New `src/storage/thread-store.ts`** — Thread+Message store; append-only
  messages, lightweight thread record.
- **New `src/storage/git-info.ts`** — `buildAnchor` captures commitHash + line
  snippet alongside the line hash; `hashLine` helper (shared semantics).
- **`src/anchoring/anchor-tracker.ts`** — now emits `onLineContentChanged` when a
  tracked line's _own_ text changes (hash mismatch), distinct from a line shift.
- **`src/anchoring/anchor-engine.ts`** — reacts to `onLineContentChanged` →
  marks the thread **outdated live** (the "change a line → outdated" feature).
  Reconciles thread status on open/save. Reopen-on-shift persists the new line.
- **`src/anchoring/anchor-recovery.ts`** — adapted to `ThreadAnchor`; file-level
  anchors are always valid.
- **`src/comments/comment-controller.ts`** (rewritten) — native threads:
  - Resolve checkbox via `CommentThreadState.Resolved` (removed the old
    Resolve/Reopen/Block **header buttons** — `comments/commentThread/title`
    menu entries deleted from `package.json`).
  - Reactions via native `reactionHandler` → emoji quick-pick →
    `Record<string,string[]>` toggle by author id. AI messages show 🤖; task
    messages show ✅/☐.
  - **`rebuildAllThreads()`** on activation + on the storage file watcher →
    fixes "comments don't reappear after refresh" and surfaces AI-written MCP
    replies live.
  - Reply on a resolved thread is rejected in the UI too.
- **`src/views/tasks-view.ts`** — tree shows threads with resolved/outdated
  badges; command renamed `openTask` → `openThread`.
- **`src/decorations/gutter-decorator.ts`** — adapted to threads (line-anchored
  only); fixed a type-predicate lint violation.
- **`src/extension.ts`** — rewired commands (`openThread`, `toggleResolved`);
  storage watcher globs now `**/{threads,messages}.json`; watcher triggers
  `rebuildAllThreads`.
- **`package.json`** — removed `resolveTask`/`reopenTask`/`blockTask` commands;
  added `openThread` + `toggleResolved`; `viewItem` contextValue `fmcTask` →
  `fmcThread`; updated viewsWelcome text.
- **Removed (orphaned)**: `src/storage/task-store.ts`,
  `src/storage/execution-store.ts`, `src/anchoring/anchor-capture.ts`,
  `src/ai/thread-namer.ts`, `src/comments/compose-panel.ts`.

### MCP server changes (`fix-my-comments-mcp`)

- **`src/server.ts`** rewritten against the new schema. `SERVER_VERSION` bumped
  to `2.0.0`. Tools:
  - `list_open_threads` (optionally filter by filePath)
  - `get_thread` (thread + chronological messages)
  - `post_agent_reply` (writes a `ReviewMessage`; optional suggestion; **rejects
    if thread is resolved**)
  - `set_thread_status` (`resolved` | `open` = reopen)
  - `add_reaction` (AI reacts with an emoji)
- Removed all `AgentExecution`/`HistoryFile`/`ExecutionFile` usage (not in the
  new schema).
- Global bin re-linked → `fix-my-comments` now serves v2.0.0; Claude Code MCP
  connection still ✔ Connected.

### Verification (this session)

- Both repos: `npm run check` (lint + format + build) ✅
- MCP **end-to-end smoke test** (resolve → reply-rejected → reopen →
  reply-accepted): all passed. Persisted: thread `resolved` flag flipped back
  to false after reopen; message count = 2; reply authored as "Claude". ✅
- `vsce package`: clean, 16 files / 31 KB. ✅
- Generated types regenerated = no drift. ✅
- **NOT yet done**: manual UI test in the Extension Development Host (`F5`) —
  reactions rendering, resolve checkbox, live outdated need eyeballing.
  CONTRIBUTING requires a screenshot/recording for PR proof.

### Known follow-ups / loose ends

- **MCP `package.json` version is still `1.0.0`** even though the server reports
  `2.0.0` at the protocol level (`SERVER_VERSION` bumped, package version not).
  Bump `version` in `fix-my-comments-mcp/package.json` before publishing.
- **Old data ignored**: existing `tasks.json` in `~/.fixmycomments` won't render.
  Safe to `rm -rf ~/.fixmycomments/<repo>` to clear stale data.
- **Commit pending**: changes are built and verified but **not committed** in
  either repo (working tree only).

---

## 2026-06-25 — README rewrite + packaging fixes (earlier this session)

- **README.md** rewritten as a clean install + connect guide: install the MCP
  server globally (`npm install -g fix-my-comments-mcp`), connect to Claude
  Code (`claude mcp add fix-my-comments --scope user -- fix-my-comments`),
  verify (`claude mcp list`), keyboard shortcut (`Cmd/Ctrl+Shift+/`). Removed
  project-structure/roadmap internals (moved to CONTRIBUTING).
- **CONTRIBUTING.md** — fixed a stale "Hello World" smoke-test step (that command
  no longer exists) → replaced with the real "Fix My Comments: Comment" command.
- **package.json** — added `repository` + `homepage` fields → resolved the
  `vsce` "couldn't detect repository / broken README link" error.
- **New `LICENSE`** (MIT) → resolved the `vsce` "LICENSE not found" warning.
- **New `.vscodeignore`** (blacklist) → VSIX slimmed from 88 files / 97 KB to
  16 files / 31 KB. Keeps `dist/`, `resources/`, `node_modules/type-decoder/`
  (the one runtime dep esbuild does NOT bundle), `docs/`, `LICENSE`. Excludes
  `src/`, `plans/`, `types/`, `.husky/`, `.vscode/`, and the leaked
  `fix-my-comments-mcp` from `node_modules`.

---

## Verification commands (reusable)

- Extension: `npm run check` (lint + format + build), `npm run gen:types`,
  `vsce package`.
- MCP server: `npm run check`, `npm run build`, then `node dist/server.js` over
  stdio for a protocol smoke test. Global bin: `npm link` in the MCP repo.
- MCP connection: `claude mcp list` (should show `fix-my-comments ✔ Connected`).
