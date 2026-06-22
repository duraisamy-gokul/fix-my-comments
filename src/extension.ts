import * as vscode from 'vscode';
import { FixMyCommentsController } from './comments/comment-controller';
import { CommentCodeLensProvider } from './comments/comment-lens';
import { GutterDecorator } from './decorations/gutter-decorator';
import { TasksViewProvider } from './views/tasks-view';
import type { Task } from './generated';

export function activate(context: vscode.ExtensionContext): void {
  const tasksProvider = new TasksViewProvider(context);
  const tasksView = vscode.window.registerTreeDataProvider('fixMyComments.tasks', tasksProvider);

  const gutterDecorator = new GutterDecorator(context);
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

  const openTask = vscode.commands.registerCommand('fixMyComments.openTask', (task: Task) => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (folder == null) {
      return;
    }
    const uri = vscode.Uri.joinPath(folder.uri, task.anchor.filePath);
    const range = new vscode.Range(
      task.anchor.startLine,
      task.anchor.startCharacter,
      task.anchor.endLine,
      task.anchor.endCharacter,
    );
    return vscode.window.showTextDocument(uri, { selection: range });
  });

  context.subscriptions.push(
    createTask,
    submitComment,
    openTask,
    tasksView,
    tasksProvider,
    fmcController,
    gutterDecorator,
    gutterSync,
    codeLensProvider,
    codeLens,
  );
}

export function deactivate(): void {}
