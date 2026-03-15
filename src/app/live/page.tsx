'use client';

import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import { Radio, Calendar, Users, MapPin, Clock, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import { AuthGate } from '@/components/auth/auth-gate';

const liveEvents = [
  {
    id: 'live-1',
    title: 'Senate Committee Hearing: Tech Regulation',
    type: 'Government Hearing',
    status: 'live',
    viewers: 1234,
    location: 'Washington, D.C.',
    startTime: 'Started 45 min ago',
    description:
      'Senate Commerce Committee hearing on social media regulation, data privacy, and platform accountability. Witnesses include tech CEOs and privacy advocates.',
    topics: ['technology', 'regulation', 'privacy'],
  },
  {
    id: 'live-2',
    title: 'Cross-Party Town Hall: Healthcare Solutions',
    type: 'Civic Event',
    status: 'live',
    viewers: 567,
    location: 'Virtual',
    startTime: 'Started 20 min ago',
    description:
      'Representatives from both major parties discuss common-ground healthcare policy solutions with citizen Q&A.',
    topics: ['healthcare', 'policy', 'bipartisan'],
  },
  {
    id: 'live-3',
    title: 'State Primary Election Coverage',
    type: 'Election',
    status: 'upcoming',
    viewers: 0,
    location: 'Multiple States',
    startTime: 'Starts in 3 hours',
    description:
      'Real-time coverage and discussion of primary elections in 5 states. Non-partisan analysis and citizen discussion threads.',
    topics: ['elections', 'voting', 'democracy'],
  },
  {
    id: 'live-4',
    title: 'Climate Policy Summit — Day 2 Recap',
    type: 'International',
    status: 'ended',
    viewers: 2890,
    location: 'Geneva, Switzerland',
    startTime: 'Ended 2 hours ago',
    description:
      'Day 2 of international climate negotiations. Key agreements on carbon markets and adaptation funding for developing nations.',
    topics: ['climate', 'international', 'policy'],
  },
];

const statusConfig: Record<string, { label: string; style: string; dot: string }> = {
  live: { label: 'LIVE NOW', style: 'bg-danger/15 text-danger-light border-danger/30', dot: 'bg-danger animate-pulse' },
  upcoming: { label: 'UPCOMING', style: 'bg-warning/10 text-warning-light border-warning/20', dot: 'bg-warning' },
  ended: { label: 'RECAP', style: 'bg-surface-active text-text-muted border-border-subtle', dot: 'bg-text-muted' },
};

export default function LivePage() {
  return (
    <AuthGate>
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl border-b border-border-subtle px-5 sm:px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Radio className="w-5 h-5 text-danger-light" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-danger rounded-full animate-pulse" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-text-primary">
                  Live Civic Events
                </h1>
                <p className="text-xs text-text-muted">
                  Hearings · Elections · Town halls · Summits · Moderated companion threads
                </p>
              </div>
            </div>
          </header>

          {/* Events */}
          <div className="divide-y divide-border-subtle">
            {liveEvents.map((event, i) => {
              const status = statusConfig[event.status];
              return (
                <div
                  key={event.id}
                  className="feed-item animate-fade-in opacity-0 px-4 sm:px-6 py-5 hover:bg-surface/40 transition-colors cursor-pointer"
                  style={{
                    animationDelay: `${i * 80}ms`,
                    animationFillMode: 'forwards',
                  }}
                >
                  {/* Status badge + event type */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span
                      className={clsx(
                        'flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md border',
                        status.style,
                      )}
                    >
                      <span className={clsx('w-1.5 h-1.5 rounded-full', status.dot)} />
                      {status.label}
                    </span>
                    <span className="text-xs font-medium text-text-muted bg-surface-active px-2 py-0.5 rounded-md">
                      {event.type}
                    </span>
                    {event.status === 'live' && (
                      <span className="text-xs text-text-muted flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {event.viewers.toLocaleString()} watching
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h2 className="text-base font-semibold text-text-primary leading-snug mb-2">
                    {event.title}
                  </h2>

                  {/* Description */}
                  <p className="text-sm text-text-secondary leading-relaxed mb-3">
                    {event.description}
                  </p>

                  {/* Topics */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {event.topics.map((topic) => (
                      <span
                        key={topic}
                        className="text-xs font-medium text-civic-light bg-civic-subtle px-2 py-0.5 rounded-full"
                      >
                        #{topic}
                      </span>
                    ))}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {event.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {event.startTime}
                    </span>
                    {event.status === 'ended' && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {event.viewers.toLocaleString()} watched
                      </span>
                    )}
                  </div>

                  {/* CTA */}
                  {event.status === 'live' && (
                    <button className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-danger/10 text-danger-light text-xs font-semibold rounded-xl hover:bg-danger/20 transition-colors">
                      <Radio className="w-3.5 h-3.5" />
                      Join Live Discussion
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="h-20 lg:h-8" />
        </div>
      </main>
      <MobileNav />
    </div>
    </AuthGate>
  );
}
