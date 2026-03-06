'use client';

import Link from 'next/link';
import { parseContentWithMentions } from '@/lib/mentions';

/**
 * Renders post/comment text with @mentions as clickable profile links.
 */
export function MentionText({ text, className }: { text: string; className?: string }) {
  const segments = parseContentWithMentions(text);

  // If no mentions found, return plain text
  if (segments.length === 1 && segments[0].type === 'text') {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.type === 'mention') {
          return (
            <Link
              key={i}
              href={`/profile/${encodeURIComponent(seg.value)}`}
              className="text-civic-light font-semibold hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              @{seg.value}
            </Link>
          );
        }
        return <span key={i}>{seg.value}</span>;
      })}
    </span>
  );
}
