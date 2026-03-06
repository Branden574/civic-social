import { NextResponse } from 'next/server';
import { isDbAvailable, prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  let dbOk = false;

  if (isDbAvailable()) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }
  }

  const status = dbOk ? 'ok' : 'degraded';

  return NextResponse.json(
    { status, db: dbOk, timestamp: new Date().toISOString() },
    { status: dbOk ? 200 : 503 },
  );
}
