import * as vscode from 'vscode';
import { TaskStore } from '../storage/task-store';
import { resolveWorkspaceIdentity } from '../storage/workspace-identity';
import type { Task } from '../generated';

export class TasksViewProvider implements vscode.TreeDataProvider<TaskTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<TaskTreeItem | null>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  getTreeItem(element: TaskTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<TaskTreeItem[]> {
    const identity = await resolveWorkspaceIdentity();
    if (identity == null) {
      return [];
    }
    const store = new TaskStore(identity);
    const tasks = await store.listTasks();
    return tasks.map((task) => new TaskTreeItem(task));
  }

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire(null);
  }

  dispose(): void {
    this.onDidChangeTreeDataEmitter.dispose();
  }
}

export class TaskTreeItem extends vscode.TreeItem {
  constructor(readonly task: Task) {
    super(task.title, vscode.TreeItemCollapsibleState.None);

    const filePath = task.anchor.filePath;
    const fileName = filePath.split('/').pop() ?? filePath;
    const line = task.anchor.line + 1;
    const isOrphaned = task.status === 'orphaned' || task.status === 'outdated';
    const location = `${fileName}:${line}`;

    this.description = task.status === 'open' ? location : `${location} · ${task.status}`;
    this.tooltip = task.description.length > 0 ? task.description : task.title;
    this.iconPath = iconForStatus(task.status);
    this.contextValue = 'fmcTask';

    if (!isOrphaned) {
      this.command = {
        command: 'fixMyComments.openTask',
        title: 'Go to task',
        arguments: [task],
      };
    }
  }
}

function iconForStatus(status: Task['status']): vscode.ThemeIcon {
  switch (status) {
    case 'resolved':
      return new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('charts.green'));
    case 'closed':
      return new vscode.ThemeIcon('pass');
    case 'blocked':
      return new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('charts.red'));
    case 'in_progress':
      return new vscode.ThemeIcon('sync');
    case 'requires_review':
      return new vscode.ThemeIcon('eye');
    case 'orphaned':
      return new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
    case 'outdated':
      return new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
    default:
      return new vscode.ThemeIcon('comment');
  }
}
