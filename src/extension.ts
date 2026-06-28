import * as vscode from 'vscode';
import { ExtensionApp } from './lib/modules/app';

export function activate(context: vscode.ExtensionContext): void {
  new ExtensionApp(context).start();
}

export function deactivate(): void {}
