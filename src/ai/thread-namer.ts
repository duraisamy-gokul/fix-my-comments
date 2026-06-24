const MAX_NAME_LENGTH = 60;
const MAX_WORDS = 8;

/**
 * Generate a short thread name from the first user message. Comments are now
 * attached to a single line (no selected code), so the name comes from the
 * comment text alone.
 */
export function generateThreadName(firstMessage: string): string {
  const firstLine = firstMessage
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (firstLine == null) {
    return 'Untitled task';
  }

  const condensed = firstLine.replace(/\s+/g, ' ').replace(/[.;:,]+$/, '');
  const words = condensed.split(' ').slice(0, MAX_WORDS).join(' ');
  const clipped =
    words.length > MAX_NAME_LENGTH ? `${words.slice(0, MAX_NAME_LENGTH).trim()}…` : words;

  return capitalize(clipped);
}

function capitalize(value: string): string {
  if (value.length === 0) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}
