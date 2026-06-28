# Phase 1: Planning

## Objective

Turn the refactor into a bounded architecture migration instead of rewriting behavior opportunistically.

## Findings

### Utility detection

- `type-crafter` is available in `package.json`.
- `type-decoder` is available as a runtime dependency.
- `typesafe-api-call` is not present and is not needed for this extension because the app currently uses local VS Code APIs and local JSON storage, not HTTP APIs.
- No project logger abstraction is present.

### Problem domain

This extension manages review threads anchored to source code lines. It must coordinate:

- VS Code native comments and comment commands.
- Thread/message persistence under the shared home-directory storage root.
- Anchor tracking and outdated detection.
- Sidebar tree state.
- Gutter decorations.
- External storage updates from the MCP server.

### Current responsibility map

| Area              | Current location                                      | Problem                                                                                               |
| ----------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| App startup       | `src/extension.ts`                                    | Activation and object graph wiring are mixed with command registration and watcher creation.          |
| Commands          | `src/extension.ts`                                    | Command IDs and handlers are repeated inline.                                                         |
| Native comments   | `src/comments/comment-controller.ts`                  | Adapter, persistence, rendering, target parsing, draft modes, and domain mutation are one class/file. |
| Message rendering | `src/comments/comment-controller.ts`                  | Markdown rendering and reaction links are helper functions in the controller file.                    |
| Target parsing    | `src/comments/comment-controller.ts`                  | Command target parsing is hidden at the bottom of the controller file.                                |
| Draft modes       | `src/comments/comment-controller.ts`                  | UI helper state, highlights, clipboard prefill, and message creation are mixed.                       |
| Types             | `types/*.yaml`, `src/generated/*`, local source files | Most domain types are generated, but some shareable pure data types are local.                        |
| Assets            | `resources/`                                          | Folder name is generic; desired structure is `assets/icons` and `assets/images`.                      |

## Architecture Decisions

### Module-based class structure

Use module folders for feature boundaries and classes for stateful/lifecycle behavior. Keep pure functions only for small local transformations inside the owning module.

Module layout rule:

```text
src/lib/modules/<module-name>/
├── main.ts        # public exports for this module
├── *.ts           # internal classes/services
└── utils.ts       # module-private helpers only when needed
```

Planned modules and classes:

- `src/lib/modules/app`
  - `ExtensionApp`: creates and owns the application object graph.
  - `CommandRegistry`: registers all VS Code commands and maps them to service/controller methods.
  - `StorageWatcher`: watches `~/.fixmycomments` JSON files and triggers refresh.
- `src/lib/modules/comments`
  - `FixMyCommentsController`: owns the native `vscode.CommentController` and native thread map only.
  - `ThreadService`: handles thread create/read/update/delete flows through `ThreadStore`.
  - `MessageService`: handles messages, task state, suggestions, and reactions.
  - `DraftModeService`: owns draft modes, helper comments, suggestion highlight state, and input prefill.
  - `CommentRenderer`: converts generated `ReviewMessage` records into VS Code comment bodies/view data.
  - `TargetResolver`: extracts thread/message IDs from command targets.
- `src/lib/modules/anchoring`
  - `AnchorEngine`, `AnchorTracker`, and recovery logic.
- `src/lib/modules/storage`
  - `ThreadStore`, workspace identity, and Git anchor helpers.
- `src/lib/modules/decorations`
  - Gutter decoration behavior.
- `src/lib/modules/tasks`
  - Sidebar task tree behavior.

### Type strategy

- Use `type`, never `interface`.
- Treat `types/*.yaml` as the source of truth for persistent and shared data types.
- Run `npm run gen:types` after schema changes.
- Keep implementation-only types local when they include VS Code objects, callbacks, or private state concepts.
- Candidate generated/shared types:
  - `AnchorState`
  - `RecoveryResult`
  - Possibly `DraftMode` if it becomes shared between `DraftModeService` and message creation.
- Keep local:
  - Target parsing helper result types involving `unknown` command inputs.
  - Constructor dependency types if they contain class instances or functions.

### Comment policy

- Delete comments that restate names or obvious code.
- Keep comments for cross-process contracts, VS Code API quirks, and non-obvious behavior.
- Do not hand-edit generated files solely to remove generated comments.

### Asset strategy

Move files without changing visual behavior:

| Current                         | Target                             | References to update                                          |
| ------------------------------- | ---------------------------------- | ------------------------------------------------------------- |
| `resources/icon.png`            | `assets/icons/icon.png`            | `package.json.icon`                                           |
| `resources/fix-my-comments.svg` | `assets/icons/fix-my-comments.svg` | `package.json.contributes.viewsContainers.activitybar[].icon` |
| `resources/gutter-comment.svg`  | `assets/images/gutter-comment.svg` | `GutterDecorator` `context.asAbsolutePath(...)`               |

## Tasks

- [ ] Confirm target class names and responsibilities before implementation.
- [ ] Inventory all imports of `FixMyCommentsController` and command handlers.
- [ ] Inventory all references to `resources/`.
- [ ] Decide whether `AnchorState`/`RecoveryResult` should be generated or remain local.
- [ ] Decide whether `DraftMode` should be generated or remain local.
- [ ] Define migration sequence so each phase can compile independently.

## Outputs

- A responsibility map for the current code.
- A target module/class map.
- A type-generation decision table.
- A migration order that preserves behavior.

## Validation

- [ ] Every current user-facing command has an owner in the target architecture.
- [ ] Every persistent/shared data shape has a generation decision.
- [ ] Every asset reference has a target path.
- [ ] No planned phase requires a webview rewrite or storage contract change.
