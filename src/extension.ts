import * as vscode from 'vscode';
import { FixMyCommentsController } from './comments/comment-controller';
import { AnchorEngine } from './anchoring/anchor-engine';
import { AnchorTracker } from './anchoring/anchor-tracker';
import { GutterDecorator } from './decorations/gutter-decorator';
import { TasksViewProvider } from './views/tasks-view';
import { resolveWorkspaceIdentity, STORAGE_ROOT } from './storage/workspace-identity';
import type { Task } from './generated';

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

  const openTask = vscode.commands.registerCommand('fixMyComments.openTask', (task: Task) =>
    fmcController.revealThread(task),
  );

  const resolveTask = vscode.commands.registerCommand(
    'fixMyComments.resolveTask',
    (target: unknown) => fmcController.setStatus(target, 'resolved'),
  );

  const reopenTask = vscode.commands.registerCommand(
    'fixMyComments.reopenTask',
    (target: unknown) => fmcController.setStatus(target, 'open'),
  );

  const blockTask = vscode.commands.registerCommand('fixMyComments.blockTask', (target: unknown) =>
    fmcController.setStatus(target, 'blocked'),
  );

  const storageWatcher = setupStorageWatcher(tasksProvider);

  context.subscriptions.push(
    createTask,
    submitComment,
    openTask,
    resolveTask,
    reopenTask,
    blockTask,
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

function setupStorageWatcher(tasksProvider: TasksViewProvider): vscode.Disposable {
  // Storage lives under ~/.fixmycomments (home root), not in the workspace, so
  // the watcher must be anchored to the home storage root via an absolute path.
  const pattern = new vscode.RelativePattern(
    vscode.Uri.file(STORAGE_ROOT),
    '**/{tasks,messages,executions}.json',
  );
  const watcher = vscode.workspace.createFileSystemWatcher(pattern);

  const refresh = () => {
    void resolveWorkspaceIdentity().then((identity) => {
      if (identity != null) {
        tasksProvider.refresh();
      }
    });
  };

  watcher.onDidChange(refresh);
  watcher.onDidCreate(refresh);

  return watcher;
}

export function deactivate(): void {}
