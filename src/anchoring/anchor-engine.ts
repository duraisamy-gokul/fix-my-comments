import * as vscode from 'vscode';
import { TaskStore } from '../storage/task-store';
import { resolveWorkspaceIdentity } from '../storage/workspace-identity';
import { recoverAnchor } from './anchor-recovery';
import { AnchorTracker } from './anchor-tracker';
import type { CodeAnchor, Task } from '../generated';
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
    const store = new TaskStore(this.context.globalStorageUri, identity);
    const tasks = await store.listTasks();
    const filePath = vscode.workspace.asRelativePath(document.uri);
    const fileTasks = tasks.filter((t) => t.anchor.filePath === filePath && t.status !== 'closed');

    this.tracker.loadTasksForFile(filePath, fileTasks);

    const updates: Task[] = [];
    const now = new Date().toISOString();

    for (const task of fileTasks) {
      if (task.status === 'orphaned') {
        continue;
      }
      const result = recoverAnchor(document, task.anchor);
      if (result == null) {
        updates.push({ ...task, status: 'orphaned', updatedAt: now });
      } else {
        this.tracker.setLiveRange(filePath, task.id, result.range);
        if (anchorMoved(task.anchor, result.range)) {
          const updated = {
            ...task,
            anchor: mergeAnchor(task.anchor, result.range),
            updatedAt: now,
          };
          updates.push(updated);
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
    const liveRanges = this.tracker.getAllLiveRanges(filePath);
    if (liveRanges.size === 0) {
      return;
    }

    const store = new TaskStore(this.context.globalStorageUri, identity);
    const tasks = await store.listTasks();
    const now = new Date().toISOString();
    let changed = false;

    for (const task of tasks) {
      if (task.anchor.filePath !== filePath || task.status === 'orphaned') {
        continue;
      }
      const liveRange = liveRanges.get(task.id);
      if (liveRange == null || !anchorMoved(task.anchor, liveRange)) {
        continue;
      }
      await store.saveTask({
        ...task,
        anchor: mergeAnchor(task.anchor, liveRange),
        updatedAt: now,
      });
      changed = true;
    }

    if (changed) {
      this.tasksProvider.refresh();
    }
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

function anchorMoved(anchor: CodeAnchor, range: vscode.Range): boolean {
  return (
    anchor.startLine !== range.start.line ||
    anchor.endLine !== range.end.line ||
    anchor.startCharacter !== range.start.character ||
    anchor.endCharacter !== range.end.character
  );
}

function mergeAnchor(existing: CodeAnchor, range: vscode.Range): CodeAnchor {
  return {
    ...existing,
    startLine: range.start.line,
    endLine: range.end.line,
    startCharacter: range.start.character,
    endCharacter: range.end.character,
  };
}
