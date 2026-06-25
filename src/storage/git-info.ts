import * as vscode from 'vscode';
import { createHash } from 'node:crypto';
import type { ThreadAnchor } from '../generated';

/**
 * Build a single-line anchor for a thread: file path, line number, and a hash
 * of that line's text (so we can detect when the commented line's content
 * changes and mark the thread outdated). The line number is followed as lines
 * shift; the line hash is the identity. The original line text is kept as a
 * snippet for display when the line has drifted.
 *
 * Anchoring is per-branch (storage is scoped to `<repo>/<branch>/`), never
 * per-commit — comments ride along the branch as it moves.
 */
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

/** Build a file-level anchor (no line). */
export function buildFileAnchor(document: vscode.TextDocument): ThreadAnchor {
  return {
    type: 'file',
    filePath: vscode.workspace.asRelativePath(document.uri),
    line: null,
    lineHash: '',
    snippet: null,
  };
}

/** SHA-256 hex digest, first 16 chars — the line-identity hash. */
export function hashLine(lineText: string): string {
  return createHash('sha256').update(lineText).digest('hex').slice(0, 16);
}
