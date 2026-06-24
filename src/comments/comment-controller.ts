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
      placeHolder:
        'What needs attention on this line? (Enter to submit, Shift+Enter for a new line)',
    };
  }

  /**
   * Open a comment box on the current line — no selection required, Bitbucket
   * style. If the line already has a thread, focus its reply input instead of
   * opening a new one.
   */
  openThread(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor == null) {
      void vscode.window.showWarningMessage('Open a file to add a comment.');
      return;
    }
    void this.openOrFocusAtLine(editor, editor.selection.active.line);
  }

  private async openOrFocusAtLine(editor: vscode.TextEditor, line: number): Promise<void> {
    const { document } = editor;
    const filePath = vscode.workspace.asRelativePath(document.uri);
    const range = new vscode.Range(line, 0, line, 0);
    await vscode.window.showTextDocument(document, {
      preserveFocus: false,
      selection: range,
      viewColumn: editor.viewColumn ?? vscode.ViewColumn.Active,
    });
    await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');

    // If a thread already exists on this line, focus its reply input; otherwise
    // open a new comment box.
    const existing = await this.findTaskOnLine(filePath, line);
    if (existing != null) {
      await this.revealThread(existing);
    } else {
      await vscode.commands.executeCommand('workbench.action.addComment');
    }
  }

  private async findTaskOnLine(filePath: string, line: number): Promise<Task | null> {
    const stores = await this.resolveStores();
    if (stores == null) {
      return null;
    }
    const tasks = await stores.taskStore.listTasks();
    return tasks.find((t) => t.anchor.filePath === filePath && t.anchor.line === line) ?? null;
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

    // Reuse the live thread if it already exists for this task; only create a
    // new one when there isn't one. Recreating on every reopen throws away the
    // widget's reply input state.
    let thread = this.threadsByTaskId.get(task.id);
    if (thread == null) {
      thread = this.controller.createCommentThread(
        uri,
        range,
        messages.map((message) => toComment(message)),
      );
      thread.contextValue = task.id;
      thread.canReply = true;
      this.threadsByTaskId.set(task.id, thread);
    }
    thread.label = threadLabel(task);
    thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;

    await this.focusThreadReply(thread);
  }

  /**
   * Reveal an existing inline comment thread and focus it on reopen.
   *
   * VS Code has no public API to auto-focus an inline thread's *reply input*,
   * so on reopen we focus the thread itself: position the cursor on the
   * thread's line, then run `workbench.action.focusCommentOnCurrentLine` which
   * reveals and focuses that thread (precondition: activeCursorHasComment).
   * The user then clicks Reply to focus the reply editor (a native click
   * focuses it — only programmatic reply-focus is unsupported).
   */
  private async focusThreadReply(thread: vscode.CommentThread): Promise<void> {
    const editor = await vscode.window.showTextDocument(thread.uri, { preserveFocus: false });
    // Put the cursor exactly on the thread's line so focusCommentOnCurrentLine
    // (precondition: activeCursorHasComment) targets THIS thread.
    const line = thread.range != null ? thread.range.start.line : 0;
    editor.selection = new vscode.Selection(line, 0, line, 0);
    editor.revealRange(new vscode.Range(line, 0, line, 0), vscode.TextEditorRevealType.InCenter);
    await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
    await vscode.commands.executeCommand('workbench.action.focusCommentOnCurrentLine');
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
    const line = thread.range != null ? thread.range.start.line : 0;
    const anchor: CodeAnchor =
      document != null ? buildAnchor(document, line) : fallbackAnchor(thread.uri, line);

    const now = new Date().toISOString();
    const taskId = `task_${randomUUID()}`;
    const message = buildMessage(taskId, null, 1, 'user', 'You', text, now);
    const title = generateThreadName(text);

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
    thread.label = `${title} · ${fileName}:${anchor.line + 1}`;
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
      taskStore: new TaskStore(identity),
      threadStore: new ThreadStore(identity),
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
    messageType: 'comment',
    suggestionCode: '',
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
  const location = `${fileName}:${task.anchor.line + 1}`;
  return task.status === 'open'
    ? `${task.title} · ${location}`
    : `${task.title} · ${location} [${task.status}]`;
}

function anchorRange(anchor: CodeAnchor): vscode.Range {
  return new vscode.Range(anchor.line, 0, anchor.line, 0);
}

function fallbackAnchor(uri: vscode.Uri, line: number): CodeAnchor {
  return {
    filePath: vscode.workspace.asRelativePath(uri),
    line,
    lineHash: '',
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
