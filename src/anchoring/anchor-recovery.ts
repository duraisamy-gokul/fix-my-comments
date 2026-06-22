import * as vscode from 'vscode';
import { createHash } from 'node:crypto';
import type { CodeAnchor } from '../generated';

export type RecoveryResult = {
  range: vscode.Range;
  stage: 'hash' | 'text' | 'context';
};

export function recoverAnchor(
  document: vscode.TextDocument,
  anchor: CodeAnchor,
): RecoveryResult | null {
  if (anchor.selectedText.length === 0) {
    return null;
  }

  const byHash = recoverByHash(document, anchor);
  if (byHash != null) {
    return { range: byHash, stage: 'hash' };
  }

  const byText = recoverByText(document, anchor);
  if (byText != null) {
    return { range: byText, stage: 'text' };
  }

  const byContext = recoverByContext(document, anchor);
  if (byContext != null) {
    return { range: byContext, stage: 'context' };
  }

  return null;
}

function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function recoverByHash(document: vscode.TextDocument, anchor: CodeAnchor): vscode.Range | null {
  if (anchor.textHash == null || hashText(anchor.selectedText) !== anchor.textHash) {
    return null;
  }
  return findNearestExact(document, document.getText(), anchor.selectedText, anchor.startLine);
}

function recoverByText(document: vscode.TextDocument, anchor: CodeAnchor): vscode.Range | null {
  const needle = normaliseWhitespace(anchor.selectedText);
  if (needle.length === 0) {
    return null;
  }

  const text = document.getText();
  const { normalised, offsets } = buildNormalisedIndex(text);

  let bestRange: vscode.Range | null = null;
  let bestDistance = Infinity;
  let searchFrom = 0;

  while (true) {
    const found = normalised.indexOf(needle, searchFrom);
    if (found === -1) {
      break;
    }
    const startOffset = offsets[found];
    const endOffset = offsets[found + needle.length - 1] + 1;
    const startPos = document.positionAt(startOffset);
    const endPos = document.positionAt(endOffset);
    const dist = Math.abs(startPos.line - anchor.startLine);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestRange = new vscode.Range(startPos, endPos);
    }
    searchFrom = found + 1;
  }

  return bestRange;
}

function recoverByContext(document: vscode.TextDocument, anchor: CodeAnchor): vscode.Range | null {
  const beforeCtx = anchor.beforeContext ?? [];
  const afterCtx = anchor.afterContext ?? [];
  if (beforeCtx.length === 0 && afterCtx.length === 0) {
    return null;
  }

  const anchorLineCount = anchor.endLine - anchor.startLine;
  let bestRange: vscode.Range | null = null;
  let bestScore = 0;

  for (let i = 0; i < document.lineCount; i++) {
    const score = scoreContext(document, i, anchorLineCount, beforeCtx, afterCtx);
    if (score > bestScore) {
      bestScore = score;
      const endLine = Math.min(i + anchorLineCount, document.lineCount - 1);
      bestRange = new vscode.Range(
        i,
        anchor.startCharacter,
        endLine,
        Math.min(anchor.endCharacter, document.lineAt(endLine).text.length),
      );
    }
  }

  return bestRange;
}

function findNearestExact(
  document: vscode.TextDocument,
  text: string,
  needle: string,
  preferLine: number,
): vscode.Range | null {
  let bestRange: vscode.Range | null = null;
  let bestDistance = Infinity;
  let searchFrom = 0;

  while (true) {
    const found = text.indexOf(needle, searchFrom);
    if (found === -1) {
      break;
    }
    const startPos = document.positionAt(found);
    const endPos = document.positionAt(found + needle.length);
    const dist = Math.abs(startPos.line - preferLine);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestRange = new vscode.Range(startPos, endPos);
    }
    searchFrom = found + 1;
  }

  return bestRange;
}

function scoreContext(
  document: vscode.TextDocument,
  startLine: number,
  anchorLineCount: number,
  beforeCtx: string[],
  afterCtx: string[],
): number {
  let score = 0;
  for (let j = 0; j < beforeCtx.length; j++) {
    const docLine = startLine - beforeCtx.length + j;
    if (docLine >= 0 && document.lineAt(docLine).text === beforeCtx[j]) {
      score++;
    }
  }
  for (let j = 0; j < afterCtx.length; j++) {
    const docLine = startLine + anchorLineCount + 1 + j;
    if (docLine < document.lineCount && document.lineAt(docLine).text === afterCtx[j]) {
      score++;
    }
  }
  return score;
}

function normaliseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function buildNormalisedIndex(text: string): { normalised: string; offsets: number[] } {
  let normalised = '';
  const offsets: number[] = [];
  let inWhitespace = false;

  for (let i = 0; i < text.length; i++) {
    const isWhitespace = /\s/.test(text[i]);
    if (isWhitespace) {
      if (!inWhitespace) {
        normalised += ' ';
        offsets.push(i);
        inWhitespace = true;
      }
    } else {
      normalised += text[i];
      offsets.push(i);
      inWhitespace = false;
    }
  }

  return { normalised, offsets };
}
