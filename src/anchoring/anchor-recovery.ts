import * as vscode from 'vscode';
import { createHash } from 'node:crypto';
import type { CodeAnchor } from '../generated';

export type AnchorState = 'valid' | 'outdated' | 'orphaned';

export type RecoveryResult = {
  state: AnchorState;
  line: number;
};

/**
 * Check a single-line anchor against the current document.
 *
 * - valid: the line exists and its hash still matches.
 * - outdated: the line exists but its content changed (hash mismatch).
 * - orphaned: the line no longer exists (file shrank / line deleted).
 *
 * The stored line number is assumed to already be followed by the live
 * tracker; this only verifies the line's content.
 */
export function checkAnchor(document: vscode.TextDocument, anchor: CodeAnchor): RecoveryResult {
  if (anchor.line < 0 || anchor.line >= document.lineCount) {
    return { state: 'orphaned', line: anchor.line };
  }

  const lineText = document.lineAt(anchor.line).text;
  const currentHash = createHash('sha256').update(lineText).digest('hex').slice(0, 16);

  if (currentHash === anchor.lineHash) {
    return { state: 'valid', line: anchor.line };
  }
  return { state: 'outdated', line: anchor.line };
}
