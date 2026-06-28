import * as vscode from 'vscode';
import { hashLine } from '../storage';
import type { LineContentChange, ReviewThread } from '../../../generated';

export class AnchorTracker implements vscode.Disposable {
  private readonly liveLines = new Map<string, Map<string, number>>();
  private readonly lineHashes = new Map<string, Map<string, string>>();
  private readonly trackedFiles = new Set<string>();
  private readonly disposable: vscode.Disposable;

  private readonly onLineContentChangedEmitter = new vscode.EventEmitter<LineContentChange>();

  readonly onLineContentChanged = this.onLineContentChangedEmitter.event;

  constructor() {
    this.disposable = vscode.workspace.onDidChangeTextDocument((event) => {
      this.applyChanges(event);
    });
  }

  loadThreadsForFile(filePath: string, threads: ReviewThread[]): void {
    const lines = new Map<string, number>();
    const hashes = new Map<string, string>();
    for (const thread of threads) {
      if (thread.anchor.filePath !== filePath || thread.anchor.type !== 'line') {
        continue;
      }
      if (thread.anchor.line != null) {
        lines.set(thread.id, thread.anchor.line);
      }
      hashes.set(thread.id, thread.anchor.lineHash);
    }
    this.liveLines.set(filePath, lines);
    this.lineHashes.set(filePath, hashes);
    this.trackedFiles.add(filePath);
  }

  setLiveLine(filePath: string, threadId: string, line: number): void {
    let map = this.liveLines.get(filePath);
    if (map == null) {
      map = new Map();
      this.liveLines.set(filePath, map);
    }
    map.set(threadId, line);
    this.trackedFiles.add(filePath);
  }

  setLineHash(filePath: string, threadId: string, hash: string): void {
    let map = this.lineHashes.get(filePath);
    if (map == null) {
      map = new Map();
      this.lineHashes.set(filePath, map);
    }
    map.set(threadId, hash);
  }

  getLiveLine(filePath: string, threadId: string): number | null {
    return this.liveLines.get(filePath)?.get(threadId) ?? null;
  }

  getAllLiveLines(filePath: string): Map<string, number> {
    return this.liveLines.get(filePath) ?? new Map();
  }

  isTracked(filePath: string): boolean {
    return this.trackedFiles.has(filePath);
  }

  clearFile(filePath: string): void {
    this.liveLines.delete(filePath);
    this.lineHashes.delete(filePath);
    this.trackedFiles.delete(filePath);
  }

  private applyChanges(event: vscode.TextDocumentChangeEvent): void {
    if (event.contentChanges.length === 0) {
      return;
    }
    const filePath = vscode.workspace.asRelativePath(event.document.uri);
    const lineMap = this.liveLines.get(filePath);
    if (lineMap == null) {
      return;
    }
    const hashMap = this.lineHashes.get(filePath);

    for (const [threadId, line] of lineMap) {
      const before = line;
      const after = shiftLine(line, event.contentChanges);
      if (after !== before) {
        lineMap.set(threadId, after);
      }
      if (after === before && hashMap != null) {
        const storedHash = hashMap.get(threadId);
        if (
          storedHash != null &&
          storedHash.length > 0 &&
          after >= 0 &&
          after < event.document.lineCount
        ) {
          const liveText = event.document.lineAt(after).text;
          if (hashLine(liveText) !== storedHash) {
            this.onLineContentChangedEmitter.fire({
              filePath,
              threadId,
              line: after,
            });
          }
        }
      }
    }
  }

  dispose(): void {
    this.disposable.dispose();
    this.onLineContentChangedEmitter.dispose();
  }
}

function shiftLine(
  line: number,
  changes: readonly vscode.TextDocumentContentChangeEvent[],
): number {
  let shifted = line;
  for (const change of changes) {
    const linesRemoved = change.range.end.line - change.range.start.line;
    const linesAdded = (change.text.match(/\n/g) ?? []).length;
    const delta = linesAdded - linesRemoved;
    if (delta === 0) {
      continue;
    }
    if (change.range.end.line < shifted) {
      shifted += delta;
    }
  }
  if (shifted < 0) {
    return 0;
  }
  return shifted;
}
