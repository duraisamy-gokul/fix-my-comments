# Phase 1 — Type Definitions

## Objective

Document the core domain types Phase 1 introduces. This is a **planning document** — shapes here are the agreed design, not committed code.

## Ownership

Phase 1 owns the foundational domain types for the whole product: the task record and its append-only thread/history log entries. Later phases extend these (Phase 2 adds the anchor recovery fields, Phase 4 adds the AI execution records) and document their additions in their own `03-type-definitions.md`.

## Toolchain (introduced in this phase)

When Phase 1 implementation begins, it sets up the type toolchain — it does not exist yet:

| Tool             | Role                                                              |
| ---------------- | ----------------------------------------------------------------- |
| **type-crafter** | Reads YAML specs, generates TypeScript types + runtime decoders   |
| **type-decoder** | Runtime validation library, peer dependency of generated decoders |

- Specs live under `types/` (e.g. `types/task.yaml`), with a small `types/index.yaml` that `$ref`s each domain file.
- Generated output lands in `src/generated/` and is **committed** (not gitignored). The pre-commit hook regenerates and stages it so it never drifts from the spec.
- The `gen:types` script generates, then lints and formats the output.
- Generated files are never hand-edited; the YAML is the source of truth.

## Planned Shapes

These are the intended fields. The authoritative form will be the YAML spec authored during implementation.

### TaskStatus

`open` | `in_progress` | `resolved` | `blocked` | `requires_review` | `orphaned` | `closed`

### TaskScope

`selection` | `file` | `repo`

### AuthorType

`user` | `ai` | `system`

### Task (record)

Lightweight metadata; thread and history are stored as separate append-only logs, not embedded. Anchor fields are minimal in Phase 1 and extended for durable recovery in Phase 2.

| Field           | Type       | Notes                                      |
| --------------- | ---------- | ------------------------------------------ |
| `id`            | string     | Stable task id                             |
| `schemaVersion` | integer    | For forward migration                      |
| `title`         | string     |                                            |
| `description`   | string     |                                            |
| `scope`         | TaskScope  | selection / file / repo                    |
| `status`        | TaskStatus |                                            |
| `createdBy`     | string     |                                            |
| `createdAt`     | string     | ISO timestamp                              |
| `updatedAt`     | string     | ISO timestamp                              |
| `anchor`        | CodeAnchor | Minimal in Phase 1; extended in Phase 2    |
| `labels`        | string[]   | Inline, bounded                            |
| `threadHead`    | string     | First message id                           |
| `threadTail`    | string     | Newest message id                          |
| `messageCount`  | integer    | For sidebar/hover without scanning the log |

### CodeAnchor (Phase 1 minimal)

| Field            | Type    | Notes              |
| ---------------- | ------- | ------------------ |
| `filePath`       | string  | Workspace-relative |
| `startLine`      | integer |                    |
| `endLine`        | integer |                    |
| `startCharacter` | integer |                    |
| `endCharacter`   | integer |                    |
| `selectedText`   | string  |                    |

> Phase 2 adds `selectedTextHash`, `beforeContext`, and `afterContext` for durable recovery.

### TaskMessage (thread log entry)

| Field         | Type           | Notes                                       |
| ------------- | -------------- | ------------------------------------------- |
| `id`          | string         |                                             |
| `taskId`      | string         |                                             |
| `parentId`    | string \| null | Threaded replies; null for the root message |
| `seq`         | integer        | Monotonic per-task order                    |
| `authorType`  | AuthorType     |                                             |
| `author`      | string         |                                             |
| `content`     | string         |                                             |
| `timestamp`   | string         | ISO timestamp                               |
| `attachments` | string[]       | Phase 1: empty                              |

### TaskHistoryEvent (history log entry)

| Field       | Type    | Notes                            |
| ----------- | ------- | -------------------------------- |
| `id`        | string  |                                  |
| `taskId`    | string  |                                  |
| `seq`       | integer | Monotonic per-task order         |
| `type`      | string  | e.g. `created`, `status_changed` |
| `actor`     | string  |                                  |
| `timestamp` | string  | ISO timestamp                    |

## Validation

- Generated decoders validate task data on read/write from local storage.
- The data-model rationale (why thread/history are separate append-only logs) is in [docs/product-plan.md](../../docs/product-plan.md#data-model).
