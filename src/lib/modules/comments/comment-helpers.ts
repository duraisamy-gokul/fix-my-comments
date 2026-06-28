export function normalCommentHelper(): string {
  return '💬 **Normal comment**\n\nUse this for a regular discussion note. Enter your message below, then press Enter or click 💬 Add Comment.';
}

export function taskHelper(): string {
  return '📝 **Task**\n\nUse this for a checkbox item someone should complete. Enter the task text below, then press Enter or click 💬 Add Comment.';
}

export function suggestionHelper(originalCode: string): string {
  const suffix = originalCode.length > 0 ? `\n\n\`\`\`\n${escapeFence(originalCode)}\n\`\`\`` : '';
  return `💡 **Suggestion**\n\nUse this to propose replacement code. Edit the highlighted current line below, then press Enter or click 💬 Add Comment.${suffix}`;
}

function escapeFence(value: string): string {
  return value.replace(/```/g, '``\\`');
}
