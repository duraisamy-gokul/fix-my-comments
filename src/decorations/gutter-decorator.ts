import * as vscode from 'vscode';
import { TaskStore } from '../storage/task-store';
import { resolveWorkspaceIdentity } from '../storage/workspace-identity';
import { AnchorTracker } from '../anchoring/anchor-tracker';
import type { Task } from '../generated';

export class GutterDecorator implements vscode.Disposable {
  private readonly decorationType: vscode.TextEditorDecorationType;
  private readonly disposables: vscode.Disposable[] = [];
  private cachedTasks: Task[] | null = null;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly tracker: AnchorTracker,
  ) {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: context.asAbsolutePath('resources/gutter-comment.svg'),
      gutterIconSize: 'contain',
    });

    const current = vscode.window.activeTextEditor;
    if (current != null) {
      void this.applyToEditor(current);
    }

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor != null) {
          void this.applyToEditor(editor);
        }
      }),
      vscode.workspace.onDidChangeTextDocument((event) => {
        const editor = vscode.window.activeTextEditor;
        if (editor != null && editor.document === event.document) {
          this.applyFromTracker(editor);
        }
      }),
    );
  }

  refresh(): void {
    this.cachedTasks = null;
    const editor = vscode.window.activeTextEditor;
    if (editor != null) {
      void this.applyToEditor(editor);
    }
  }

  private applyFromTracker(editor: vscode.TextEditor): void {
    const filePath = vscode.workspace.asRelativePath(editor.document.uri);
    if (!this.tracker.isTracked(filePath)) {
      return;
    }
    editor.setDecorations(this.decorationType, this.rangesFromTracker(filePath));
  }

  private async applyToEditor(editor: vscode.TextEditor): Promise<void> {
    const filePath = vscode.workspace.asRelativePath(editor.document.uri);

    if (this.tracker.isTracked(filePath)) {
      editor.setDecorations(this.decorationType, this.rangesFromTracker(filePath));
      return;
    }

    if (this.cachedTasks == null) {
      const identity = await resolveWorkspaceIdentity();
      if (identity == null) {
        editor.setDecorations(this.decorationType, []);
        return;
      }
      const store = new TaskStore(identity);
      this.cachedTasks = await store.listTasks();
    }

    const ranges = this.cachedTasks
      .filter((t) => t.anchor.filePath === filePath && t.status === 'open')
      .map((t) => lineToRange(t.anchor.line));

    editor.setDecorations(this.decorationType, ranges);
  }

  private rangesFromTracker(filePath: string): vscode.Range[] {
    const liveLines = this.tracker.getAllLiveLines(filePath);
    const ranges: vscode.Range[] = [];
    for (const line of liveLines.values()) {
      ranges.push(lineToRange(line));
    }
    return ranges;
  }

  dispose(): void {
    this.decorationType.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

function lineToRange(line: number): vscode.Range {
  return new vscode.Range(line, 0, line, 0);
}
