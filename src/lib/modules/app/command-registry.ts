import * as vscode from 'vscode';
import type { ReviewThread } from '../../../generated';
import type { FixMyCommentsController } from '../comments';

export class CommandRegistry implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly controller: FixMyCommentsController) {}

  register(): void {
    this.disposables.push(
      vscode.commands.registerCommand('fixMyComments.createTask', () =>
        this.controller.openThread(),
      ),
      vscode.commands.registerCommand(
        'fixMyComments.submitComment',
        (reply?: vscode.CommentReply) => this.controller.submitComment(reply),
      ),
      vscode.commands.registerCommand('fixMyComments.openThread', (thread: ReviewThread) =>
        this.controller.revealThread(thread),
      ),
      vscode.commands.registerCommand('fixMyComments.toggleResolved', (target: unknown) =>
        this.controller.toggleResolved(target),
      ),
      vscode.commands.registerCommand('fixMyComments.react', (target: unknown) =>
        this.controller.pickReaction(target),
      ),
      vscode.commands.registerCommand('fixMyComments.setCommentMode', (target?: unknown) =>
        this.controller.setCommentMode(target),
      ),
      vscode.commands.registerCommand('fixMyComments.addTaskMessage', (target?: unknown) =>
        this.controller.addTaskMessage(target),
      ),
      vscode.commands.registerCommand('fixMyComments.addSuggestionMessage', (target?: unknown) =>
        this.controller.addSuggestionMessage(target),
      ),
      vscode.commands.registerCommand('fixMyComments.cycleDraftMode', (target?: unknown) =>
        this.controller.cycleDraftMode(target),
      ),
      vscode.commands.registerCommand('fixMyComments.toggleTaskMessage', (target: unknown) =>
        this.controller.toggleTaskMessage(target),
      ),
      vscode.commands.registerCommand(
        'fixMyComments.chooseReaction',
        (messageId: string, emoji: string) => this.controller.chooseReaction(messageId, emoji),
      ),
      vscode.commands.registerCommand('fixMyComments.resetThread', (target: unknown) =>
        this.controller.resetThread(target),
      ),
      vscode.commands.registerCommand('fixMyComments.cancelInlineHelper', () =>
        this.controller.cancelInlineHelper(),
      ),
    );
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }
}
