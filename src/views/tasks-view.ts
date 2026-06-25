import * as vscode from 'vscode';
import { ThreadStore } from '../storage/thread-store';
import { resolveWorkspaceIdentity } from '../storage/workspace-identity';
import type { ReviewThread } from '../generated';

/**
 * Sidebar tree of review threads. Open threads first, then resolved, then
 * outdated; each shows a file:line location and a status icon.
 */
export class TasksViewProvider implements vscode.TreeDataProvider<ThreadTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<ThreadTreeItem | null>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  getTreeItem(element: ThreadTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<ThreadTreeItem[]> {
    const identity = await resolveWorkspaceIdentity();
    if (identity == null) {
      return [];
    }
    const store = new ThreadStore(identity);
    const threads = await store.listThreads();
    return threads.map((thread) => new ThreadTreeItem(thread));
  }

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire(null);
  }

  dispose(): void {
    this.onDidChangeTreeDataEmitter.dispose();
  }
}

export class ThreadTreeItem extends vscode.TreeItem {
  constructor(readonly thread: ReviewThread) {
    super(threadLabel(thread), vscode.TreeItemCollapsibleState.None);

    const filePath = thread.anchor.filePath;
    const fileName = filePath.split('/').pop() ?? filePath;
    const line = thread.anchor.line != null ? thread.anchor.line + 1 : null;
    const location = line != null ? `${fileName}:${line}` : fileName;
    const badges: string[] = [];
    if (thread.status.resolved) {
      badges.push('resolved');
    }
    if (thread.status.outdated) {
      badges.push('outdated');
    }

    this.description = badges.length > 0 ? `${location} · ${badges.join(', ')}` : location;
    this.tooltip = firstMessagePreview(thread);
    this.iconPath = iconForThread(thread);
    this.contextValue = 'fmcThread';

    if (!thread.status.outdated) {
      this.command = {
        command: 'fixMyComments.openThread',
        title: 'Go to thread',
        arguments: [thread],
      };
    }
  }
}

function threadLabel(thread: ReviewThread): string {
  const fileName = thread.anchor.filePath.split('/').pop() ?? thread.anchor.filePath;
  const line = thread.anchor.line != null ? `:${thread.anchor.line + 1}` : '';
  return `${fileName}${line}`;
}

function firstMessagePreview(_thread: ReviewThread): string {
  // The tree item's own description carries location + status; the full thread
  // body is shown inline. Tooltip stays short.
  return threadLabel(_thread);
}

function iconForThread(thread: ReviewThread): vscode.ThemeIcon {
  if (thread.status.resolved) {
    return new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('charts.green'));
  }
  if (thread.status.outdated) {
    return new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
  }
  return new vscode.ThemeIcon('comment');
}
