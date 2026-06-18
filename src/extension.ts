import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('fixMyComments.helloWorld', () => {
    void vscode.window.showInformationMessage('Fix My Comments is ready.');
  });

  context.subscriptions.push(disposable);
}

export function deactivate(): void {}
