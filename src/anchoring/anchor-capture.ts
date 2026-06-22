import * as vscode from 'vscode';
import { createHash } from 'node:crypto';
import type { CodeAnchor } from '../generated';

const CONTEXT_LINES = 3;

export function buildAnchor(document: vscode.TextDocument, range: vscode.Range): CodeAnchor {
  const selectedText = document.getText(range);
  const textHash = createHash('sha256').update(selectedText).digest('hex').slice(0, 16);
  const beforeContext = collectLines(document, range.start.line - 1, -1, CONTEXT_LINES);
  const afterContext = collectLines(document, range.end.line + 1, 1, CONTEXT_LINES);
  return {
    filePath: vscode.workspace.asRelativePath(document.uri),
    startLine: range.start.line,
    endLine: range.end.line,
    startCharacter: range.start.character,
    endCharacter: range.end.character,
    selectedText,
    textHash,
    beforeContext,
    afterContext,
  };
}

function collectLines(
  document: vscode.TextDocument,
  start: number,
  step: number,
  count: number,
): string[] {
  const lines: string[] = [];
  let line = start;
  while (lines.length < count && line >= 0 && line < document.lineCount) {
    lines.push(document.lineAt(line).text);
    line += step;
  }
  if (step < 0) {
    lines.reverse();
  }
  return lines;
}
