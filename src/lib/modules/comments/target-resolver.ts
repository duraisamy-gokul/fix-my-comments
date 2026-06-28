export function threadIdFromTarget(target: unknown): string | null {
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

export function messageIdFromTarget(target: unknown): string | null {
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

export function stripContextPrefix(contextValue: string): string {
  const index = contextValue.indexOf(':');
  if (index === -1) {
    return contextValue;
  }
  return contextValue.slice(index + 1);
}
