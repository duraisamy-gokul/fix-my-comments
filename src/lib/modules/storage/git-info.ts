import * as vscode from 'vscode';
import { createHash } from 'node:crypto';
import type { ThreadAnchor } from '../../../generated';

export function buildAnchor(document: vscode.TextDocument, line: number): ThreadAnchor {
  const lineText = document.lineAt(line).text;
  return {
    type: 'line',
    filePath: vscode.workspace.asRelativePath(document.uri),
    line,
    lineHash: hashLine(lineText),
    snippet: lineText,
  };
}

export function buildFileAnchor(document: vscode.TextDocument): ThreadAnchor {
  return {
    type: 'file',
    filePath: vscode.workspace.asRelativePath(document.uri),
    line: null,
    lineHash: '',
    snippet: null,
  };
}

export function hashLine(lineText: string): string {
  return createHash('sha256').update(lineText).digest('hex').slice(0, 16);
}
