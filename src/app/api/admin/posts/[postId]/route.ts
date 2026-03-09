import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getClientIp, tooManyRequests } from '@/lib/security/api-guard';
import { readLimiter } from '@/lib/security/rate-limiter';
import { setPostStatus } from '@/lib/post-data-store';
import { logAuditAction } from '@/lib/audit-log';
import { dbCreateNotification } from '@/lib/social-store';

const REMOVAL_REASONS: Record<string, string> = {
  spam: 'Your post was removed for spam or misleading content.',
  harassment: 'Your post was removed for violating our harassment policy.',
  misinformation: 'Your post was removed for containing verified misinformation.',
  hate_speech: 'Your post was removed for hate speech or discriminatory content.',
  violence: 'Your post was removed for inciting or glorifying violence.',
  other: 'Your post was removed for violating community guidelines.',
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { postId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const action = body.action as string;

  if (action === 'remove') {
    const reason = (body.reason as string) || 'other';
    const reasonText = REMOVAL_REASONS[reason] || REMOVAL_REASONS.other;
    const authorId = body.authorId as string;

    const success = await setPostStatus(postId, 'removed');
    if (!success) {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }

    await logAuditAction({
      actorId: auth.id,
      action: 'remove_post',
      targetType: 'post',
      targetId: postId,
      details: { reason, reasonText },
      ip,
    });

    // Notify the post author about the removal
    if (authorId) {
      await dbCreateNotification({
        recipientUserId: authorId,
        actorUserId: null,
        type: 'post_removed',
        entityType: 'post',
        entityId: postId,
        metadata: { preview: reasonText },
      });
    }

    return NextResponse.json({ success: true, postId, status: 'removed' });
  }

  if (action === 'restore') {
    const success = await setPostStatus(postId, 'published');
    if (!success) {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }

    await logAuditAction({
      actorId: auth.id,
      action: 'restore_post',
      targetType: 'post',
      targetId: postId,
      ip,
    });

    return NextResponse.json({ success: true, postId, status: 'published' });
  }

  return NextResponse.json({ error: 'Invalid action. Use "remove" or "restore".' }, { status: 400 });
}
