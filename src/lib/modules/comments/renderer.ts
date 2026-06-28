import * as vscode from 'vscode';
import type { ReviewMessage, ReviewThread } from '../../../generated';

export function threadLabel(thread: ReviewThread): string {
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

export function toComment(message: ReviewMessage): vscode.Comment {
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
