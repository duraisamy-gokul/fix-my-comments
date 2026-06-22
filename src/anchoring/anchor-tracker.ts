import * as vscode from 'vscode';
import type { Task } from '../generated';

export class AnchorTracker implements vscode.Disposable {
  private readonly liveAnchors = new Map<string, Map<string, vscode.Range>>();
  private readonly trackedFiles = new Set<string>();
  private readonly disposable: vscode.Disposable;

  constructor() {
    this.disposable = vscode.workspace.onDidChangeTextDocument((event) => {
      this.applyChanges(event);
    });
  }

  loadTasksForFile(filePath: string, tasks: Task[]): void {
    const map = new Map<string, vscode.Range>();
    for (const task of tasks) {
      if (task.anchor.filePath !== filePath) {
        continue;
      }
      map.set(
        task.id,
        new vscode.Range(
          task.anchor.startLine,
          task.anchor.startCharacter,
          task.anchor.endLine,
          task.anchor.endCharacter,
        ),
      );
    }
    this.liveAnchors.set(filePath, map);
    this.trackedFiles.add(filePath);
  }

  setLiveRange(filePath: string, taskId: string, range: vscode.Range): void {
    let map = this.liveAnchors.get(filePath);
    if (map == null) {
      map = new Map();
      this.liveAnchors.set(filePath, map);
    }
    map.set(taskId, range);
    this.trackedFiles.add(filePath);
  }

  getLiveRange(filePath: string, taskId: string): vscode.Range | null {
    return this.liveAnchors.get(filePath)?.get(taskId) ?? null;
  }

  getAllLiveRanges(filePath: string): Map<string, vscode.Range> {
    return this.liveAnchors.get(filePath) ?? new Map();
  }

  isTracked(filePath: string): boolean {
    return this.trackedFiles.has(filePath);
  }

  clearFile(filePath: string): void {
    this.liveAnchors.delete(filePath);
    this.trackedFiles.delete(filePath);
  }

  private applyChanges(event: vscode.TextDocumentChangeEvent): void {
    if (event.contentChanges.length === 0) {
      return;
    }
    const filePath = vscode.workspace.asRelativePath(event.document.uri);
    const anchorMap = this.liveAnchors.get(filePath);
    if (anchorMap == null) {
      return;
    }
    for (const [taskId, range] of anchorMap) {
      anchorMap.set(taskId, shiftRange(range, event.contentChanges));
    }
  }

  dispose(): void {
    this.disposable.dispose();
  }
}

function shiftRange(
  range: vscode.Range,
  changes: readonly vscode.TextDocumentContentChangeEvent[],
): vscode.Range {
  let { start, end } = range;

  for (const change of changes) {
    const linesRemoved = change.range.end.line - change.range.start.line;
    const linesAdded = (change.text.match(/\n/g) ?? []).length;
    const delta = linesAdded - linesRemoved;
    if (delta === 0) {
      continue;
    }
    if (change.range.end.line < start.line) {
      start = start.translate(delta);
      end = end.translate(delta);
    } else if (change.range.start.line <= end.line) {
      end = new vscode.Position(Math.max(start.line, end.line + delta), end.character);
    }
  }

  return new vscode.Range(start, end);
}
