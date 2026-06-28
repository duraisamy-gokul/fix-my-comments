import * as vscode from 'vscode';
import { hashLine } from '../storage';
import type { RecoveryResult, ThreadAnchor } from '../../../generated';

export function checkAnchor(document: vscode.TextDocument, anchor: ThreadAnchor): RecoveryResult {
  if (anchor.type === 'file' || anchor.line == null) {
    return { state: 'valid', line: null };
  }

  if (anchor.line < 0 || anchor.line >= document.lineCount) {
    return { state: 'orphaned', line: anchor.line };
  }

  const lineText = document.lineAt(anchor.line).text;
  if (hashLine(lineText) === anchor.lineHash) {
    return { state: 'valid', line: anchor.line };
  }
  return { state: 'outdated', line: anchor.line };
}
