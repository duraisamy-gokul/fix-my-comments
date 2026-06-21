import * as vscode from 'vscode';
import { FixMyCommentsController } from './comments/comment-controller';
import { TasksViewProvider } from './views/tasks-view';

export function activate(context: vscode.ExtensionContext): void {
  const tasksProvider = new TasksViewProvider(context);
  const tasksView = vscode.window.registerTreeDataProvider('fixMyComments.tasks', tasksProvider);

  const fmcController = new FixMyCommentsController(context, tasksProvider);

  const comment = vscode.commands.registerCommand('fixMyComments.createTask', () =>
    fmcController.openThread(),
  );

  const submitComment = vscode.commands.registerCommand(
    'fixMyComments.submitComment',
    (reply?: vscode.CommentReply) => fmcController.submitComment(reply),
  );

  context.subscriptions.push(comment, submitComment, tasksView, tasksProvider, fmcController);
}

export function deactivate(): void {}
