import * as vscode from 'vscode';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import type { WorkspaceIdentity } from '../../../generated';

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

export const STORAGE_ROOT = path.join(os.homedir(), '.fixmycomments');

export const NO_GIT_BRANCH = 'no-git';

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
