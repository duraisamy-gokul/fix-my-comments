import * as vscode from 'vscode';

export class CommentCodeLensProvider implements vscode.CodeLensProvider, vscode.Disposable {
  private readonly onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.onDidChangeCodeLensesEmitter.event;
  private readonly disposable: vscode.Disposable;

  constructor() {
    this.disposable = vscode.window.onDidChangeTextEditorSelection(() => {
      this.onDidChangeCodeLensesEmitter.fire();
    });
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const editor = vscode.window.activeTextEditor;
    if (
      editor == null ||
      editor.document.uri.toString() !== document.uri.toString() ||
      editor.selection.isEmpty
    ) {
      return [];
    }

    const pos = editor.selection.start;
    return [
      new vscode.CodeLens(new vscode.Range(pos, pos), {
        title: '$(comment) Add Comment',
        command: 'fixMyComments.createTask',
        tooltip: 'Save this selection as a Fix My Comments task',
      }),
    ];
  }

  dispose(): void {
    this.disposable.dispose();
    this.onDidChangeCodeLensesEmitter.dispose();
  }
}
