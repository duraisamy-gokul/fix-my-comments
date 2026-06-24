import * as vscode from 'vscode';
import { TaskStore } from '../storage/task-store';
import { resolveWorkspaceIdentity } from '../storage/workspace-identity';
import { checkAnchor } from '../anchoring/anchor-recovery';
import { AnchorTracker } from '../anchoring/anchor-tracker';
import type { Task } from '../generated';
import type { TasksViewProvider } from '../views/tasks-view';

export class AnchorEngine implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly tracker: AnchorTracker,
    private readonly tasksProvider: TasksViewProvider,
  ) {
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((doc) => {
        void this.onDocumentOpened(doc);
      }),
      vscode.workspace.onDidSaveTextDocument((doc) => {
        void this.onDocumentSaved(doc);
      }),
      vscode.workspace.onDidCloseTextDocument((doc) => {
        this.tracker.clearFile(vscode.workspace.asRelativePath(doc.uri));
      }),
    );

    for (const doc of vscode.workspace.textDocuments) {
      void this.onDocumentOpened(doc);
    }
  }

  private async onDocumentOpened(document: vscode.TextDocument): Promise<void> {
    if (document.uri.scheme !== 'file') {
      return;
    }
    const identity = await resolveWorkspaceIdentity();
    if (identity == null) {
      return;
    }
    const store = new TaskStore(identity);
    const tasks = await store.listTasks();
    const filePath = vscode.workspace.asRelativePath(document.uri);
    const fileTasks = tasks.filter((t) => t.anchor.filePath === filePath && t.status !== 'closed');

    this.tracker.loadTasksForFile(filePath, fileTasks);

    const updates: Task[] = [];
    const now = new Date().toISOString();

    for (const task of fileTasks) {
      const liveLine = this.tracker.getLiveLine(filePath, task.id);
      const anchor = liveLine != null ? { ...task.anchor, line: liveLine } : task.anchor;
      const result = checkAnchor(document, anchor);

      if (result.state === 'valid') {
        if (anchor.line !== task.anchor.line) {
          updates.push({ ...task, anchor, updatedAt: now });
        }
      } else if (result.state === 'outdated') {
        if (task.status !== 'outdated') {
          updates.push({ ...task, anchor, status: 'outdated', updatedAt: now });
        }
      } else {
        if (task.status !== 'orphaned') {
          updates.push({ ...task, anchor, status: 'orphaned', updatedAt: now });
        }
      }
    }

    if (updates.length > 0) {
      for (const task of updates) {
        await store.saveTask(task);
      }
      this.tasksProvider.refresh();
    }
  }

  private async onDocumentSaved(document: vscode.TextDocument): Promise<void> {
    if (document.uri.scheme !== 'file') {
      return;
    }
    const identity = await resolveWorkspaceIdentity();
    if (identity == null) {
      return;
    }
    const filePath = vscode.workspace.asRelativePath(document.uri);
    const liveLines = this.tracker.getAllLiveLines(filePath);
    if (liveLines.size === 0) {
      return;
    }

    const store = new TaskStore(identity);
    const tasks = await store.listTasks();
    const now = new Date().toISOString();
    const updates: Task[] = [];

    for (const task of tasks) {
      if (task.anchor.filePath !== filePath || task.status === 'closed') {
        continue;
      }
      const liveLine = liveLines.get(task.id);
      if (liveLine == null || liveLine === task.anchor.line) {
        continue;
      }
      // The line shifted during the session; persist the new line number.
      // Re-check content too, since the save may have changed the line's text.
      const anchor = { ...task.anchor, line: liveLine };
      const result = checkAnchor(document, anchor);
      const status =
        result.state === 'outdated'
          ? 'outdated'
          : result.state === 'orphaned'
            ? 'orphaned'
            : task.status === 'outdated' || task.status === 'orphaned'
              ? 'open'
              : task.status;
      updates.push({ ...task, anchor, status, updatedAt: now });
    }

    if (updates.length > 0) {
      for (const task of updates) {
        await store.saveTask(task);
      }
      this.tasksProvider.refresh();
    }
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
