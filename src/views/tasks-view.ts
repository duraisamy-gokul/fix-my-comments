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
    const store = new TaskStore(this.context.globalStorageUri, identity);
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
    const line = task.anchor.startLine + 1;
    this.description = `${fileName}:${line}`;
    this.tooltip = task.description.length > 0 ? task.description : task.title;
  }
}
