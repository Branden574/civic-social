'use client';

import { memo } from 'react';
import clsx from 'clsx';
import { ThumbsUp, Lightbulb } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { verificationIcons, ideologyTextColor } from './constants';
import type { PostReply } from './types';

/**
 * Single reply row. Wrapped in memo() — a reply only re-renders when its own
 * data changes, not when the parent card's reaction / expansion state updates.
 */
export const ReplyCard = memo(function ReplyCard({ reply }: { reply: PostReply }) {
  const verification = verificationIcons[reply.author.verificationLevel];
  const ideology = reply.author.affiliations[0];
  const ideologyClass = ideology ? ideologyTextColor[ideology] ?? 'text-text-muted' : '';

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-1">
        {reply.author.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={reply.author.avatarUrl}
            alt={reply.author.displayName}
            className="w-6 h-6 rounded-full object-cover"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-surface-active flex items-center justify-center text-text-muted text-xs font-semibold">
            {reply.author.displayName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)}
          </div>
        )}
        <span className="text-xs font-semibold text-text-primary">{reply.author.displayName}</span>
        {verification && (
          <span title={verification.label}>
            <verification.icon className={clsx('w-3 h-3', verification.color)} aria-hidden="true" />
          </span>
        )}
        {ideology && (
          <span
            className={clsx(
              'text-[9px] font-semibold px-1.5 py-0.5 rounded-full border border-border-subtle',
              ideologyClass,
            )}
          >
            {ideology}
          </span>
        )}
        <span className="text-xs text-text-muted">
          {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
        </span>
      </div>
      <p className="text-sm text-text-secondary leading-relaxed ml-8">{reply.content}</p>
      <div className="flex items-center gap-3 mt-1.5 ml-8">
        <span className="text-xs text-text-muted flex items-center gap-1">
          <ThumbsUp className="w-3 h-3" aria-hidden="true" /> {reply.reactions.agree}
        </span>
        <span className="text-xs text-text-muted flex items-center gap-1">
          <Lightbulb className="w-3 h-3" aria-hidden="true" /> {reply.reactions.insightful}
        </span>
        <span
          className={clsx(
            'text-xs font-medium px-1.5 py-0.5 rounded',
            reply.civilityScore >= 0.8 ? 'bg-positive/10 text-positive-light' : 'bg-warning/10 text-warning-light',
          )}
        >
          Civility: {Math.round(reply.civilityScore * 100)}%
        </span>
      </div>
    </div>
  );
});
