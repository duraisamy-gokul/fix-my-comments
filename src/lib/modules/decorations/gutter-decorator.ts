import * as vscode from 'vscode';
import { ThreadStore } from '../storage';
import { resolveWorkspaceIdentity } from '../storage';
import { AnchorTracker } from '../anchoring';
import type { ReviewThread } from '../../../generated';

export class GutterDecorator implements vscode.Disposable {
  private readonly decorationType: vscode.TextEditorDecorationType;
  private readonly disposables: vscode.Disposable[] = [];
  private cachedThreads: ReviewThread[] | null = null;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly tracker: AnchorTracker,
  ) {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: context.asAbsolutePath('assets/images/gutter-comment.svg'),
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
    this.cachedThreads = null;
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

    if (this.cachedThreads == null) {
      const identity = await resolveWorkspaceIdentity();
      if (identity == null) {
        editor.setDecorations(this.decorationType, []);
        return;
      }
      const store = new ThreadStore(identity);
      this.cachedThreads = await store.listThreads();
    }

    const ranges: vscode.Range[] = [];
    for (const t of this.cachedThreads) {
      if (t.anchor.filePath !== filePath || t.anchor.type !== 'line' || t.status.resolved) {
        continue;
      }
      if (t.anchor.line != null) {
        ranges.push(lineToRange(t.anchor.line));
      }
    }

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
