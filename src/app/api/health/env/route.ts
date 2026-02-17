import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/security/api-guard';

export async function GET(request: NextRequest) {
  const user = getSessionUser(request);
  const isDev = process.env.NODE_ENV !== 'production';
  const isAdmin = user?.role === 'admin' || user?.role === 'creator';

  if (!isDev && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const dbUrl = process.env.DATABASE_URL || '';
  let dbHost: string | null = null;
  try {
    if (dbUrl) dbHost = new URL(dbUrl).host;
  } catch {
    dbHost = null;
  }

  return NextResponse.json({
    env: process.env.NODE_ENV || 'unknown',
    dbConfigured: Boolean(dbUrl),
    dbHost,
    serverTime: new Date().toISOString(),
  });
}

