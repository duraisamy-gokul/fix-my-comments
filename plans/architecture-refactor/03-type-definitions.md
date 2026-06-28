# Phase 3: Type Definitions

## Objective

Make generated schemas the source of truth for shared data shapes and keep manual types only where generation is not appropriate.

## Current State

Generated type setup already exists:

- Schema entrypoint: `types/index.yaml`
- Schema files: `types/task.yaml`, `types/storage.yaml`
- Generated output: `src/generated/`
- Command: `npm run gen:types`

Manual types currently found in non-generated source:

| File                                 | Type                | Decision                                                                                               |
| ------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/comments/comment-controller.ts` | `DraftMode`         | Move to `draft-mode-service.ts`; generate only if it becomes shared data with no VS Code dependencies. |
| `src/anchoring/anchor-recovery.ts`   | `AnchorState`       | Prefer generated if used outside anchor recovery. Keep local if only private to recovery.              |
| `src/anchoring/anchor-recovery.ts`   | `RecoveryResult`    | Prefer generated if returned across module boundaries. Keep local if only private to recovery.         |
| `src/anchoring/anchor-tracker.ts`    | `LineContentChange` | Keep local unless multiple modules need it as a stable event payload contract.                         |

## Type Generation Rules

- Put persistent JSON shapes in `types/*.yaml`.
- Put cross-module pure data contracts in `types/*.yaml` if they are not tied to VS Code runtime objects.
- Do not put types with functions, class instances, callbacks, or `vscode.*` objects into `type-crafter` schemas.
- Import generated types from `src/generated` only.
- Never define a duplicate manual type for a generated schema.
- Use `type`, not `interface`.

## Candidate Schema Additions

If shared outside one file, add an anchoring schema section, for example:

```yaml
Anchoring:
  AnchorState:
    type: string
    enum:
      - valid
      - outdated
      - orphaned

  RecoveryResult:
    type: object
    required: [state]
    properties:
      state:
        $ref: './types/anchoring.yaml#/Anchoring/AnchorState'
      line:
        type: number
```

Then register it from `types/index.yaml` and run `npm run gen:types`.

## Generated Comment Policy

Generated files currently contain many generated docs because the YAML schemas have descriptions. Do not clean generated files manually. If generated comments remain too noisy, choose one of these approaches later:

1. Shorten schema descriptions so generated docs are shorter.
2. Check whether `type-crafter` supports output configuration that omits comments.
3. Accept generated comments and exclude generated files from manual comment cleanup rules.

## Tasks

- [ ] Confirm which manual types are shared contracts vs implementation details.
- [ ] Add `types/anchoring.yaml` only if anchoring result types should be generated.
- [ ] Register any new schema group in `types/index.yaml`.
- [ ] Move `DraftMode` to `draft-mode-service.ts` or generated schemas depending on usage.
- [ ] Remove duplicate manual types after generated imports are available.
- [ ] Run `npm run gen:types`.
- [ ] Run `npm run lint` and let generated formatting settle.

## Outputs

- Clear rule for generated vs manual types.
- Optional new schema file for anchoring types.
- Regenerated `src/generated/` output.
- No random domain type definitions hidden in controller/service files.

## Validation

- [ ] `npm run gen:types` completes successfully.
- [ ] `npm run check-types` passes.
- [ ] No manual type duplicates a generated type.
- [ ] No generated schema includes VS Code runtime objects or callbacks.
