import * as vscode from 'vscode';
import { ThreadStore } from '../storage';
import { resolveWorkspaceIdentity } from '../storage';
import { checkAnchor } from './recovery';
import { AnchorTracker } from './tracker';
import type { ReviewThread } from '../../../generated';
import type { TasksViewProvider } from '../tasks';

export class AnchorEngine implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly tracker: AnchorTracker,
    private readonly tasksProvider: TasksViewProvider,
  ) {
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((doc) => {
        void this.onDocumentOpened(doc);
      }),
      vscode.workspace.onDidSaveTextDocument((doc) => {
        void this.onDocumentSaved(doc);
      }),
      vscode.workspace.onDidCloseTextDocument((doc) => {
        this.tracker.clearFile(vscode.workspace.asRelativePath(doc.uri));
      }),
      tracker.onLineContentChanged((change) => {
        void this.onLineContentChanged(change);
      }),
    );

    for (const doc of vscode.workspace.textDocuments) {
      void this.onDocumentOpened(doc);
    }
  }

  private async onDocumentOpened(document: vscode.TextDocument): Promise<void> {
    if (document.uri.scheme !== 'file') {
      return;
    }
    const store = await this.resolveStore();
    if (store == null) {
      return;
    }
    const filePath = vscode.workspace.asRelativePath(document.uri);
    const threads = await store.listThreads();
    const fileThreads = threads.filter((t) => t.anchor.filePath === filePath);

    this.tracker.loadThreadsForFile(filePath, fileThreads);

    const updates: ReviewThread[] = [];
    const now = new Date().toISOString();

    for (const thread of fileThreads) {
      const liveLine = this.tracker.getLiveLine(filePath, thread.id);
      const anchor = liveLine != null ? { ...thread.anchor, line: liveLine } : thread.anchor;
      const result = checkAnchor(document, anchor);

      if (result.state === 'valid') {
        if (anchor.line !== thread.anchor.line) {
          updates.push({ ...thread, anchor, metadata: { ...thread.metadata, updatedAt: now } });
        }
      } else if (result.state === 'outdated') {
        if (!thread.status.outdated) {
          updates.push({
            ...thread,
            anchor,
            status: { ...thread.status, outdated: true },
            metadata: { ...thread.metadata, updatedAt: now },
          });
        }
      } else if (result.state === 'orphaned') {
        if (!thread.status.outdated) {
          updates.push({
            ...thread,
            status: { ...thread.status, outdated: true },
            metadata: { ...thread.metadata, updatedAt: now },
          });
        }
      }
    }

    if (updates.length > 0) {
      for (const thread of updates) {
        await store.saveThread(thread);
      }
      this.tasksProvider.refresh();
    }
  }

  private async onLineContentChanged(change: {
    filePath: string;
    threadId: string;
    line: number;
  }): Promise<void> {
    const store = await this.resolveStore();
    if (store == null) {
      return;
    }
    const thread = await store.getThread(change.threadId);
    if (thread == null) {
      return;
    }
    if (thread.status.outdated) {
      return;
    }
    const now = new Date().toISOString();
    await store.saveThread({
      ...thread,
      status: { ...thread.status, outdated: true },
      metadata: { ...thread.metadata, updatedAt: now },
    });
    this.tasksProvider.refresh();
  }

  private async onDocumentSaved(document: vscode.TextDocument): Promise<void> {
    if (document.uri.scheme !== 'file') {
      return;
    }
    const store = await this.resolveStore();
    if (store == null) {
      return;
    }
    const filePath = vscode.workspace.asRelativePath(document.uri);
    const liveLines = this.tracker.getAllLiveLines(filePath);
    if (liveLines.size === 0) {
      return;
    }

    const threads = await store.listThreads();
    const now = new Date().toISOString();
    const updates: ReviewThread[] = [];

    for (const thread of threads) {
      if (thread.anchor.filePath !== filePath || thread.anchor.type !== 'file') {
        continue;
      }
      const liveLine = liveLines.get(thread.id);
      if (liveLine == null || liveLine === thread.anchor.line) {
        continue;
      }
      const anchor = { ...thread.anchor, line: liveLine };
      const result = checkAnchor(document, anchor);
      const outdated = result.state === 'outdated' || result.state === 'orphaned';
      updates.push({
        ...thread,
        anchor,
        status: { ...thread.status, outdated },
        metadata: { ...thread.metadata, updatedAt: now },
      });
    }

    if (updates.length > 0) {
      for (const thread of updates) {
        await store.saveThread(thread);
      }
      this.tasksProvider.refresh();
    }
  }

  private async resolveStore(): Promise<ThreadStore | null> {
    const identity = await resolveWorkspaceIdentity();
    if (identity == null) {
      return null;
    }
    return new ThreadStore(identity);
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
