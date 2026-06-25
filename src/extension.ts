import * as vscode from 'vscode';
import { FixMyCommentsController } from './comments/comment-controller';
import { AnchorEngine } from './anchoring/anchor-engine';
import { AnchorTracker } from './anchoring/anchor-tracker';
import { GutterDecorator } from './decorations/gutter-decorator';
import { TasksViewProvider } from './views/tasks-view';
import { resolveWorkspaceIdentity, STORAGE_ROOT } from './storage/workspace-identity';
import type { ReviewThread } from './generated';

export function activate(context: vscode.ExtensionContext): void {
  const tasksProvider = new TasksViewProvider(context);
  const tasksView = vscode.window.registerTreeDataProvider('fixMyComments.tasks', tasksProvider);

  const tracker = new AnchorTracker();
  const engine = new AnchorEngine(context, tracker, tasksProvider);

  const gutterDecorator = new GutterDecorator(context, tracker);
  const gutterSync = tasksProvider.onDidChangeTreeData(() => gutterDecorator.refresh());

  const fmcController = new FixMyCommentsController(context, tasksProvider);

  const createTask = vscode.commands.registerCommand('fixMyComments.createTask', () =>
    fmcController.openThread(),
  );

  const submitComment = vscode.commands.registerCommand(
    'fixMyComments.submitComment',
    (reply?: vscode.CommentReply) => fmcController.submitComment(reply),
  );

  const openThread = vscode.commands.registerCommand(
    'fixMyComments.openThread',
    (thread: ReviewThread) => fmcController.revealThread(thread),
  );

  const toggleResolved = vscode.commands.registerCommand(
    'fixMyComments.toggleResolved',
    (target: unknown) => fmcController.toggleResolved(target),
  );

  const react = vscode.commands.registerCommand('fixMyComments.react', (target: unknown) =>
    fmcController.pickReaction(target),
  );

  const setCommentMode = vscode.commands.registerCommand(
    'fixMyComments.setCommentMode',
    (target?: unknown) => fmcController.setCommentMode(target),
  );

  const addTaskMessage = vscode.commands.registerCommand(
    'fixMyComments.addTaskMessage',
    (target?: unknown) => fmcController.addTaskMessage(target),
  );

  const addSuggestionMessage = vscode.commands.registerCommand(
    'fixMyComments.addSuggestionMessage',
    (target?: unknown) => fmcController.addSuggestionMessage(target),
  );

  const cycleDraftMode = vscode.commands.registerCommand(
    'fixMyComments.cycleDraftMode',
    (target?: unknown) => fmcController.cycleDraftMode(target),
  );

  const toggleTaskMessage = vscode.commands.registerCommand(
    'fixMyComments.toggleTaskMessage',
    (target: unknown) => fmcController.toggleTaskMessage(target),
  );

  const chooseReaction = vscode.commands.registerCommand(
    'fixMyComments.chooseReaction',
    (messageId: string, emoji: string) => fmcController.chooseReaction(messageId, emoji),
  );

  const resetThread = vscode.commands.registerCommand(
    'fixMyComments.resetThread',
    (target: unknown) => fmcController.resetThread(target),
  );

  const cancelInlineHelper = vscode.commands.registerCommand(
    'fixMyComments.cancelInlineHelper',
    () => fmcController.cancelInlineHelper(),
  );

  const storageWatcher = setupStorageWatcher(fmcController, tasksProvider);

  context.subscriptions.push(
    createTask,
    submitComment,
    openThread,
    toggleResolved,
    react,
    setCommentMode,
    addTaskMessage,
    addSuggestionMessage,
    cycleDraftMode,
    toggleTaskMessage,
    chooseReaction,
    resetThread,
    cancelInlineHelper,
    tasksView,
    tasksProvider,
    fmcController,
    tracker,
    engine,
    gutterDecorator,
    gutterSync,
    storageWatcher,
  );
}

function setupStorageWatcher(
  fmcController: FixMyCommentsController,
  tasksProvider: TasksViewProvider,
): vscode.Disposable {
  // Storage lives under ~/.fixmycomments (home root), not in the workspace, so
  // the watcher must be anchored to the home storage root via an absolute path.
  const pattern = new vscode.RelativePattern(
    vscode.Uri.file(STORAGE_ROOT),
    '**/{threads,messages}.json',
  );
  const watcher = vscode.workspace.createFileSystemWatcher(pattern);

  const refresh = () => {
    void resolveWorkspaceIdentity().then((identity) => {
      if (identity == null) {
        return;
      }
      // Rebuild native threads from disk — this is what makes AI-written replies
      // (via the MCP server) and reloads surface live in the editor.
      void fmcController.rebuildAllThreads();
      tasksProvider.refresh();
    });
  };

  watcher.onDidChange(refresh);
  watcher.onDidCreate(refresh);

  return watcher;
}

export function deactivate(): void {}
