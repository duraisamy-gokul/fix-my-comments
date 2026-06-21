import * as vscode from 'vscode';
import { createHash } from 'node:crypto';
import type { WorkspaceIdentity } from '../generated';

export async function resolveWorkspaceIdentity(): Promise<WorkspaceIdentity | null> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (folder == null) {
    return null;
  }

  const repoRoot = folder.uri.fsPath;
  const branch = await readBranch(folder.uri);
  const key = createHash('sha1').update(`${repoRoot}@${branch}`).digest('hex').slice(0, 16);

  return { repoRoot, branch, key };
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
