import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { TaskStore } from '../storage/task-store';
import { ThreadStore } from '../storage/thread-store';
import { resolveWorkspaceIdentity } from '../storage/workspace-identity';
import { buildAnchor } from '../anchoring/anchor-capture';
import { generateThreadName } from '../ai/thread-namer';
import type { CodeAnchor, Task, TaskHistoryEvent, TaskMessage, TaskStatus } from '../generated';
import type { TasksViewProvider } from '../views/tasks-view';

type Stores = {
  taskStore: TaskStore;
  threadStore: ThreadStore;
};

export class FixMyCommentsController implements vscode.Disposable {
  private readonly controller: vscode.CommentController;
  private readonly threadsByTaskId = new Map<string, vscode.CommentThread>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly tasksProvider: TasksViewProvider,
  ) {
    this.controller = vscode.comments.createCommentController('fixMyComments', 'Fix My Comments');
    this.controller.commentingRangeProvider = {
      provideCommentingRanges(document: vscode.TextDocument): vscode.Range[] {
        return [new vscode.Range(0, 0, document.lineCount - 1, 0)];
      },
    };
    this.controller.options = {
      prompt: 'Add a comment',
      placeHolder: 'What needs attention here? (Enter to submit, Shift+Enter for a new line)',
    };
  }

  openThread(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor == null || editor.selection.isEmpty) {
      void vscode.window.showWarningMessage('Select code in the editor to add a comment.');
      return;
    }
    void this.openWidgetAtSelection(editor);
  }

  private async openWidgetAtSelection(editor: vscode.TextEditor): Promise<void> {
    const { document, selection } = editor;
    await vscode.window.showTextDocument(document, {
      preserveFocus: false,
      selection,
      viewColumn: editor.viewColumn ?? vscode.ViewColumn.Active,
    });
    await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
    await vscode.commands.executeCommand('workbench.action.addComment');
  }

  async revealThread(task: Task): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (folder == null) {
      return;
    }

    const uri = vscode.Uri.joinPath(folder.uri, task.anchor.filePath);
    const document = await vscode.workspace.openTextDocument(uri);
    const range = anchorRange(task.anchor);
    await vscode.window.showTextDocument(document, {
      selection: range,
      preserveFocus: false,
    });

    const stores = await this.resolveStores();
    const messages = stores != null ? await stores.threadStore.listMessages(task.id) : [];

    const stale = this.threadsByTaskId.get(task.id);
    if (stale != null) {
      stale.dispose();
      this.threadsByTaskId.delete(task.id);
    }

    const thread = this.controller.createCommentThread(
      uri,
      range,
      messages.map((message) => toComment(message)),
    );
    thread.contextValue = task.id;
    thread.label = threadLabel(task);
    thread.canReply = true;
    thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
    this.threadsByTaskId.set(task.id, thread);

    await vscode.commands.executeCommand('workbench.action.focusCommentsPanel');
  }

  async submitComment(reply?: vscode.CommentReply): Promise<void> {
    if (reply == null) {
      await vscode.commands.executeCommand('editor.action.submitComment');
      return;
    }

    const { thread, text } = reply;
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      thread.dispose();
      return;
    }

    const stores = await this.resolveStores();
    if (stores == null) {
      void vscode.window.showErrorMessage('Open a folder to use Fix My Comments.');
      thread.dispose();
      return;
    }

    const existingId = thread.contextValue;
    if (existingId != null && existingId.length > 0) {
      await this.appendReply(stores, existingId, thread, trimmed);
    } else {
      await this.createTask(stores, thread, trimmed);
    }

    thread.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;
    this.tasksProvider.refresh();
    await vscode.commands.executeCommand('workbench.action.focusCommentsPanel');
  }

  async setStatus(target: unknown, status: TaskStatus): Promise<void> {
    const taskId = taskIdFromTarget(target);
    if (taskId == null) {
      return;
    }

    const stores = await this.resolveStores();
    if (stores == null) {
      return;
    }

    const tasks = await stores.taskStore.listTasks();
    const task = tasks.find((t) => t.id === taskId);
    if (task == null) {
      return;
    }

    const now = new Date().toISOString();
    const updated: Task = { ...task, status, updatedAt: now };
    await stores.taskStore.saveTask(updated);

    const seq = await stores.threadStore.nextHistorySeq(taskId);
    await stores.threadStore.appendHistory(historyEvent(taskId, seq, `status_${status}`, now));

    const thread = this.threadsByTaskId.get(taskId);
    if (thread != null) {
      thread.label = threadLabel(updated);
    }

    this.tasksProvider.refresh();
  }

  private async createTask(
    stores: Stores,
    thread: vscode.CommentThread,
    text: string,
  ): Promise<void> {
    const document = vscode.workspace.textDocuments.find(
      (doc) => doc.uri.toString() === thread.uri.toString(),
    );
    const range = thread.range ?? new vscode.Range(0, 0, 0, 0);
    const anchor = document != null ? buildAnchor(document, range) : fallbackAnchor(thread, range);

    const now = new Date().toISOString();
    const taskId = `task_${randomUUID()}`;
    const message = buildMessage(taskId, null, 1, 'user', 'You', text, now);
    const title = generateThreadName(anchor.selectedText, text);

    const fileName = anchor.filePath.split('/').pop() ?? anchor.filePath;
    const task: Task = {
      id: taskId,
      schemaVersion: 1,
      title,
      description: text,
      scope: 'selection',
      status: 'open',
      createdBy: 'user',
      createdAt: now,
      updatedAt: now,
      anchor,
      labels: [],
      threadHead: message.id,
      threadTail: message.id,
      messageCount: 1,
    };

    await stores.taskStore.saveTask(task);
    await stores.threadStore.appendMessage(message);
    await stores.threadStore.appendHistory(historyEvent(taskId, 1, 'created', now));

    thread.contextValue = taskId;
    thread.label = `${title} · ${fileName}:${anchor.startLine + 1}`;
    thread.comments = [toComment(message)];
    this.threadsByTaskId.set(taskId, thread);
  }

  private async appendReply(
    stores: Stores,
    taskId: string,
    thread: vscode.CommentThread,
    text: string,
  ): Promise<void> {
    const tasks = await stores.taskStore.listTasks();
    const task = tasks.find((t) => t.id === taskId);
    const now = new Date().toISOString();
    const seq = await stores.threadStore.nextMessageSeq(taskId);
    const parentId = task != null && task.threadTail.length > 0 ? task.threadTail : null;
    const message = buildMessage(taskId, parentId, seq, 'user', 'You', text, now);

    await stores.threadStore.appendMessage(message);

    if (task != null) {
      await stores.taskStore.saveTask({
        ...task,
        threadTail: message.id,
        messageCount: task.messageCount + 1,
        updatedAt: now,
      });
    }

    const messages = await stores.threadStore.listMessages(taskId);
    thread.comments = messages.map((m) => toComment(m));
    this.threadsByTaskId.set(taskId, thread);
  }

  private async resolveStores(): Promise<Stores | null> {
    const identity = await resolveWorkspaceIdentity();
    if (identity == null) {
      return null;
    }
    return {
      taskStore: new TaskStore(this.context.globalStorageUri, identity),
      threadStore: new ThreadStore(this.context.globalStorageUri, identity),
    };
  }

  dispose(): void {
    for (const thread of this.threadsByTaskId.values()) {
      thread.dispose();
    }
    this.threadsByTaskId.clear();
    this.controller.dispose();
  }
}

function toComment(message: TaskMessage): vscode.Comment {
  return {
    author: { name: message.author },
    body: new vscode.MarkdownString(message.content),
    mode: vscode.CommentMode.Preview,
  };
}

function buildMessage(
  taskId: string,
  parentId: string | null,
  seq: number,
  authorType: TaskMessage['authorType'],
  author: string,
  content: string,
  timestamp: string,
): TaskMessage {
  return {
    id: `msg_${randomUUID()}`,
    taskId,
    parentId,
    seq,
    authorType,
    author,
    content,
    timestamp,
  };
}

function historyEvent(
  taskId: string,
  seq: number,
  type: string,
  timestamp: string,
): TaskHistoryEvent {
  return {
    id: `evt_${randomUUID()}`,
    taskId,
    seq,
    type,
    actor: 'You',
    timestamp,
  };
}

function threadLabel(task: Task): string {
  const fileName = task.anchor.filePath.split('/').pop() ?? task.anchor.filePath;
  const location = `${fileName}:${task.anchor.startLine + 1}`;
  return task.status === 'open'
    ? `${task.title} · ${location}`
    : `${task.title} · ${location} [${task.status}]`;
}

function anchorRange(anchor: CodeAnchor): vscode.Range {
  return new vscode.Range(
    anchor.startLine,
    anchor.startCharacter,
    anchor.endLine,
    anchor.endCharacter,
  );
}

function fallbackAnchor(thread: vscode.CommentThread, range: vscode.Range): CodeAnchor {
  return {
    filePath: vscode.workspace.asRelativePath(thread.uri),
    startLine: range.start.line,
    endLine: range.end.line,
    startCharacter: range.start.character,
    endCharacter: range.end.character,
    selectedText: '',
    textHash: null,
    beforeContext: null,
    afterContext: null,
  };
}

function taskIdFromTarget(target: unknown): string | null {
  if (typeof target !== 'object' || target === null) {
    return null;
  }
  if ('task' in target) {
    const task = target.task;
    if (typeof task === 'object' && task !== null && 'id' in task && typeof task.id === 'string') {
      return task.id;
    }
  }
  if ('contextValue' in target && typeof target.contextValue === 'string') {
    return target.contextValue;
  }
  return null;
}
