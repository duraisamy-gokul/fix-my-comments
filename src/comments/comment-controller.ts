import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { ThreadStore } from '../storage/thread-store';
import { resolveWorkspaceIdentity } from '../storage/workspace-identity';
import { buildAnchor } from '../storage/git-info';
import type { Author, ReviewMessage, ReviewThread } from '../generated';
import type { TasksViewProvider } from '../views/tasks-view';

type DraftMode = { type: 'task' } | { type: 'suggestion'; originalCode: string };

/**
 * Bitbucket-style native comment threads.
 *
 * - One thread per anchored line. Threads own resolve (native checkbox via
 *   `CommentThreadState`) and an outdated flag (line hash mismatch).
 * - Messages are flat (no nested replies): comment, task (checkbox), or
 *   suggestion. Reactions are an emoji→authorIds map, surfaced through the
 *   native `CommentReaction` API + `reactionHandler`.
 * - Threads are rebuilt from storage on activation and whenever the storage
 *   files change (e.g. an AI agent writes via the MCP server), so comments
 *   survive a VS Code reload and appear live.
 */
export class FixMyCommentsController implements vscode.Disposable {
  private readonly controller: vscode.CommentController;
  private readonly threadsById = new Map<string, vscode.CommentThread>();
  private readonly draftModesByThreadId = new Map<string, DraftMode>();
  private readonly helperCommentsByThreadId = new Map<string, vscode.Comment>();
  private readonly activeSuggestionHighlights = new Map<string, vscode.TextEditorDecorationType>();
  private readonly disposables: vscode.Disposable[] = [];

  /** Emoji palette offered by the reaction picker. */
  private static readonly REACTIONS = ['👍', '👎', '🎉', '❤️', '🚀', '👀'];

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
      placeHolder: 'Comment · Enter to submit · Shift+Enter for a new line',
    };

    // Rebuild all threads from storage at startup so comments survive a reload.
    void this.rebuildAllThreads();
  }

  /** Rebuild every thread for the current workspace from disk. */
  async rebuildAllThreads(): Promise<void> {
    const store = await this.resolveStore();
    if (store == null) {
      return;
    }
    const threads = await store.listThreads();

    // Dispose threads whose backing record is gone.
    const liveIds = new Set(threads.map((t) => t.id));
    for (const [id, thread] of this.threadsById) {
      if (!liveIds.has(id)) {
        thread.dispose();
        this.threadsById.delete(id);
      }
    }

    for (const thread of threads) {
      await this.upsertThread(thread, store);
    }
    this.tasksProvider.refresh();
  }

  /** Create or refresh a single native thread from a stored record. */
  private async upsertThread(thread: ReviewThread, store: ThreadStore): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (folder == null) {
      return;
    }
    const uri = vscode.Uri.joinPath(folder.uri, thread.anchor.filePath);
    const line = thread.anchor.line ?? 0;
    const range = new vscode.Range(line, 0, line, 0);

    const messages = await store.listMessages(thread.id);
    const comments = messages.map((m) => this.toComment(m));

    let native: vscode.CommentThread | null = this.threadsById.get(thread.id) ?? null;
    // `uri` is read-only on a CommentThread, so if the file path changed (rare)
    // we dispose and recreate rather than reassign.
    if (native != null && native.uri.toString() !== uri.toString()) {
      native.dispose();
      this.threadsById.delete(thread.id);
      native = null;
    }

    if (native == null) {
      native = this.controller.createCommentThread(uri, range, comments);
      native.contextValue = `thread:${thread.id}`;
      this.threadsById.set(thread.id, native);
    } else {
      native.range = range;
      native.comments = comments;
    }
    native.canReply = !thread.status.resolved;
    native.label = threadLabel(thread);
    native.state = thread.status.resolved
      ? vscode.CommentThreadState.Resolved
      : vscode.CommentThreadState.Unresolved;
  }

  /** Open a comment box on the current line — no selection required. */
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

    const store = await this.resolveStore();
    if (store == null) {
      return;
    }
    const threads = await store.listThreads();
    const existing = threads.find((t) => t.anchor.filePath === filePath && t.anchor.line === line);
    if (existing != null) {
      await this.upsertThread(existing, store);
      const native = this.threadsById.get(existing.id);
      if (native != null) {
        native.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
      }
      await this.focusThread(native ?? null);
    } else {
      const created = await this.createEmptyThread(store, document, line);
      await this.upsertThread(created, store);
      const native = this.threadsById.get(created.id);
      if (native != null) {
        native.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
      }
      await this.focusThread(native ?? null);
    }
  }

  async revealThread(thread: ReviewThread): Promise<void> {
    const store = await this.resolveStore();
    if (store == null) {
      return;
    }
    await this.upsertThread(thread, store);
    const native = this.threadsById.get(thread.id);
    if (native == null) {
      return;
    }
    native.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;

    const document = await vscode.workspace.openTextDocument(native.uri);
    const editor = await vscode.window.showTextDocument(document, { preserveFocus: false });
    const line = native.range != null ? native.range.start.line : 0;
    editor.selection = new vscode.Selection(line, 0, line, 0);
    editor.revealRange(new vscode.Range(line, 0, line, 0), vscode.TextEditorRevealType.InCenter);
    await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
    await vscode.commands.executeCommand('workbench.action.focusCommentOnCurrentLine');
  }

  private async focusThread(thread: vscode.CommentThread | null): Promise<void> {
    if (thread == null) {
      return;
    }
    const editor = await vscode.window.showTextDocument(thread.uri, { preserveFocus: false });
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

    const store = await this.resolveStore();
    if (store == null) {
      void vscode.window.showErrorMessage('Open a folder to use Fix My Comments.');
      thread.dispose();
      return;
    }

    const threadId = thread.contextValue != null ? stripContextPrefix(thread.contextValue) : null;
    if (threadId != null && threadId.length > 0) {
      const backing = await store.getThread(threadId);
      if (backing != null && backing.status.resolved) {
        void vscode.window.showWarningMessage(
          'This thread is resolved. Reopen it before adding a reply.',
        );
        thread.dispose();
        return;
      }
      const mode = this.draftModesByThreadId.get(threadId) ?? null;
      if (mode != null) {
        await this.appendDraftModeMessage(threadId, mode, trimmed);
        this.draftModesByThreadId.delete(threadId);
        this.helperCommentsByThreadId.delete(threadId);
        this.clearSuggestionHighlight(threadId);
      } else {
        this.helperCommentsByThreadId.delete(threadId);
        await this.appendReply(store, threadId, thread, trimmed);
      }
    } else {
      await this.createThread(store, thread, trimmed);
    }

    thread.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;
    this.tasksProvider.refresh();
  }

  /** Toggle a thread's resolved checkbox (native thread state). */
  async toggleResolved(target: unknown): Promise<void> {
    const threadId = threadIdFromTarget(target);
    if (threadId == null) {
      return;
    }
    const store = await this.resolveStore();
    if (store == null) {
      return;
    }
    const thread = await store.getThread(threadId);
    if (thread == null) {
      return;
    }
    const now = new Date().toISOString();
    const resolved = !thread.status.resolved;
    await store.saveThread({
      ...thread,
      status: {
        ...thread.status,
        resolved,
        resolvedBy: resolved ? 'You' : null,
        resolvedAt: resolved ? now : null,
      },
      metadata: { ...thread.metadata, updatedAt: now },
    });
    await this.upsertThread((await store.getThread(threadId)) ?? thread, store);
    this.tasksProvider.refresh();
  }

  /** Show an inline emoji picker helper in the same thread. */
  async pickReaction(target: unknown): Promise<void> {
    const messageId = messageIdFromTarget(target);
    if (messageId == null) {
      return;
    }
    const store = await this.resolveStore();
    if (store == null) {
      return;
    }
    const located = await this.findMessage(store, messageId);
    if (located == null) {
      return;
    }
    const links = FixMyCommentsController.REACTIONS.map((emoji) => {
      const args = encodeURIComponent(JSON.stringify([messageId, emoji]));
      return `[${emoji}](command:fixMyComments.chooseReaction?${args})`;
    }).join('  ');
    this.showInlineHelper(located.ownerThread.id, `💬 **React to this comment**\n\n${links}`);
  }

  async chooseReaction(messageId: string, emoji: string): Promise<void> {
    await this.toggleReactionOnMessage(messageId, emoji);
    const store = await this.resolveStore();
    if (store == null) {
      return;
    }
    const located = await this.findMessage(store, messageId);
    if (located != null) {
      this.helperCommentsByThreadId.delete(located.ownerThread.id);
      await this.upsertThread(located.ownerThread, store);
    }
  }

  /** Add an emoji reaction (or remove the author's existing one) on a message. */
  async toggleReactionOnMessage(messageId: string, emoji: string): Promise<void> {
    const store = await this.resolveStore();
    if (store == null) {
      return;
    }
    const located = await this.findMessage(store, messageId);
    if (located == null) {
      return;
    }
    const { ownerThread, message } = located;
    const authorId = 'You';
    const reactions = { ...message.reactions };
    const reactors = new Set(reactions[emoji] ?? []);
    if (reactors.has(authorId)) {
      reactors.delete(authorId);
    } else {
      reactors.add(authorId);
    }
    const next = [...reactors];
    if (next.length > 0) {
      reactions[emoji] = next;
    } else {
      delete reactions[emoji];
    }
    const now = new Date().toISOString();
    await store.saveMessage({
      ...message,
      reactions,
      metadata: { ...message.metadata, updatedAt: now },
    });
    await this.upsertThread(ownerThread, store);
  }

  /**
   * Native reaction handler:
   * - clicking an existing emoji toggles that emoji
   * - clicking VS Code's add-reaction (+/smiley) opens our inline emoji helper
   */
  private async toggleReaction(
    comment: vscode.Comment,
    reaction: vscode.CommentReaction,
  ): Promise<void> {
    const messageId = messageIdFromTarget(comment);
    if (messageId == null) {
      return;
    }
    if (FixMyCommentsController.REACTIONS.includes(reaction.label)) {
      await this.toggleReactionOnMessage(messageId, reaction.label);
      return;
    }
    await this.pickReaction(comment);
  }

  async setCommentMode(target: unknown): Promise<void> {
    const threadId = this.resolveThreadId(target);
    if (threadId == null) {
      return;
    }
    this.draftModesByThreadId.delete(threadId);
    this.clearSuggestionHighlight(threadId);
    await this.focusThreadForDraft(threadId, normalCommentHelper());
  }

  async addTaskMessage(target: unknown): Promise<void> {
    const threadId = this.resolveThreadId(target);
    if (threadId == null) {
      return;
    }
    this.draftModesByThreadId.set(threadId, { type: 'task' });
    this.clearSuggestionHighlight(threadId);
    await this.focusThreadForDraft(threadId, taskHelper());
  }

  async addSuggestionMessage(target: unknown): Promise<void> {
    const threadId = this.resolveThreadId(target);
    if (threadId == null) {
      return;
    }
    await this.setSuggestionMode(threadId);
  }

  async cycleDraftMode(target: unknown): Promise<void> {
    const threadId = this.resolveThreadId(target);
    if (threadId == null) {
      return;
    }
    const mode = this.draftModesByThreadId.get(threadId) ?? null;
    if (mode == null) {
      await this.setSuggestionMode(threadId);
      return;
    }
    if (mode.type === 'suggestion') {
      this.draftModesByThreadId.set(threadId, { type: 'task' });
      this.clearSuggestionHighlight(threadId);
      await this.focusThreadForDraft(threadId, taskHelper());
      return;
    }
    this.draftModesByThreadId.delete(threadId);
    await this.focusThreadForDraft(threadId, normalCommentHelper());
  }

  private async setSuggestionMode(threadId: string): Promise<void> {
    const originalCode = await this.originalCodeForThread(threadId);
    this.draftModesByThreadId.set(threadId, { type: 'suggestion', originalCode });
    await this.focusThreadForDraft(threadId, suggestionHelper(originalCode));
    await this.highlightThreadLine(threadId);
    await this.prefillCommentInput(originalCode);
  }

  async toggleTaskMessage(target: unknown): Promise<void> {
    const messageId = messageIdFromTarget(target);
    if (messageId == null) {
      return;
    }
    const store = await this.resolveStore();
    if (store == null) {
      return;
    }
    const located = await this.findMessage(store, messageId);
    if (located == null || located.message.task == null) {
      return;
    }
    const now = new Date().toISOString();
    const completed = !located.message.task.completed;
    await store.saveMessage({
      ...located.message,
      task: {
        ...located.message.task,
        completed,
        completedBy: completed ? 'You' : null,
        completedAt: completed ? now : null,
      },
      metadata: { ...located.message.metadata, updatedAt: now },
    });
    await this.upsertThread(located.ownerThread, store);
  }

  async resetThread(target: unknown): Promise<void> {
    const threadId = threadIdFromTarget(target);
    if (threadId == null) {
      return;
    }
    const store = await this.resolveStore();
    if (store == null) {
      return;
    }
    const oldThread = await store.getThread(threadId);
    const native = this.threadsById.get(threadId) ?? null;
    await store.deleteMessages(threadId);
    await store.deleteThread(threadId);
    this.draftModesByThreadId.delete(threadId);
    this.helperCommentsByThreadId.delete(threadId);
    this.clearSuggestionHighlight(threadId);
    if (native != null) {
      const uri = native.uri;
      const line = native.range?.start.line ?? oldThread?.anchor.line ?? 0;
      native.dispose();
      this.threadsById.delete(threadId);
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document, { preserveFocus: false });
      editor.selection = new vscode.Selection(line, 0, line, 0);
      await vscode.commands.executeCommand('workbench.action.addComment');
    }
    this.tasksProvider.refresh();
  }

  async cancelInlineHelper(): Promise<void> {
    const store = await this.resolveStore();
    if (store == null) {
      return;
    }
    const threadIds = new Set([
      ...this.draftModesByThreadId.keys(),
      ...this.helperCommentsByThreadId.keys(),
    ]);
    this.draftModesByThreadId.clear();
    this.helperCommentsByThreadId.clear();
    for (const threadId of threadIds) {
      const thread = await store.getThread(threadId);
      this.clearSuggestionHighlight(threadId);
      if (thread != null) {
        await this.upsertThread(thread, store);
      }
      const native = this.threadsById.get(threadId) ?? null;
      if (native != null) {
        native.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;
      }
    }
  }

  private resolveThreadId(target: unknown): string | null {
    const fromTarget = threadIdFromTarget(target);
    if (fromTarget != null) {
      return fromTarget;
    }
    const editor = vscode.window.activeTextEditor;
    if (editor == null) {
      return null;
    }
    const activeLine = editor.selection.active.line;
    for (const [threadId, thread] of this.threadsById) {
      if (
        thread.uri.toString() === editor.document.uri.toString() &&
        thread.range?.start.line === activeLine
      ) {
        return threadId;
      }
    }
    return null;
  }

  private async focusThreadForDraft(threadId: string, message: string): Promise<void> {
    this.showInlineHelper(threadId, message);
    const native = this.threadsById.get(threadId) ?? null;
    if (native != null) {
      native.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
      await this.focusThread(native);
    }
  }

  private async prefillCommentInput(text: string): Promise<void> {
    if (text.length === 0) {
      return;
    }
    await vscode.env.clipboard.writeText(text);
    await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
  }

  private async highlightThreadLine(threadId: string): Promise<void> {
    const native = this.threadsById.get(threadId) ?? null;
    if (native == null) {
      return;
    }
    const line = native.range?.start.line ?? 0;
    const editor = vscode.window.visibleTextEditors.find(
      (visibleEditor) => visibleEditor.document.uri.toString() === native.uri.toString(),
    );
    if (editor == null) {
      return;
    }
    const decoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
      isWholeLine: true,
    });
    this.clearSuggestionHighlight(threadId);
    this.activeSuggestionHighlights.set(threadId, decoration);
    editor.setDecorations(decoration, [new vscode.Range(line, 0, line, 0)]);
  }

  private clearSuggestionHighlight(threadId: string): void {
    const decoration = this.activeSuggestionHighlights.get(threadId) ?? null;
    if (decoration == null) {
      return;
    }
    decoration.dispose();
    this.activeSuggestionHighlights.delete(threadId);
  }

  private async originalCodeForThread(threadId: string): Promise<string> {
    const store = await this.resolveStore();
    const thread = store != null ? await store.getThread(threadId) : null;
    if (thread == null) {
      return '';
    }
    const native = this.threadsById.get(threadId) ?? null;
    if (native != null) {
      try {
        const document = await vscode.workspace.openTextDocument(native.uri);
        const line = thread.anchor.line ?? native.range?.start.line ?? 0;
        if (line >= 0 && line < document.lineCount) {
          return document.lineAt(line).text;
        }
      } catch {
        // Fall back to the stored snippet below.
      }
    }
    return thread.anchor.snippet ?? '';
  }

  private showInlineHelper(threadId: string, markdown: string): void {
    const native = this.threadsById.get(threadId) ?? null;
    if (native == null) {
      return;
    }
    const body = new vscode.MarkdownString(markdown, true);
    body.isTrusted = true;
    const helper: vscode.Comment = {
      author: { name: ' ' },
      body,
      mode: vscode.CommentMode.Preview,
      contextValue: `helper:${threadId}`,
    };
    this.helperCommentsByThreadId.set(threadId, helper);
    native.comments = [
      ...native.comments.filter((c) => c.contextValue !== `helper:${threadId}`),
      helper,
    ];
    native.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
  }

  private async appendDraftModeMessage(
    threadId: string,
    mode: DraftMode,
    text: string,
  ): Promise<void> {
    if (mode.type === 'task') {
      await this.appendTypedMessage(threadId, {
        type: 'task',
        markdown: text,
        suggestion: null,
        task: { completed: false, completedBy: null, completedAt: null },
      });
      return;
    }
    await this.appendTypedMessage(threadId, {
      type: 'suggestion',
      markdown: 'Suggested change',
      suggestion: {
        originalCode: mode.originalCode,
        suggestedCode: text,
        applied: false,
        appliedBy: null,
        appliedAt: null,
      },
      task: null,
    });
  }

  private async createEmptyThread(
    store: ThreadStore,
    document: vscode.TextDocument,
    line: number,
  ): Promise<ReviewThread> {
    const now = new Date().toISOString();
    const thread: ReviewThread = {
      id: `thread_${randomUUID()}`,
      anchor: buildAnchor(document, line),
      status: { resolved: false, outdated: false, resolvedBy: null, resolvedAt: null },
      metadata: { createdAt: now, updatedAt: now },
    };
    await store.saveThread(thread);
    return thread;
  }

  private async createThread(
    store: ThreadStore,
    thread: vscode.CommentThread,
    text: string,
  ): Promise<void> {
    const document = vscode.workspace.textDocuments.find(
      (doc) => doc.uri.toString() === thread.uri.toString(),
    );
    const line = thread.range != null ? thread.range.start.line : 0;
    const anchor =
      document != null ? buildAnchor(document, line) : fallbackAnchor(thread.uri, line);

    const now = new Date().toISOString();
    const threadId = `thread_${randomUUID()}`;
    const messageId = `msg_${randomUUID()}`;
    const author = currentUser();
    const message: ReviewMessage = {
      id: messageId,
      threadId,
      author,
      type: 'comment',
      content: { markdown: text },
      suggestion: null,
      task: null,
      reactions: {},
      metadata: { createdAt: now, updatedAt: now, editedAt: null },
    };

    const reviewThread: ReviewThread = {
      id: threadId,
      anchor,
      status: { resolved: false, outdated: false, resolvedBy: null, resolvedAt: null },
      metadata: { createdAt: now, updatedAt: now },
    };

    await store.saveThread(reviewThread);
    await store.appendMessage(message);

    thread.contextValue = `thread:${threadId}`;
    thread.label = threadLabel(reviewThread);
    thread.state = vscode.CommentThreadState.Unresolved;
    thread.comments = [this.toComment(message)];
    this.threadsById.set(threadId, thread);
  }

  private async appendReply(
    store: ThreadStore,
    threadId: string,
    thread: vscode.CommentThread,
    text: string,
  ): Promise<void> {
    await this.appendTypedMessage(threadId, {
      type: 'comment',
      markdown: text,
      suggestion: null,
      task: null,
    });
    const messages = await store.listMessages(threadId);
    thread.comments = messages.map((m) => this.toComment(m));
    this.threadsById.set(threadId, thread);
  }

  private async appendTypedMessage(
    threadId: string,
    input: {
      type: ReviewMessage['type'];
      markdown: string;
      suggestion: ReviewMessage['suggestion'];
      task: ReviewMessage['task'];
    },
  ): Promise<void> {
    const store = await this.resolveStore();
    if (store == null) {
      return;
    }
    const backing = await store.getThread(threadId);
    if (backing == null) {
      return;
    }
    if (backing.status.resolved) {
      void vscode.window.showWarningMessage(
        'This thread is resolved. Reopen it before adding messages.',
      );
      return;
    }
    const now = new Date().toISOString();
    const message: ReviewMessage = {
      id: `msg_${randomUUID()}`,
      threadId,
      author: currentUser(),
      type: input.type,
      content: { markdown: input.markdown },
      suggestion: input.suggestion,
      task: input.task,
      reactions: {},
      metadata: { createdAt: now, updatedAt: now, editedAt: null },
    };
    await store.appendMessage(message);
    await store.saveThread({
      ...backing,
      metadata: { ...backing.metadata, updatedAt: now },
    });
    await this.upsertThread(
      { ...backing, metadata: { ...backing.metadata, updatedAt: now } },
      store,
    );
  }

  private async findMessage(
    store: ThreadStore,
    messageId: string,
  ): Promise<{ ownerThread: ReviewThread; message: ReviewMessage } | null> {
    const threads = await store.listThreads();
    for (const thread of threads) {
      const messages = await store.listMessages(thread.id);
      const message = messages.find((m) => m.id === messageId);
      if (message != null) {
        return { ownerThread: thread, message };
      }
    }
    return null;
  }

  /** Map a stored message to a native VS Code Comment, including reactions. */
  private toComment(message: ReviewMessage): vscode.Comment {
    const label =
      message.author.type === 'ai'
        ? '🤖'
        : message.type === 'task'
          ? message.task?.completed
            ? '✅'
            : '☐'
          : null;
    const comment: vscode.Comment = {
      author: { name: message.author.name },
      body: renderMessageBody(message),
      mode: vscode.CommentMode.Preview,
      contextValue: `${message.type}:${message.id}`,
      timestamp: new Date(message.metadata.createdAt),
    };
    if (label != null) {
      comment.label = label;
    }
    return comment;
  }

  private async resolveStore(): Promise<ThreadStore | null> {
    const identity = await resolveWorkspaceIdentity();
    if (identity == null) {
      return null;
    }
    return new ThreadStore(identity);
  }

  dispose(): void {
    for (const thread of this.threadsById.values()) {
      thread.dispose();
    }
    this.threadsById.clear();
    for (const decoration of this.activeSuggestionHighlights.values()) {
      decoration.dispose();
    }
    this.activeSuggestionHighlights.clear();
    this.controller.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

function currentUser(): Author {
  return { type: 'user', id: 'You', name: 'You' };
}

function threadLabel(thread: ReviewThread): string {
  const fileName = thread.anchor.filePath.split('/').pop() ?? thread.anchor.filePath;
  const line = thread.anchor.line != null ? `:${thread.anchor.line + 1}` : '';
  const tags: string[] = [];
  if (thread.status.resolved) {
    tags.push('resolved');
  }
  if (thread.status.outdated) {
    tags.push('outdated');
  }
  return tags.length > 0 ? `${fileName}${line} [${tags.join(', ')}]` : `${fileName}${line}`;
}

function fallbackAnchor(uri: vscode.Uri, line: number): ReviewThread['anchor'] {
  return {
    type: 'line',
    filePath: vscode.workspace.asRelativePath(uri),
    line,
    lineHash: '',
    snippet: null,
  };
}

function normalCommentHelper(): string {
  return '💬 **Normal comment**\n\nUse this for a regular discussion note. Enter your message below, then press Enter or click 💬 Add Comment.';
}

function taskHelper(): string {
  return '📝 **Task**\n\nUse this for a checkbox item someone should complete. Enter the task text below, then press Enter or click 💬 Add Comment.';
}

function suggestionHelper(originalCode: string): string {
  const suffix = originalCode.length > 0 ? `\n\n\`\`\`\n${escapeFence(originalCode)}\n\`\`\`` : '';
  return `💡 **Suggestion**\n\nUse this to propose replacement code. Edit the highlighted current line below, then press Enter or click 💬 Add Comment.${suffix}`;
}

function renderMessageBody(message: ReviewMessage): vscode.MarkdownString {
  const body = new vscode.MarkdownString('', true);
  body.isTrusted = true;
  body.supportThemeIcons = true;
  if (message.task != null) {
    body.appendMarkdown(
      `${message.task.completed ? '- [x]' : '- [ ]'} ${message.content.markdown}`,
    );
    appendInlineReactionBar(body, message);
    return body;
  }
  body.appendMarkdown(message.content.markdown);
  if (message.suggestion != null) {
    body.appendMarkdown('\n\n**Original**\n');
    body.appendCodeblock(message.suggestion.originalCode, '');
    body.appendMarkdown('\n**Suggested**\n');
    body.appendCodeblock(message.suggestion.suggestedCode, '');
  }
  appendInlineReactionBar(body, message);
  return body;
}

function escapeFence(value: string): string {
  return value.replace(/```/g, '``\\`');
}

function appendInlineReactionBar(body: vscode.MarkdownString, message: ReviewMessage): void {
  const links: string[] = [];
  for (const [emoji, authors] of Object.entries(message.reactions)) {
    if (authors.length === 0) {
      continue;
    }
    const args = encodeURIComponent(JSON.stringify([message.id, emoji]));
    links.push(
      `[${emoji}${authors.length > 1 ? ` ${authors.length}` : ''}](command:fixMyComments.chooseReaction?${args})`,
    );
  }
  const addArgs = encodeURIComponent(JSON.stringify([`${message.type}:${message.id}`]));
  links.push(`[$(smiley)](command:fixMyComments.react?${addArgs} "Add reaction")`);
  body.appendMarkdown(`\n\n${links.join('  ')}`);
}

function threadIdFromTarget(target: unknown): string | null {
  if (typeof target !== 'object' || target === null) {
    return null;
  }
  if ('thread' in target) {
    const thread = target.thread;
    if (
      typeof thread === 'object' &&
      thread !== null &&
      'contextValue' in thread &&
      typeof thread.contextValue === 'string'
    ) {
      return stripContextPrefix(thread.contextValue);
    }
  }
  if ('contextValue' in target && typeof target.contextValue === 'string') {
    return stripContextPrefix(target.contextValue);
  }
  if ('id' in target && typeof target.id === 'string') {
    return target.id;
  }
  return null;
}

function messageIdFromTarget(target: unknown): string | null {
  if (typeof target === 'string') {
    return stripContextPrefix(target);
  }
  if (typeof target !== 'object' || target === null) {
    return null;
  }
  if ('contextValue' in target && typeof target.contextValue === 'string') {
    return stripContextPrefix(target.contextValue);
  }
  if ('id' in target && typeof target.id === 'string') {
    return target.id;
  }
  return null;
}

function stripContextPrefix(contextValue: string): string {
  const index = contextValue.indexOf(':');
  if (index === -1) {
    return contextValue;
  }
  return contextValue.slice(index + 1);
}
