// ═══════════════════════════════════════════════════════════════
// Civic Social — Secure Logger with Redaction
// ═══════════════════════════════════════════════════════════════
//
// Never log secrets, tokens, passwords, or PII in production.
// All API route logging should use this module.
// ═══════════════════════════════════════════════════════════════

const REDACT_PATTERNS: [RegExp, string][] = [
  [/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]'],
  [/api[-_]?key[=:]\s*["']?[^"'\s&]+/gi, 'api_key=[REDACTED]'],
  [/token[=:]\s*["']?[^"'\s&]+/gi, 'token=[REDACTED]'],
  [/password[=:]\s*["']?[^"'\s&]+/gi, 'password=[REDACTED]'],
  [/secret[=:]\s*["']?[^"'\s&]+/gi, 'secret=[REDACTED]'],
  [/authorization[=:]\s*["']?[^"'\s&]+/gi, 'authorization=[REDACTED]'],
  [/session[-_]?id[=:]\s*["']?[^"'\s&]+/gi, 'session_id=[REDACTED]'],
  // Redact emails to first 2 chars + domain
  [/([a-zA-Z0-9._%+-]{2})[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+)/g, '$1***@$2'],
  // Redact JWTs (three base64 segments separated by dots)
  [/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[JWT_REDACTED]'],
];

function redact(message: string): string {
  let result = message;
  for (const [pattern, replacement] of REDACT_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (arg instanceof Error) {
        // In production, only log error message and name, not stack
        if (process.env.NODE_ENV === 'production') {
          return `${arg.name}: ${redact(arg.message)}`;
        }
        return redact(arg.stack || arg.message);
      }
      if (typeof arg === 'string') {
        return redact(arg);
      }
      try {
        return redact(JSON.stringify(arg));
      } catch {
        return '[Unserializable]';
      }
    })
    .join(' ');
}

const isProduction = process.env.NODE_ENV === 'production';

export const secureLog = {
  info(context: string, ...args: unknown[]) {
    console.log(`[${context}]`, formatArgs(args));
  },

  warn(context: string, ...args: unknown[]) {
    console.warn(`[${context}]`, formatArgs(args));
  },

  error(context: string, ...args: unknown[]) {
    console.error(`[${context}]`, formatArgs(args));
  },

  /** Log only in development */
  debug(context: string, ...args: unknown[]) {
    if (!isProduction) {
      console.log(`[DEBUG:${context}]`, formatArgs(args));
    }
  },

  /** Audit log for admin/moderation actions */
  audit(action: string, userId: string, details: Record<string, unknown>) {
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      userId: redact(userId),
      ...details,
    };
    // In production, send to a dedicated audit log service
    console.log(`[AUDIT]`, JSON.stringify(entry));
  },
};
