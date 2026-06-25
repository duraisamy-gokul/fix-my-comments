import * as vscode from 'vscode';
import { hashLine } from '../storage/git-info';
import type { ThreadAnchor } from '../generated';

export type AnchorState = 'valid' | 'outdated' | 'orphaned';

export type RecoveryResult = {
  state: AnchorState;
  line: number | null;
};

/**
 * Check a single-line anchor against the current document.
 *
 * - valid: the line exists and its hash still matches.
 * - outdated: the line exists but its content changed (hash mismatch).
 * - orphaned: the line no longer exists (file shrank / line deleted), or the
 *   anchor is file-level (no line to verify).
 *
 * The stored line number is assumed to already be followed by the live
 * tracker; this only verifies the line's content. File-level anchors are
 * always considered valid (they have no line to drift).
 */
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
