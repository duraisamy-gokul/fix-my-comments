import * as vscode from 'vscode';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import type { WorkspaceIdentity } from '../generated';

/**
 * Fix My Comments stores all task data under `~/.fixmycomments/` (the home
 * directory root, like `~/.claude/`), never inside the user's source repo.
 *
 * Layout (human-readable repo + branch, shared verbatim by the MCP server):
 *
 *   ~/.fixmycomments/
 *     <repo-basename>-<shorthash>/   ← repo + short hash for uniqueness
 *       <branch>/                     ← branch slashes become dashes
 *         threads.json                ← ReviewThread[] (ThreadFile)
 *         messages.json                ← ReviewMessage[] (ReviewMessageFile)
 *
 * Both this extension and the `fix-my-comments-mcp` server compute this path,
 * so the rule below is the contract between them and must not drift.
 */
export async function resolveWorkspaceIdentity(): Promise<WorkspaceIdentity | null> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (folder == null) {
    return null;
  }

  const repoRoot = folder.uri.fsPath;
  const branch = await readBranch(folder.uri);
  const storagePath = computeStoragePath(repoRoot, branch);

  return {
    repoRoot,
    branch,
    storagePath,
  };
}

/** Home-relative root for all Fix My Comments data. */
export const STORAGE_ROOT = path.join(os.homedir(), '.fixmycomments');

/** Sentinel branch value for folders with no `.git` (not a git repo). */
export const NO_GIT_BRANCH = 'no-git';

/**
 * Compute the on-disk directory for a repo+branch. Shared with the MCP server.
 *
 * - Git repo: `~/.fixmycomments/<repo>-<hash>/<branch>/` — branch slashes become
 *   dashes so `feature/branch` lives at `feature-branch`. Each branch keeps its
 *   own comments.
 * - Non-git folder: `~/.fixmycomments/<folder>-<hash>/` — no branch segment.
 *   Comments live directly under the folder bucket.
 *
 * Detached HEAD keeps a `detached` folder (still a git repo, just branchless).
 */
export function computeStoragePath(repoRoot: string, branch: string): string {
  const repoFolder = `${path.basename(repoRoot)}-${hashRepoRoot(repoRoot)}`;
  if (branch === NO_GIT_BRANCH) {
    return path.join(STORAGE_ROOT, repoFolder);
  }
  const branchFolder = branch.replace(/\//g, '-');
  return path.join(STORAGE_ROOT, repoFolder, branchFolder);
}

function hashRepoRoot(repoRoot: string): string {
  return createHash('sha1').update(repoRoot).digest('hex').slice(0, 8);
}

async function readBranch(root: vscode.Uri): Promise<string> {
  const prefix = 'ref: refs/heads/';
  try {
    const headUri = vscode.Uri.joinPath(root, '.git', 'HEAD');
    const bytes = await vscode.workspace.fs.readFile(headUri);
    const head = Buffer.from(bytes).toString('utf8').trim();
    if (head.startsWith(prefix)) {
      return head.slice(prefix.length);
    }
    return 'detached';
  } catch {
    return 'no-git';
  }
}
