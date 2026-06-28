import * as vscode from 'vscode';
import type { FixMyCommentsController } from '../comments';
import type { TasksViewProvider } from '../tasks';
import { resolveWorkspaceIdentity, STORAGE_ROOT } from '../storage';

export class StorageWatcher implements vscode.Disposable {
  private readonly watcher: vscode.FileSystemWatcher;

  constructor(
    private readonly controller: FixMyCommentsController,
    private readonly tasksProvider: TasksViewProvider,
  ) {
    const pattern = new vscode.RelativePattern(
      vscode.Uri.file(STORAGE_ROOT),
      '**/{threads,messages}.json',
    );
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);

    this.watcher.onDidChange(() => this.refresh());
    this.watcher.onDidCreate(() => this.refresh());
  }

  private refresh(): void {
    void resolveWorkspaceIdentity().then((identity) => {
      if (identity == null) {
        return;
      }
      void this.controller.rebuildAllThreads();
      this.tasksProvider.refresh();
    });
  }

  dispose(): void {
    this.watcher.dispose();
  }
}
