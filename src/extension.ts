import * as vscode from 'vscode';
import { FixMyCommentsController } from './comments/comment-controller';
import { CommentCodeLensProvider } from './comments/comment-lens';
import { AnchorEngine } from './anchoring/anchor-engine';
import { AnchorTracker } from './anchoring/anchor-tracker';
import { GutterDecorator } from './decorations/gutter-decorator';
import { TasksViewProvider } from './views/tasks-view';
import type { Task } from './generated';

export function activate(context: vscode.ExtensionContext): void {
  const tasksProvider = new TasksViewProvider(context);
  const tasksView = vscode.window.registerTreeDataProvider('fixMyComments.tasks', tasksProvider);

  const tracker = new AnchorTracker();
  const engine = new AnchorEngine(context, tracker, tasksProvider);

  const gutterDecorator = new GutterDecorator(context, tracker);
  const gutterSync = tasksProvider.onDidChangeTreeData(() => gutterDecorator.refresh());

  const codeLensProvider = new CommentCodeLensProvider();
  const codeLens = vscode.languages.registerCodeLensProvider({ scheme: 'file' }, codeLensProvider);

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
    codeLensProvider,
    codeLens,
  );
}

export function deactivate(): void {}
