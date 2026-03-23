import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getClientIp, tooManyRequests } from '@/lib/security/api-guard';
import { readLimiter } from '@/lib/security/rate-limiter';
import { isDbAvailable, prisma } from '@/lib/db';
import { logAuditAction } from '@/lib/audit-log';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  if (!isDbAvailable()) {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  const { userId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const action = body.action as string;
  const reason = (body.reason as string) || '';

  if (!['ban', 'unban', 'suspend'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action. Use ban, unban, or suspend.' }, { status: 400 });
  }

  // Prevent admin from modifying their own account
  if (userId === auth.id) {
    return NextResponse.json({ error: 'Cannot modify your own account.' }, { status: 400 });
  }

  const target = await prisma.searchableUser.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!target) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  // Prevent modifying other admins/creators
  if (target.role === 'admin' || target.role === 'creator') {
    return NextResponse.json({ error: 'Cannot modify admin accounts.' }, { status: 403 });
  }

  if (action === 'ban') {
    await prisma.searchableUser.update({ where: { id: userId }, data: { role: 'banned' } });
  } else if (action === 'unban') {
    await prisma.searchableUser.update({ where: { id: userId }, data: { role: 'user', suspendedUntil: null } });
  } else if (action === 'suspend') {
    const suspendUntil = body.suspendUntil as string;
    if (!suspendUntil) {
      return NextResponse.json({ error: 'suspendUntil date is required for suspend action.' }, { status: 400 });
    }
    const date = new Date(suspendUntil);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Invalid suspendUntil date.' }, { status: 400 });
    }
    await prisma.searchableUser.update({ where: { id: userId }, data: { suspendedUntil: date } });
  }

  await logAuditAction({
    actorId: auth.id,
    action: `${action}_user`,
    targetType: 'user',
    targetId: userId,
    details: { reason, suspendUntil: body.suspendUntil },
    ip,
  });

  return NextResponse.json({ success: true, action, userId });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  if (!isDbAvailable()) {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  const { userId } = await params;

  if (userId === auth.id) {
    return NextResponse.json({ error: 'Cannot delete your own account.' }, { status: 400 });
  }

  const target = await prisma.searchableUser.findUnique({ where: { id: userId }, select: { id: true, role: true, displayName: true } });
  if (!target) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  if (target.role === 'admin' || target.role === 'creator') {
    return NextResponse.json({ error: 'Cannot delete admin accounts.' }, { status: 403 });
  }

  // Soft-delete user's posts
  await prisma.storedPost.updateMany({
    where: { authorId: userId },
    data: { deletedAt: new Date() },
  });

  // Delete user's comments
  await prisma.storedComment.updateMany({
    where: { authorId: userId },
    data: { deletedAt: new Date() },
  });

  // Delete notifications involving this user
  await prisma.notification.deleteMany({
    where: { OR: [{ recipientUserId: userId }, { actorUserId: userId }] },
  });

  // Delete the searchable user record
  await prisma.searchableUser.delete({ where: { id: userId } });

  // Delete the auth user record (cascades Follow, Reaction, Post, etc.)
  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch {
    // User may only exist in SearchableUser (e.g., legacy accounts)
  }

  await logAuditAction({
    actorId: auth.id,
    action: 'delete_user',
    targetType: 'user',
    targetId: userId,
    details: { displayName: target.displayName },
    ip,
  });

  return NextResponse.json({ success: true, action: 'delete', userId });
}
