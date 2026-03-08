// ═══════════════════════════════════════════════════════════════
// Civic Social — Admin Audit Logging
// ═══════════════════════════════════════════════════════════════

import { isDbAvailable, prisma } from './db';
import { secureLog } from './security/logger';

export async function logAuditAction(params: {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
  ip?: string;
}): Promise<void> {
  secureLog.info('AUDIT', `${params.action} target=${params.targetType}:${params.targetId} actor=${params.actorId}`);

  if (!isDbAvailable()) return;

  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        details: params.details ? JSON.stringify(params.details) : null,
        ip: params.ip ?? null,
      },
    });
  } catch {
    // Audit log write failure should never block the action
  }
}
