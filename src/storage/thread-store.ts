import * as vscode from 'vscode';
import { decodeThreadFile, decodeReviewMessageFile } from '../generated';
import type {
  ReviewMessage,
  ReviewThread,
  ThreadFile,
  ReviewMessageFile,
  WorkspaceIdentity,
} from '../generated';

const EMPTY_THREADS: ThreadFile = { schemaVersion: 1, threads: [] };
const EMPTY_MESSAGES: ReviewMessageFile = { schemaVersion: 1, messages: [] };

/**
 * Backing store for the Bitbucket-style review model: a lightweight
 * {@link ReviewThread} record (anchor + resolve/outdated state) and an
 * append-only {@link ReviewMessage} log. Threads and messages live in
 * separate files but share the same per-repo+branch storage directory.
 *
 * Threads are keyed by id; messages are filtered by threadId and kept in
 * `seq`-free chronological order — the array order is the thread order, and
 * appending a reply pushes one record instead of rewriting the thread.
 */
export class ThreadStore {
  constructor(private readonly identity: WorkspaceIdentity) {}

  // ── Threads ──────────────────────────────────────────────────────────────

  async listThreads(): Promise<ReviewThread[]> {
    return (await this.readThreads()).threads;
  }

  async getThread(id: string): Promise<ReviewThread | null> {
    const threads = await this.listThreads();
    return threads.find((t) => t.id === id) ?? null;
  }

  async saveThread(thread: ReviewThread): Promise<void> {
    const data = await this.readThreads();
    const index = data.threads.findIndex((existing) => existing.id === thread.id);
    if (index >= 0) {
      data.threads[index] = thread;
    } else {
      data.threads.push(thread);
    }
    await this.writeThreads(data);
  }

  async deleteThread(id: string): Promise<void> {
    const data = await this.readThreads();
    data.threads = data.threads.filter((thread) => thread.id !== id);
    await this.writeThreads(data);
  }

  // ── Messages ────────────────────────────────────────────────────────────

  async listMessages(threadId: string): Promise<ReviewMessage[]> {
    const data = await this.readMessages();
    return data.messages
      .filter((m) => m.threadId === threadId)
      .sort((a, b) => a.metadata.createdAt.localeCompare(b.metadata.createdAt));
  }

  async appendMessage(message: ReviewMessage): Promise<void> {
    const data = await this.readMessages();
    data.messages.push(message);
    await this.writeMessages(data);
  }

  async saveMessage(message: ReviewMessage): Promise<void> {
    const data = await this.readMessages();
    const index = data.messages.findIndex((existing) => existing.id === message.id);
    if (index >= 0) {
      data.messages[index] = message;
    } else {
      data.messages.push(message);
    }
    await this.writeMessages(data);
  }

  async deleteMessages(threadId: string): Promise<void> {
    const data = await this.readMessages();
    data.messages = data.messages.filter((message) => message.threadId !== threadId);
    await this.writeMessages(data);
  }

  // ── Storage plumbing ────────────────────────────────────────────────────

  private get directory(): vscode.Uri {
    return vscode.Uri.file(this.identity.storagePath);
  }

  private get threadsUri(): vscode.Uri {
    return vscode.Uri.joinPath(this.directory, 'threads.json');
  }

  private get messagesUri(): vscode.Uri {
    return vscode.Uri.joinPath(this.directory, 'messages.json');
  }

  private async readThreads(): Promise<ThreadFile> {
    try {
      const bytes = await vscode.workspace.fs.readFile(this.threadsUri);
      const parsed: unknown = JSON.parse(Buffer.from(bytes).toString('utf8'));
      return decodeThreadFile(parsed) ?? EMPTY_THREADS;
    } catch {
      return EMPTY_THREADS;
    }
  }

  private async writeThreads(data: ThreadFile): Promise<void> {
    await vscode.workspace.fs.createDirectory(this.directory);
    await vscode.workspace.fs.writeFile(
      this.threadsUri,
      Buffer.from(JSON.stringify(data, null, 2), 'utf8'),
    );
  }

  private async readMessages(): Promise<ReviewMessageFile> {
    try {
      const bytes = await vscode.workspace.fs.readFile(this.messagesUri);
      const parsed: unknown = JSON.parse(Buffer.from(bytes).toString('utf8'));
      return decodeReviewMessageFile(parsed) ?? EMPTY_MESSAGES;
    } catch {
      return EMPTY_MESSAGES;
    }
  }

  private async writeMessages(data: ReviewMessageFile): Promise<void> {
    await vscode.workspace.fs.createDirectory(this.directory);
    await vscode.workspace.fs.writeFile(
      this.messagesUri,
      Buffer.from(JSON.stringify(data, null, 2), 'utf8'),
    );
  }
}
