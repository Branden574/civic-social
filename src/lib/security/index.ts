// ═══════════════════════════════════════════════════════════════
// Civic Social — Security Module Barrel Export
// ═══════════════════════════════════════════════════════════════

export {
  sanitizeText,
  sanitizeDisplayName,
  sanitizeUsername,
  sanitizeUrl,
  sanitizeTopics,
  clampInt,
  isValidId,
  isValidEmail,
} from './sanitize';

export {
  globalLimiter,
  authLimiter,
  postLimiter,
  chatLimiter,
  socialLimiter,
  debateLimiter,
  readLimiter,
  signupLimiter,
  passwordResetLimiter,
  createRateLimiter,
} from './rate-limiter';

export { secureLog } from './logger';

export {
  generateCsrfToken,
  setCsrfCookie,
  validateCsrf,
} from './csrf';

export {
  getSessionUser,
  requireAuth,
  requireAdmin,
  requireCreator,
  getClientIp,
  rateLimitHeaders,
  tooManyRequests,
  internalError,
  badRequest,
} from './api-guard';
