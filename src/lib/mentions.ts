// ═══════════════════════════════════════════════════════════════
// @mention parsing and rendering utilities
// ═══════════════════════════════════════════════════════════════

/**
 * Regex to match @username mentions in post content.
 * Usernames: alphanumeric, dots, hyphens, underscores (2-30 chars).
 * Matches @username at start of string or after whitespace.
 */
const MENTION_PATTERN = /(^|[\s.,!?()])@([a-zA-Z0-9._-]{2,30})/g;

/**
 * Extract all @mentions from text content.
 */
export function extractMentions(text: string): string[] {
  const usernames = new Set<string>();
  let match;
  const regex = new RegExp(MENTION_PATTERN.source, 'g');
  while ((match = regex.exec(text)) !== null) {
    usernames.add(match[2].toLowerCase());
  }
  return Array.from(usernames);
}

/**
 * Split text into segments: plain text and @mentions.
 * Used for rendering mentions as clickable links.
 */
export interface TextSegment {
  type: 'text' | 'mention';
  value: string; // for 'mention', this is the username (without @)
}

export function parseContentWithMentions(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;

  const regex = new RegExp(MENTION_PATTERN.source, 'g');
  let match;

  while ((match = regex.exec(text)) !== null) {
    const prefix = match[1]; // whitespace/punctuation before @
    const username = match[2];
    const mentionStart = match.index;

    // Add text before this mention (including the prefix char)
    const textBeforeMention = text.slice(lastIndex, mentionStart + prefix.length);
    if (textBeforeMention) {
      segments.push({ type: 'text', value: textBeforeMention });
    }

    segments.push({ type: 'mention', value: username });
    lastIndex = mentionStart + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments;
}
