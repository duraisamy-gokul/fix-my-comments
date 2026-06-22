import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { TaskStore } from '../storage/task-store';
import { resolveWorkspaceIdentity } from '../storage/workspace-identity';
import { buildAnchor } from '../anchoring/anchor-capture';
import type { CodeAnchor, Task } from '../generated';
import type { TasksViewProvider } from '../views/tasks-view';

export class FixMyCommentsController implements vscode.Disposable {
  private readonly controller: vscode.CommentController;

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

    const identity = await resolveWorkspaceIdentity();
    if (identity == null) {
      void vscode.window.showErrorMessage('Open a folder to use Fix My Comments.');
      thread.dispose();
      return;
    }

    const store = new TaskStore(this.context.globalStorageUri, identity);
    const existingId = thread.contextValue;

    if (existingId != null && existingId.length > 0) {
      const tasks = await store.listTasks();
      const task = tasks.find((t) => t.id === existingId);
      if (task != null) {
        await store.saveTask({ ...task, updatedAt: new Date().toISOString() });
      }
    } else {
      const document = vscode.workspace.textDocuments.find(
        (doc) => doc.uri.toString() === thread.uri.toString(),
      );
      const task = buildTask(trimmed, thread, document);
      await store.saveTask(task);
      thread.contextValue = task.id;
    }

    thread.comments = [...thread.comments, previewComment(trimmed)];
    thread.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;
    this.tasksProvider.refresh();

    await vscode.commands.executeCommand('workbench.action.focusCommentsPanel');
  }

  dispose(): void {
    this.controller.dispose();
  }
}

function previewComment(body: string): vscode.Comment {
  return {
    author: { name: 'You' },
    body: new vscode.MarkdownString(body),
    mode: vscode.CommentMode.Preview,
  };
}

function buildTask(
  comment: string,
  thread: vscode.CommentThread,
  document: vscode.TextDocument | undefined,
): Task {
  const range = thread.range ?? new vscode.Range(0, 0, 0, 0);
  const filePath = vscode.workspace.asRelativePath(thread.uri);
  const fileName = filePath.split('/').pop() ?? filePath;
  const startLine = range.start.line + 1;
  const selectedText = document != null ? document.getText(range).trim() : '';
  const snippet = selectedText.length > 40 ? `${selectedText.slice(0, 40)}...` : selectedText;
  const now = new Date().toISOString();

  const anchor: CodeAnchor =
    document != null
      ? buildAnchor(document, range)
      : {
          filePath,
          startLine: range.start.line,
          endLine: range.end.line,
          startCharacter: range.start.character,
          endCharacter: range.end.character,
          selectedText: '',
          textHash: null,
          beforeContext: null,
          afterContext: null,
        };

  return {
    id: `task_${randomUUID()}`,
    schemaVersion: 1,
    title: `${fileName}:${startLine} ${snippet}`,
    description: comment,
    scope: 'selection',
    status: 'open',
    createdBy: 'user',
    createdAt: now,
    updatedAt: now,
    anchor,
    labels: [],
    threadHead: '',
    threadTail: '',
    messageCount: 0,
  };
}
