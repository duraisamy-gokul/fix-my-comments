# Contributing to Fix My Comments

Thanks for contributing. This project is built in the open, one small pull request at a time. This guide explains how the roadmap is structured, how to pick work, and the conventions you must follow.

## The Big Picture

Work is organized top-down:

```text
Roadmap  →  Phase (sub-product)  →  Subtask  →  Pull Request  →  Mark done
```

- The **roadmap** is [docs/roadmap.md](docs/roadmap.md). It lists every phase and its status.
- Each **phase** is a sub-product with its own plan in [`/plans`](plans). One phase = one milestone.
- Each **subtask** is a single checklist item inside a phase's `checklist.md`. One subtask = one pull request.
- A phase is complete when all of its subtasks are checked off.

Multiple people can work inside the same phase at once, as long as they pick different subtasks.

## How Work Is Claimed (Avoiding Collisions)

Every subtask is tracked as a **GitHub Issue**. To avoid two people doing the same work, claiming is a simple, visible convention:

The rule is simple: **claim before you code.**

### Claim Flow

1. Open [docs/roadmap.md](docs/roadmap.md) and pick a phase that is not blocked.
2. Open that phase's `checklist.md` in [`/plans`](plans) and find an unchecked subtask.
3. Find (or open) the GitHub Issue for that subtask using the "Subtask" issue template.
4. Before starting, check the issue:
   - Skim recent comments and linked pull requests. If someone has already commented that they are taking it, or there is an open PR, pick a different subtask.
   - Otherwise, comment **"Claiming this"** so others can see it is taken.
5. Open a **draft PR early** with `Closes #<issue-number>` (see below). The draft PR is the strongest claim signal — it shows up directly on the issue.

If a claimed issue shows no linked PR or activity for about **7 days**, treat it as available again.

> Maintainers may add the issue assignee as an extra signal where they have permission, but the comment + draft PR convention is what everyone relies on, since GitHub only allows assigning users who have write access to the repo.

## Making a Change

1. Create a branch (see naming below).
2. Implement only that subtask. Keep the PR focused — one subtask per PR.
3. Open a **draft PR early** with `Closes #<issue-number>` in the description. This links the PR to the issue and signals work is in progress.
4. Run the checks locally (see below).
5. In your PR, check off the subtask in the phase `checklist.md` and, if it was the last one, update the phase status in [docs/roadmap.md](docs/roadmap.md).
6. Mark the PR ready for review against `release`.

### Branch Naming

Branches use a conventional-commit type prefix with a slash (git branches can't contain spaces or start with a type-and-colon, so `/` is used):

```text
<type>/phase-<n>-<short-subtask-slug>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

Examples:

- `feat/phase-1-storage-layer`
- `fix/phase-2-anchor-hash-recovery`
- `docs/phase-1-overview-tweak`

### Commit Messages and PR Titles

Use [Conventional Commits](https://www.conventionalcommits.org/). The scope is the phase:

```text
feat(phase-1): create task from selection command
fix(phase-2): correct hash recovery on trimmed selection
docs(roadmap): mark phase 1 storage subtask done
```

## Local Development

Install dependencies:

```bash
npm install
```

Compile:

```bash
npm run compile
```

Run the extension:

1. Open the repository in VS Code.
2. Press `F5` to launch the Extension Development Host.
3. Try the **Fix My Comments** commands from the Command Palette.

### Scripts

```bash
npm run compile     # type-check and build to dist/
npm run watch       # rebuild on change
npm run lint        # ESLint
npm run format      # Prettier (write)
npm run check       # lint + format check + build (runs on pre-commit)
npm run gen:types    # regenerate committed types from types/*.yaml (active once specs exist)
```

### Project Structure

```text
src/
  extension.ts        # extension entry point
  generated/          # types generated from types/*.yaml — committed, do not edit by hand
types/
  index.yaml          # references the per-domain type specs (added during implementation)
docs/
  product-plan.md     # full product design and data model
  roadmap.md          # phased roadmap with diagrams
plans/
  phase-*/            # one sub-product plan per roadmap phase (overview + checklist)
.github/
  ISSUE_TEMPLATE/     # subtask issue template
```

## Required Checks

Every PR must pass:

```bash
npm run check
```

This runs lint, format check, and build. A pre-commit hook runs the same checks, so commits that do not pass will be blocked.

Format your code before committing:

```bash
npm run format
```

## Types (Planned, Not Yet Generated)

The project is in the planning stage, so there is no type spec or code generation wired up yet. Shared domain types are **designed in the plan docs** — see each phase's `03-type-definitions.md` (added where a phase introduces types).

When implementation of a phase begins, that phase introduces the actual tooling:

- Per-domain YAML specs under `types/` (e.g. `types/task.yaml`), with a small `types/index.yaml` that `$ref`s them.
- A `gen:types` script that runs `type-crafter` to emit TypeScript types with runtime decoders into `src/generated/`.
- **Generated files are committed** (not gitignored). The pre-commit hook regenerates them from the YAML and stages them, so the committed output never drifts from the spec. This step is skipped until the first `types/*.yaml` exists, so commits are not blocked during planning.
- Generated files are never hand-edited; the YAML is the source of truth. Edit the YAML and commit the regenerated output together.

Until a phase introduces the type tooling, do not author type YAML or generated code — capture the intended shapes in the relevant plan's `03-type-definitions.md` instead.

## Code Style

- TypeScript, strict mode.
- ESLint config in [eslint.config.mjs](eslint.config.mjs). Notable rules:
  - Curly braces required on all control statements.
  - No `as` type assertions.
  - No `undefined` literal — use `null` or proper checks.
  - No TypeScript type predicates.
  - Unused imports are errors.
- Prettier for formatting (config in `.prettierrc`).
- Code should be self-explanatory. Only comment non-obvious behavior.

## Pull Request Checklist

Before requesting review, confirm:

- [ ] The PR implements exactly one subtask.
- [ ] `npm run check` passes.
- [ ] If types changed, the regenerated `src/generated/` output was committed alongside the YAML.
- [ ] The subtask is checked off in the phase `checklist.md`.
- [ ] Roadmap status updated if this completed the phase.
