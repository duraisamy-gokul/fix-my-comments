# Phase 2 — Durable Anchoring MVP

## Goal

Make tasks survive code edits. Anchor a task to its selection using a text hash and surrounding context, recover the anchor after changes, update it when the code moves, and mark it orphaned when recovery fails. Also implement the selection-overlap logic that decides between opening history and starting a new task.

## Scope

In scope:

- Anchor capture: selected text, text hash, char ranges, before/after context lines.
- Live range tracking: shift anchors as the document is edited while the file is open (document change events), so positions stay correct during an editing session — coordinates are a live cache, never the identity.
- Staged recovery (when the file is reopened or changed externally): hash match → exact text → context match.
- Anchor update after successful relocation.
- Orphaned detection when recovery fails.
- Selection overlap classification: exact match, partial overlap, fully inside.

Out of scope:

- AST and semantic matching (later refinement).
- Git rename detection (Phase 6).

## Subtask Breakdown

```mermaid
flowchart TD
    A[Anchor capture model] --> B[Hash exact-match recovery]
    B --> C[Exact text-match recovery]
    C --> D[Before/after context recovery]
    D --> E[Update anchor after relocation]
    D --> F[Orphan detection + state]
    A --> G[Selection overlap classifier]
    A --> H[Live range tracking while open]
```

## Acceptance Criteria

- Inserting or deleting lines above an open file's anchor keeps the marker on the correct lines in real time.
- Editing unrelated lines keeps the task attached.
- Reformatting or moving the selected block relocates the anchor and updates it.
- Deleting the selected code marks the task `orphaned`.
- Selecting the exact anchored range opens history; partial overlap prompts; fully-inside opens the containing task.
- `npm run check` passes.

## Dependencies

- Phase 1 (storage + task model).
