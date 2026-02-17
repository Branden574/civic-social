// ═══════════════════════════════════════════════════════════════
// Civic Social — Password Security
// ═══════════════════════════════════════════════════════════════
//
// Strong password policy enforced on both client and server.
// Production should additionally:
//   - Hash with bcrypt/argon2 (requires Node.js native module)
//   - Check against HaveIBeenPwned k-Anonymity API
// ═══════════════════════════════════════════════════════════════

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'strong' | 'very-strong';
}

const MIN_LENGTH = 10;
const MAX_LENGTH = 128;

// Common passwords that should be rejected (top 100 subset)
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789',
  '1234567890', 'qwerty', 'qwerty123', 'abc123', 'monkey', 'master',
  'dragon', 'login', 'princess', 'football', 'shadow', 'sunshine',
  'trustno1', 'iloveyou', 'batman', 'access', 'hello', 'charlie',
  'donald', 'password1!', 'qwerty1', 'p@ssw0rd', 'p@ssword',
  'letmein', 'welcome', 'admin', 'admin123', 'root', 'toor',
]);

/**
 * Validate a password against the security policy.
 */
export function validatePassword(password: string, email?: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required.'], strength: 'weak' };
  }

  // Length checks
  if (password.length < MIN_LENGTH) {
    errors.push(`Password must be at least ${MIN_LENGTH} characters.`);
  }
  if (password.length > MAX_LENGTH) {
    errors.push(`Password must be at most ${MAX_LENGTH} characters.`);
  }

  // Complexity checks
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  if (!hasUppercase) errors.push('Include at least one uppercase letter.');
  if (!hasLowercase) errors.push('Include at least one lowercase letter.');
  if (!hasDigit) errors.push('Include at least one number.');
  if (!hasSpecial) errors.push('Include at least one special character (!@#$%^&* etc).');

  // Common password check
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('This password is too common. Please choose something more unique.');
  }

  // Check if password contains email parts
  if (email) {
    const emailLocal = email.split('@')[0]?.toLowerCase();
    if (emailLocal && emailLocal.length > 2 && password.toLowerCase().includes(emailLocal)) {
      errors.push('Password should not contain your email address.');
    }
  }

  // Repeated character check
  if (/(.)\1{3,}/.test(password)) {
    errors.push('Avoid repeating the same character more than 3 times.');
  }

  // Sequential character check
  if (/(?:012|123|234|345|456|567|678|789|abc|bcd|cde|def)/i.test(password)) {
    errors.push('Avoid sequential characters (123, abc, etc).');
  }

  // Calculate strength
  const charTypes = [hasUppercase, hasLowercase, hasDigit, hasSpecial].filter(Boolean).length;
  let strength: PasswordValidationResult['strength'] = 'weak';
  if (errors.length === 0) {
    if (password.length >= 16 && charTypes >= 4) strength = 'very-strong';
    else if (password.length >= 12 && charTypes >= 3) strength = 'strong';
    else strength = 'fair';
  }

  return { valid: errors.length === 0, errors, strength };
}
