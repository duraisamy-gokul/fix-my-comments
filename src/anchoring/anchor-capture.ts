import * as vscode from 'vscode';
import { createHash } from 'node:crypto';
import type { CodeAnchor } from '../generated';

/**
 * Build a single-line anchor: just the file path, the line number, and a hash
 * of that line's text. No selected text, no character ranges, no context.
 * The line hash lets us detect when the commented line's content changes
 * (and mark the comment outdated); the line number is followed as lines shift.
 */
export function buildAnchor(document: vscode.TextDocument, line: number): CodeAnchor {
  const lineText = document.lineAt(line).text;
  const lineHash = createHash('sha256').update(lineText).digest('hex').slice(0, 16);
  return {
    filePath: vscode.workspace.asRelativePath(document.uri),
    line,
    lineHash,
  };
}
