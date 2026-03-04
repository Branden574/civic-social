// ═══════════════════════════════════════════════════════════════
// POST /api/contact — Store contact form submissions
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, tooManyRequests, badRequest } from '@/lib/security/api-guard';
import { postLimiter } from '@/lib/security/rate-limiter';
import { sanitizeText } from '@/lib/security/sanitize';
import { isDbAvailable, prisma } from '@/lib/db';

const VALID_SUBJECTS = new Set([
  'bug', 'feedback', 'account', 'moderation', 'partnership', 'press', 'other',
]);

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = postLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON.');
  }

  const name = sanitizeText((body.name as string) || '').slice(0, 200);
  const email = ((body.email as string) || '').toLowerCase().trim();
  const subject = (body.subject as string) || '';
  const message = sanitizeText((body.message as string) || '').slice(0, 5000);

  if (!name || name.length < 2) return badRequest('Name is required.');
  if (!email || !isValidEmail(email)) return badRequest('Valid email required.');
  if (!VALID_SUBJECTS.has(subject)) return badRequest('Please select a valid subject.');
  if (!message || message.length < 10) return badRequest('Message must be at least 10 characters.');

  // Store in DB if available, otherwise store in-memory
  if (isDbAvailable()) {
    try {
      await prisma.$executeRaw`
        INSERT INTO "ContactSubmission" ("id", "name", "email", "subject", "message", "ip", "createdAt")
        VALUES (${`contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}, ${name}, ${email}, ${subject}, ${message}, ${ip}, NOW())
      `;
    } catch (err) {
      console.error('[contact] DB insert failed, falling back to log:', err);
      console.log('[contact-submission]', JSON.stringify({ name, email, subject, message: message.slice(0, 200), ip, at: new Date().toISOString() }));
    }
  } else {
    // Log submission so it isn't lost
    console.log('[contact-submission]', JSON.stringify({ name, email, subject, message: message.slice(0, 200), ip, at: new Date().toISOString() }));
  }

  return NextResponse.json({
    success: true,
    message: 'Your message has been received. We will respond within 24-48 hours.',
  });
}
