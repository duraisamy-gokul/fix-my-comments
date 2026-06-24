import * as vscode from 'vscode';
import type { Task } from '../generated';

/**
 * Tracks the live line number of each task's anchor while a file is open.
 *
 * The line number is a *cache*, never the identity — the identity is the line
 * hash. When edits happen above a commented line (insert/delete lines), we
 * shift the stored line so the comment follows its line through an editing
 * session. Changes to the commented line's own content are detected separately
 * by `checkAnchor` (hash mismatch → outdated) and are not a shift.
 */
export class AnchorTracker implements vscode.Disposable {
  private readonly liveLines = new Map<string, Map<string, number>>();
  private readonly trackedFiles = new Set<string>();
  private readonly disposable: vscode.Disposable;

  constructor() {
    this.disposable = vscode.workspace.onDidChangeTextDocument((event) => {
      this.applyChanges(event);
    });
  }

  loadTasksForFile(filePath: string, tasks: Task[]): void {
    const map = new Map<string, number>();
    for (const task of tasks) {
      if (task.anchor.filePath !== filePath) {
        continue;
      }
      map.set(task.id, task.anchor.line);
    }
    this.liveLines.set(filePath, map);
    this.trackedFiles.add(filePath);
  }

  setLiveLine(filePath: string, taskId: string, line: number): void {
    let map = this.liveLines.get(filePath);
    if (map == null) {
      map = new Map();
      this.liveLines.set(filePath, map);
    }
    map.set(taskId, line);
    this.trackedFiles.add(filePath);
  }

  getLiveLine(filePath: string, taskId: string): number | null {
    return this.liveLines.get(filePath)?.get(taskId) ?? null;
  }

  getAllLiveLines(filePath: string): Map<string, number> {
    return this.liveLines.get(filePath) ?? new Map();
  }

  isTracked(filePath: string): boolean {
    return this.trackedFiles.has(filePath);
  }

  clearFile(filePath: string): void {
    this.liveLines.delete(filePath);
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
    for (const [taskId, line] of lineMap) {
      lineMap.set(taskId, shiftLine(line, event.contentChanges));
    }
  }

  dispose(): void {
    this.disposable.dispose();
  }
}

/**
 * Shift a single line number across a set of document content changes.
 * Edits that end above the line move it; edits within the line's own row are
 * content changes (handled by hash detection, not a shift).
 */
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
    // An edit strictly above this line shifts it.
    if (change.range.end.line < shifted) {
      shifted += delta;
    } else if (change.range.start.line <= shifted && change.range.end.line >= shifted) {
      // Edit overlaps the commented line itself — content changed. Leave the
      // line number; hash detection will mark it outdated.
    }
  }
  if (shifted < 0) {
    return 0;
  }
  return shifted;
}
