import * as vscode from 'vscode';
import { decodeMessageFile, decodeHistoryFile } from '../generated';
import type {
  HistoryFile,
  MessageFile,
  TaskHistoryEvent,
  TaskMessage,
  WorkspaceIdentity,
} from '../generated';

const EMPTY_MESSAGES: MessageFile = { schemaVersion: 1, messages: [] };
const EMPTY_HISTORY: HistoryFile = { schemaVersion: 1, events: [] };

export class ThreadStore {
  constructor(
    private readonly globalStorageUri: vscode.Uri,
    private readonly identity: WorkspaceIdentity,
  ) {}

  async listMessages(taskId: string): Promise<TaskMessage[]> {
    const data = await this.readMessages();
    return data.messages.filter((m) => m.taskId === taskId).sort((a, b) => a.seq - b.seq);
  }

  async appendMessage(message: TaskMessage): Promise<void> {
    const data = await this.readMessages();
    data.messages.push(message);
    await this.writeMessages(data);
  }

  async nextMessageSeq(taskId: string): Promise<number> {
    const messages = await this.listMessages(taskId);
    return messages.reduce((max, m) => Math.max(max, m.seq), 0) + 1;
  }

  async listHistory(taskId: string): Promise<TaskHistoryEvent[]> {
    const data = await this.readHistory();
    return data.events.filter((e) => e.taskId === taskId).sort((a, b) => a.seq - b.seq);
  }

  async appendHistory(event: TaskHistoryEvent): Promise<void> {
    const data = await this.readHistory();
    data.events.push(event);
    await this.writeHistory(data);
  }

  async nextHistorySeq(taskId: string): Promise<number> {
    const events = await this.listHistory(taskId);
    return events.reduce((max, e) => Math.max(max, e.seq), 0) + 1;
  }

  private get directory(): vscode.Uri {
    return vscode.Uri.joinPath(this.globalStorageUri, this.identity.key);
  }

  private get messagesUri(): vscode.Uri {
    return vscode.Uri.joinPath(this.directory, 'messages.json');
  }

  private get historyUri(): vscode.Uri {
    return vscode.Uri.joinPath(this.directory, 'history.json');
  }

  private async readMessages(): Promise<MessageFile> {
    try {
      const bytes = await vscode.workspace.fs.readFile(this.messagesUri);
      const parsed: unknown = JSON.parse(Buffer.from(bytes).toString('utf8'));
      return decodeMessageFile(parsed) ?? EMPTY_MESSAGES;
    } catch {
      return EMPTY_MESSAGES;
    }
  }

  private async writeMessages(data: MessageFile): Promise<void> {
    await vscode.workspace.fs.createDirectory(this.directory);
    await vscode.workspace.fs.writeFile(
      this.messagesUri,
      Buffer.from(JSON.stringify(data, null, 2), 'utf8'),
    );
  }

  private async readHistory(): Promise<HistoryFile> {
    try {
      const bytes = await vscode.workspace.fs.readFile(this.historyUri);
      const parsed: unknown = JSON.parse(Buffer.from(bytes).toString('utf8'));
      return decodeHistoryFile(parsed) ?? EMPTY_HISTORY;
    } catch {
      return EMPTY_HISTORY;
    }
  }

  private async writeHistory(data: HistoryFile): Promise<void> {
    await vscode.workspace.fs.createDirectory(this.directory);
    await vscode.workspace.fs.writeFile(
      this.historyUri,
      Buffer.from(JSON.stringify(data, null, 2), 'utf8'),
    );
  }
}
