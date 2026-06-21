# Sub-task 01 — esbuild Bundler & Build Setup

Part of [Phase 1](../00-overview.md). Maps to the **Bundler & build setup** checklist item.

_Plan produced via the Skulls MCP (sveltekit `client-module` phase-file standard), adapted to the VS Code extension stack._

## Objective

Replace the plain `tsc` emit with **esbuild** for bundling the extension host, while keeping `tsc` for type-checking. This is the dependency root for Phase 1: it gives every later sub-task a fast, correct, Marketplace-standard build before UI and storage code land.

## Why esbuild (not vite)

The extension host runs in a Node/CommonJS environment with `vscode` provided externally. esbuild is the VS Code Marketplace standard for this: fast, single-file CJS output, `vscode` marked external. `vite` targets browser/ESM apps and is reserved for webview front-ends in Phase 3.

## Tasks

- Add `esbuild` as a dev dependency.
- Add an `esbuild.js` build script that bundles `src/extension.ts` → `dist/extension.js`:
  - `platform: node`, `format: cjs`, `external: ['vscode']`
  - sourcemaps in dev, minify in production (`--production`), watch mode (`--watch`).
- Update `package.json` scripts:
  - `compile` → `node esbuild.js` (dev bundle)
  - `watch` → `node esbuild.js --watch`
  - `check-types` → `tsc --noEmit`
  - `build` → `check-types` then production bundle
  - `check` → `lint` + `format:check` + `build`
- Ensure `tsconfig.json` no longer emits (type-check only); esbuild owns the output.
- Confirm `.vscode/launch.json` still launches via the `compile` pre-launch task and `dist/**/*.js` sourcemaps resolve.

## Outputs

- `esbuild.js`
- Updated `package.json` scripts and `devDependencies`
- `dist/extension.js` (+ `.map`) produced by esbuild (gitignored)

## How to Test

1. `npm install`
2. `npm run check` — lint, format, type-check, and production bundle all pass.
3. `npm run compile` — confirm `dist/extension.js` is produced by esbuild.
4. Launch the Extension Development Host (green ▶ Run Extension, or `fn`+`F5`).
5. Command Palette → **"Fix My Comments: Hello World"** → notification **"Fix My Comments is ready."** appears.

**Proof to attach to the PR:** `npm run build` output + a screenshot of the Hello World notification from the dev host.

## Validation

- `npm run check` passes and `build` produces a bundled `dist/extension.js`.
- The extension still activates and the Hello World command works.
- `tsc` runs as a type-check only (no duplicate emit).
