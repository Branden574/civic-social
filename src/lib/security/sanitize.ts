// ═══════════════════════════════════════════════════════════════
// Civic Social — Input Sanitization
// ═══════════════════════════════════════════════════════════════
//
// Defence-in-depth: strip dangerous patterns from user input
// BEFORE storage. React already escapes on render, but stored
// XSS can still bite via email digests, RSS, API consumers, etc.
// ═══════════════════════════════════════════════════════════════

/**
 * Strip HTML tags and dangerous patterns from user-generated text.
 * Keeps the text content, removes all markup.
 */
export function sanitizeText(input: string): string {
  if (typeof input !== 'string') return '';

  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove javascript: and data: URIs
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    .replace(/vbscript\s*:/gi, '')
    // Remove on* event handlers (even without tags, in case of attribute injection)
    .replace(/\bon\w+\s*=/gi, '')
    // Normalize whitespace (collapse multiple spaces, trim)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitize a display name: strip tags, limit length, block special chars.
 */
export function sanitizeDisplayName(input: string): string {
  if (typeof input !== 'string') return '';

  const cleaned = sanitizeText(input);
  // Allow letters, numbers, spaces, hyphens, periods, apostrophes
  const safe = cleaned.replace(/[^\p{L}\p{N}\s.\-']/gu, '').trim();
  return safe.slice(0, 50);
}

/**
 * Sanitize a username: lowercase alphanumeric + dots + hyphens + underscores.
 */
export function sanitizeUsername(input: string): string {
  if (typeof input !== 'string') return '';

  return input
    .toLowerCase()
    .replace(/[^a-z0-9._\-]/g, '')
    .slice(0, 30);
}

/**
 * Sanitize a hashtag/topic slug: lowercase, allow only a-z 0-9 _ -, max 50 chars.
 */
export function sanitizeHashtag(input: string): string {
  if (typeof input !== 'string') return '';

  return input
    .toLowerCase()
    .replace(/[^a-z0-9_\-]/g, '')
    .slice(0, 50);
}

/**
 * Validate and sanitize a URL. Returns null if invalid or dangerous.
 */
export function sanitizeUrl(input: string): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);

    // Only allow http and https
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    // Block private/internal IPs (SSRF prevention)
    const hostname = url.hostname.toLowerCase();
    if (isInternalHost(hostname)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Check if a hostname resolves to an internal/private network (SSRF prevention).
 */
function isInternalHost(hostname: string): boolean {
  // Block localhost variants
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local')
  ) {
    return true;
  }

  // Block private IP ranges
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^169\.254\./, // Link-local
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGN
    /^fc/i, // IPv6 ULA
    /^fe80/i, // IPv6 link-local
  ];

  return privateRanges.some((r) => r.test(hostname));
}

/**
 * Sanitize topics array: strip tags, limit count and length.
 */
export function sanitizeTopics(topics: unknown): string[] {
  if (!Array.isArray(topics)) return [];

  return topics
    .filter((t): t is string => typeof t === 'string')
    .map((t) => sanitizeText(t).slice(0, 50))
    .filter((t) => t.length > 0)
    .slice(0, 10);
}

/**
 * Clamp a numeric parameter to a safe range.
 */
export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(min, Math.min(max, Math.floor(value)));
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      return Math.max(min, Math.min(max, parsed));
    }
  }
  return fallback;
}

/**
 * Validate an ID string: alphanumeric + hyphens, max 64 chars.
 */
export function isValidId(input: unknown): input is string {
  if (typeof input !== 'string') return false;
  return /^[a-zA-Z0-9_\-]{1,64}$/.test(input);
}

/**
 * Validate email format (basic RFC 5322 subset).
 */
export function isValidEmail(input: string): boolean {
  if (typeof input !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input) && input.length <= 254;
}
