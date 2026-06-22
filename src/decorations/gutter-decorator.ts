import * as vscode from 'vscode';
import { TaskStore } from '../storage/task-store';
import { resolveWorkspaceIdentity } from '../storage/workspace-identity';
import type { Task } from '../generated';

export class GutterDecorator implements vscode.Disposable {
  private readonly decorationType: vscode.TextEditorDecorationType;
  private readonly disposable: vscode.Disposable;
  private cachedTasks: Task[] | null = null;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: context.asAbsolutePath('resources/gutter-comment.svg'),
      gutterIconSize: 'contain',
    });

    const current = vscode.window.activeTextEditor;
    if (current != null) {
      void this.applyToEditor(current);
    }

    this.disposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor != null) {
        void this.applyToEditor(editor);
      }
    });
  }

  refresh(): void {
    this.cachedTasks = null;
    const editor = vscode.window.activeTextEditor;
    if (editor != null) {
      void this.applyToEditor(editor);
    }
  }

  private async applyToEditor(editor: vscode.TextEditor): Promise<void> {
    if (this.cachedTasks == null) {
      const identity = await resolveWorkspaceIdentity();
      if (identity == null) {
        editor.setDecorations(this.decorationType, []);
        return;
      }
      const store = new TaskStore(this.context.globalStorageUri, identity);
      this.cachedTasks = await store.listTasks();
    }

    const filePath = vscode.workspace.asRelativePath(editor.document.uri);
    const ranges = this.cachedTasks
      .filter((t) => t.anchor.filePath === filePath && t.status === 'open')
      .map((t) => new vscode.Range(t.anchor.startLine, 0, t.anchor.endLine, 0));

    editor.setDecorations(this.decorationType, ranges);
  }

  dispose(): void {
    this.decorationType.dispose();
    this.disposable.dispose();
  }
}
