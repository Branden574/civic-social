import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDbAvailable } from '@/lib/db';
import { getSessionUser } from '@/lib/security/api-guard';

// POST /api/admin/db-cleanup — purge old data to free DB space
export async function POST(request: NextRequest) {
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Auth required' }, { status: 401 });
  }

  if (!isDbAvailable()) {
    return NextResponse.json({ error: 'DB not available' }, { status: 500 });
  }

  const results: Record<string, unknown> = {};

  try {
    // 1. Count voice signals
    const signalCount = await prisma.voiceSignal.count();
    results.signalsBefore = signalCount;

    // 2. Delete ALL voice signals (they're ephemeral, only needed for live sessions)
    const deleted = await prisma.voiceSignal.deleteMany();
    results.signalsDeleted = deleted.count;

    // 3. Count remaining
    results.signalsAfter = await prisma.voiceSignal.count();

    // 4. Test write ability
    try {
      const testRow = await prisma.voiceSignal.create({
        data: {
          debateId: 'test-cleanup',
          fromUserId: 'test',
          toUserId: 'test',
          type: 'hangup',
          payload: '{}',
          consumed: true,
        },
      });
      await prisma.voiceSignal.delete({ where: { id: testRow.id } });
      results.writeTest = 'SUCCESS';
    } catch (writeErr) {
      results.writeTest = `FAILED: ${writeErr}`;
    }

    // 5. Count other large tables
    results.notificationCount = await prisma.notification.count();
    results.debateCount = await prisma.debate.count();

    // 6. Delete old notifications (> 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const oldNotifs = await prisma.notification.deleteMany({
      where: { createdAt: { lt: thirtyDaysAgo } },
    });
    results.oldNotificationsDeleted = oldNotifs.count;

  } catch (err) {
    results.error = String(err);
  }

  return NextResponse.json(results);
}

// GET — just show counts without deleting
export async function GET(request: NextRequest) {
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Auth required' }, { status: 401 });
  }

  if (!isDbAvailable()) {
    return NextResponse.json({ error: 'DB not available' }, { status: 500 });
  }

  try {
    const counts = {
      voiceSignals: await prisma.voiceSignal.count(),
      notifications: await prisma.notification.count(),
      debates: await prisma.debate.count(),
      voiceRooms: await prisma.voiceRoom.count(),
    };

    // Test write
    let writeTest = 'untested';
    try {
      const testRow = await prisma.voiceSignal.create({
        data: {
          debateId: 'test-probe',
          fromUserId: 'test',
          toUserId: 'test',
          type: 'hangup',
          payload: '{}',
          consumed: true,
        },
      });
      await prisma.voiceSignal.delete({ where: { id: testRow.id } });
      writeTest = 'SUCCESS';
    } catch (err) {
      writeTest = `FAILED: ${err}`;
    }

    return NextResponse.json({ counts, writeTest });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
