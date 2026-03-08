import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getClientIp, tooManyRequests } from '@/lib/security/api-guard';
import { readLimiter } from '@/lib/security/rate-limiter';
import { isDbAvailable, prisma } from '@/lib/db';
import { logAuditAction } from '@/lib/audit-log';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  if (!isDbAvailable()) {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  const { reportId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const status = body.status as string;
  const validStatuses = ['REVIEWED', 'ACTIONED', 'DISMISSED'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status. Use REVIEWED, ACTIONED, or DISMISSED.' }, { status: 400 });
  }

  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) {
    return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  }

  await prisma.report.update({
    where: { id: reportId },
    data: { status: status as 'REVIEWED' | 'ACTIONED' | 'DISMISSED' },
  });

  await logAuditAction({
    actorId: auth.id,
    action: `report_${status.toLowerCase()}`,
    targetType: 'report',
    targetId: reportId,
    details: { previousStatus: report.status },
    ip,
  });

  return NextResponse.json({ success: true, reportId, status });
}
