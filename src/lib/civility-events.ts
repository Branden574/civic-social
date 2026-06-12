// ═══════════════════════════════════════════════════════════════
// Civic Social — Civility Event Service
// ═══════════════════════════════════════════════════════════════
// Durable behavioral history. Events persist even if the post
// that triggered them is later deleted. Used by the credibility
// engine and ranking algorithm.
// ═══════════════════════════════════════════════════════════════

import { isDbAvailable, prisma } from './db';

/** Structural subset of CivilityResult/ModerationResult that events need.
 *  Category is stored as a string column, so the wider new-engine
 *  vocabulary (doxxing, threat, spam, evasion) is accepted as-is. */
export interface CivilityEventInput {
  score: number;
  issues: string[];
  severity: 'critical' | 'high' | 'medium' | 'low' | 'none';
  category: string;
}

// ─── Create a civility event ─────────────────────────────────

export async function recordCivilityEvent(
  userId: string,
  postId: string,
  result: CivilityEventInput,
): Promise<void> {
  if (!isDbAvailable()) return;

  // Classify event type
  let eventType: string;
  if (result.severity === 'critical' || result.severity === 'high') {
    eventType = 'violation';
  } else if (result.score >= 0.8) {
    eventType = 'positive';
  } else {
    eventType = 'neutral';
  }

  try {
    await prisma.civilityEvent.create({
      data: {
        userId,
        postId,
        eventType,
        severity: result.severity,
        category: result.category,
        score: result.score,
        details: JSON.stringify({ issues: result.issues }),
      },
    });
  } catch {
    // Event logging should never block the post creation
  }
}

// ─── Query civility history for credibility engine ───────────

export interface CivilityHistory {
  /** Total events */
  totalEvents: number;
  /** Count of violation events (critical + high severity) */
  violations: number;
  /** Count of critical-severity violations */
  criticalViolations: number;
  /** Average score across ALL events (not just current posts) */
  averageScore: number;
  /** Count of positive events (score >= 0.8) */
  positiveEvents: number;
  /** Most recent violation timestamp */
  lastViolationAt: Date | null;
  /** Consecutive positive events since last violation */
  positiveStreak: number;
}

export async function getCivilityHistory(userId: string): Promise<CivilityHistory | null> {
  if (!isDbAvailable()) return null;

  try {
    const [events, stats] = await Promise.all([
      prisma.civilityEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { eventType: true, severity: true, score: true, createdAt: true },
        take: 500, // cap for performance
      }),
      prisma.civilityEvent.aggregate({
        where: { userId },
        _avg: { score: true },
        _count: true,
      }),
    ]);

    if (events.length === 0) {
      return {
        totalEvents: 0,
        violations: 0,
        criticalViolations: 0,
        averageScore: 0.5,
        positiveEvents: 0,
        lastViolationAt: null,
        positiveStreak: 0,
      };
    }

    const violations = events.filter(e => e.eventType === 'violation').length;
    const criticalViolations = events.filter(e => e.severity === 'critical').length;
    const positiveEvents = events.filter(e => e.eventType === 'positive').length;
    const lastViolation = events.find(e => e.eventType === 'violation');

    // Count consecutive positive events since last violation
    let positiveStreak = 0;
    for (const event of events) {
      if (event.eventType === 'violation') break;
      if (event.eventType === 'positive') positiveStreak++;
    }

    return {
      totalEvents: stats._count,
      violations,
      criticalViolations,
      averageScore: stats._avg.score ?? 0.5,
      positiveEvents,
      lastViolationAt: lastViolation?.createdAt ?? null,
      positiveStreak,
    };
  } catch {
    return null;
  }
}
