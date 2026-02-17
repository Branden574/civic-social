'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import { BillProgress } from '@/components/legislative/bill-progress';
import { ImpactAnalysis } from '@/components/legislative/impact-analysis';
import {
  ArrowLeft,
  Landmark,
  Bell,
  BellOff,
  Share2,
  ExternalLink,
  FileText,
  Users,
  MessageCircle,
  Shield,
  Clock,
  AlertTriangle,
  Zap,
  CheckCircle2,
  RefreshCw,
  Info,
  AlertCircle,
  Loader2,
  BookOpen,
  Scale,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Circle,
  XCircle,
  X,
  Send,
  Link2,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow, format } from 'date-fns';
import type { OfficialBillData, LegislativeAction, OfficialCosponsor } from '@/lib/legislation/types';
import type { CanonicalBillKey, BillType } from '@/lib/legislation/canonical-key';
import {
  toCanonicalString,
  toDisplayCode,
  getBillTypeInfo,
} from '@/lib/legislation/canonical-key';

// ─── Tab definitions ─────────────────────────────────────────

type Tab = 'summary' | 'impact' | 'timeline' | 'discussion' | 'sources';

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'summary', label: 'Summary', icon: FileText },
  { key: 'impact', label: 'Impact Analysis', icon: Scale },
  { key: 'timeline', label: 'Timeline', icon: Clock },
  { key: 'discussion', label: 'Discussion', icon: MessageCircle },
  { key: 'sources', label: 'Source Data', icon: Shield },
];

// ─── Status display helpers ──────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  introduced: 'Introduced',
  referred_to_committee: 'In Committee',
  reported_by_committee: 'Reported by Committee',
  passed_house: 'Passed House',
  passed_senate: 'Passed Senate',
  resolving_differences: 'Resolving Differences',
  to_president: 'To President',
  became_law: 'Became Law',
  vetoed: 'Vetoed',
  failed: 'Failed',
};

// Map our API status to the BillProgress component's expected status
function mapStatusForProgress(status: string): string {
  const mapping: Record<string, string> = {
    introduced: 'introduced',
    referred_to_committee: 'committee',
    reported_by_committee: 'committee',
    passed_house: 'passed_chamber',
    passed_senate: 'passed_chamber',
    resolving_differences: 'conference',
    to_president: 'passed_both',
    became_law: 'signed',
    vetoed: 'vetoed',
    failed: 'failed',
  };
  return mapping[status] || 'introduced';
}

// ─── Party badge helpers ─────────────────────────────────────

function partyBadgeClasses(party: string) {
  switch (party) {
    case 'D': return 'bg-ideology-left/15 text-ideology-left';
    case 'R': return 'bg-ideology-right/15 text-ideology-right';
    default: return 'bg-ideology-center/15 text-ideology-center';
  }
}

function partyLabel(party: string) {
  switch (party) {
    case 'D': return 'Democrat';
    case 'R': return 'Republican';
    case 'I': return 'Independent';
    default: return party;
  }
}

// ─── Mock discussion data (platform-level) ───────────────────

const MOCK_DISCUSSIONS = [
  {
    id: 'd1',
    author: 'Dr. Elena Vasquez',
    party: 'D',
    time: new Date(Date.now() - 2 * 60 * 60 * 1000),
    content: 'The CBO scoring on this bill raises important questions about long-term fiscal sustainability. While the projected outcomes are promising, the assumptions about implementation timelines may be optimistic based on historical precedent with similar legislative programs.',
    civilityScore: 94,
  },
  {
    id: 'd2',
    author: 'Marcus Donovan',
    party: 'R',
    time: new Date(Date.now() - 5 * 60 * 60 * 1000),
    content: 'I appreciate the bipartisan elements here, but I think we need to look more carefully at the impact on communities. The existing data from similar state-level programs suggests mixed outcomes that deserve more scrutiny before moving forward.',
    civilityScore: 91,
  },
  {
    id: 'd3',
    author: 'Prof. Amina Chen',
    party: 'I',
    time: new Date(Date.now() - 12 * 60 * 60 * 1000),
    content: 'The legislative process on this bill has been relatively transparent, which is commendable. I would like to see more detailed committee testimony made publicly accessible, particularly from the independent policy analysts who were consulted.',
    civilityScore: 97,
  },
];

// ─── Sync status banner ──────────────────────────────────────

function SyncStatusBanner({ bill }: { bill: OfficialBillData }) {
  if (bill.syncStatus === 'live' && (bill.source === 'congress_api' || bill.source === 'cached')) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-positive/5 border border-positive/20 rounded-lg">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-positive opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-positive" />
        </span>
        <span className="text-xs text-positive-light font-medium">Live from Congress.gov</span>
        <span className="text-[10px] text-text-muted ml-auto">
          Updated {new Date(bill.lastSyncedAt).toLocaleTimeString()}
        </span>
      </div>
    );
  }
  if (bill.syncStatus === 'stale') {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 bg-warning/5 border border-warning/20 rounded-lg">
        <AlertCircle className="w-4 h-4 text-warning-light shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-warning-light font-medium">Live updates temporarily unavailable</p>
          <p className="text-[10px] text-text-muted">
            Showing last synced data from {new Date(bill.lastSyncedAt).toLocaleString()}.
            {bill.syncError && ` Reason: ${bill.syncError}`}
          </p>
        </div>
      </div>
    );
  }
  if (bill.syncStatus === 'error') {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 bg-danger/5 border border-danger/20 rounded-lg">
        <AlertTriangle className="w-4 h-4 text-danger-light shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-danger-light font-medium">Data issue detected</p>
          <p className="text-[10px] text-text-muted">{bill.syncError || 'Mismatch detected.'}</p>
        </div>
      </div>
    );
  }
  if (bill.source === 'demo' || bill.syncStatus === 'demo') {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 bg-info/5 border border-info/20 rounded-lg">
        <Info className="w-4 h-4 text-info-light shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-info-light font-medium">Demo Mode — Not Official Data</p>
          <p className="text-[10px] text-text-muted">
            Congress.gov API key not configured. Visit{' '}
            <a href={bill.congressGovUrl} target="_blank" rel="noopener noreferrer" className="text-civic-light hover:underline">Congress.gov</a> for official data.
          </p>
        </div>
      </div>
    );
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// Bill Detail Page (Canonical Route — Full Feature)
// ═══════════════════════════════════════════════════════════════

export default function CanonicalBillDetailPage() {
  const params = useParams();
  const country = params.country as string;
  const congress = params.congress as string;
  const billType = params.billType as string;
  const billNumber = params.billNumber as string;

  const [bill, setBill] = useState<OfficialBillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [showFullSummary, setShowFullSummary] = useState(false);

  // ── Discussion modal state ──
  const [showDiscussionModal, setShowDiscussionModal] = useState(false);
  const [discPosition, setDiscPosition] = useState<'support' | 'oppose' | 'neutral' | ''>('');
  const [discArgument, setDiscArgument] = useState('');
  const [discEvidence, setDiscEvidence] = useState('');
  const [discSubmitting, setDiscSubmitting] = useState(false);
  const [discSubmitted, setDiscSubmitted] = useState(false);

  // ── Ask an Expert modal state ──
  const [showExpertModal, setShowExpertModal] = useState(false);
  const [expertQuestion, setExpertQuestion] = useState('');
  const [expertCategory, setExpertCategory] = useState('');
  const [expertSubmitting, setExpertSubmitting] = useState(false);
  const [expertSubmitted, setExpertSubmitted] = useState(false);

  const canonicalKey: CanonicalBillKey = {
    country: country?.toUpperCase() || 'US',
    congress: parseInt(congress, 10) || 119,
    billType: (billType?.toLowerCase() || 's') as BillType,
    billNumber: parseInt(billNumber, 10) || 0,
  };

  const canonicalStr = toCanonicalString(canonicalKey);

  const loadBill = useCallback(async (force: boolean = false) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const url = `/api/legislation?key=${encodeURIComponent(canonicalStr)}${force ? '&force=1' : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBill(data.bill);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bill data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canonicalStr]);

  useEffect(() => { loadBill(); }, [loadBill]);
  useEffect(() => {
    const interval = setInterval(() => loadBill(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadBill]);

  // ── Loading state ──────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen bg-bg">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
            <Loader2 className="w-8 h-8 text-civic-light mx-auto mb-4 animate-spin" />
            <p className="text-sm text-text-muted">Fetching official data for {toDisplayCode(canonicalKey)}...</p>
            <p className="text-[10px] text-text-muted mt-1">Source: Congress.gov API · Key: {canonicalStr}</p>
          </div>
        </main>
        <MobileNav />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────
  if (error && !bill) {
    return (
      <div className="flex min-h-screen bg-bg">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
            <AlertTriangle className="w-12 h-12 text-danger-light mx-auto mb-4" />
            <h1 className="text-xl font-bold text-text-primary mb-2">Unable to Load Bill Data</h1>
            <p className="text-sm text-text-muted mb-6">{error}</p>
            <div className="flex items-center gap-3 justify-center">
              <button onClick={() => loadBill(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-civic text-white text-sm font-semibold rounded-lg hover:bg-civic-dark transition-colors">
                <RefreshCw className="w-4 h-4" /> Retry
              </button>
              <a href={`https://www.congress.gov/bill/${canonicalKey.congress}th-congress/${canonicalKey.billType === 's' ? 'senate-bill' : 'house-bill'}/${canonicalKey.billNumber}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-surface-elevated text-text-secondary text-sm font-medium rounded-lg border border-border-subtle hover:bg-surface-hover transition-colors">
                <ExternalLink className="w-4 h-4" /> View on Congress.gov
              </a>
            </div>
          </div>
        </main>
        <MobileNav />
      </div>
    );
  }

  if (!bill) return null;
  const chamberInfo = getBillTypeInfo(canonicalKey.billType);
  const chamberColor = chamberInfo.chamber === 'senate' ? 'bg-purple-500/15 text-purple-400' : 'bg-info/15 text-info-light';

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-3xl mx-auto">
          {/* ── Back Navigation ── */}
          <div className="px-4 sm:px-6 pt-4">
            <Link href="/labs" className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Legislative Tracker
            </Link>
          </div>

          {/* ── Sync Status Banner ── */}
          <div className="px-4 sm:px-6 mt-3">
            <SyncStatusBanner bill={bill} />
          </div>

          {/* ══════════════════════════════════════════════════════
              Bill Header Section
             ══════════════════════════════════════════════════════ */}
          <header className="px-4 sm:px-6 pt-4 pb-6 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold', chamberColor)}>
                <Landmark className="w-3 h-3" /> {bill.billCode}
              </span>
              <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">{chamberInfo.chamber === 'senate' ? 'Senate' : 'House'}</span>
              <span className="text-[10px] text-text-muted">·</span>
              <span className="text-[10px] text-text-muted">{bill.congress}th Congress</span>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-text-primary leading-tight">{bill.officialTitle}</h1>
              {bill.shortTitle && bill.shortTitle !== bill.officialTitle && (
                <p className="text-sm text-text-muted italic">Short title: {bill.shortTitle}</p>
              )}
            </div>

            {/* Tags */}
            <div className="flex items-center gap-2 flex-wrap">
              {bill.policyArea && (
                <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-civic/10 text-civic-light border border-civic/20">{bill.policyArea}</span>
              )}
              {bill.subjects.slice(0, 5).map((s) => (
                <span key={s} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-surface-elevated text-text-secondary border border-border-subtle">{s}</span>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setIsFollowing(!isFollowing)} className={clsx('inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all', isFollowing ? 'bg-civic/10 text-civic-light border border-civic/30' : 'bg-surface-elevated text-text-secondary border border-border-subtle hover:bg-surface-hover')}>
                {isFollowing ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                {isFollowing ? 'Following' : 'Follow'}
              </button>
              <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-surface-elevated text-text-secondary border border-border-subtle hover:bg-surface-hover transition-colors">
                <Share2 className="w-4 h-4" /> Share
              </button>
              <a href={bill.officialTextUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-surface-elevated text-text-secondary border border-border-subtle hover:bg-surface-hover transition-colors">
                <ExternalLink className="w-4 h-4" /> View Official Text
              </a>
              <button onClick={() => loadBill(true)} disabled={refreshing} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-surface-elevated text-text-muted border border-border-subtle hover:bg-surface-hover transition-colors disabled:opacity-50">
                <RefreshCw className={clsx('w-3.5 h-3.5', refreshing && 'animate-spin')} />
                {refreshing ? 'Syncing...' : 'Refresh'}
              </button>
            </div>
          </header>

          {/* ══════════════════════════════════════════════════════
              Bill Progress (using existing component)
             ══════════════════════════════════════════════════════ */}
          <div className="px-4 sm:px-6 pb-4">
            <div className="bg-surface-elevated rounded-xl border border-border-subtle p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-civic-light" />
                <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Legislative Progress</h3>
                <span className="ml-auto text-[10px] text-text-muted">{STATUS_LABELS[bill.status] || bill.status}</span>
              </div>
              <BillProgress currentStatus={mapStatusForProgress(bill.status)} compact={false} />
              {bill.latestAction && (
                <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Latest: {bill.latestAction.text.slice(0, 120)}{bill.latestAction.text.length > 120 ? '...' : ''}</span>
                </div>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
              Tab Navigation
             ══════════════════════════════════════════════════════ */}
          <div className="sticky top-0 z-30 bg-bg/80 backdrop-blur-xl border-b border-border-subtle">
            <div className="px-4 sm:px-6">
              <div className="flex items-center gap-1 overflow-x-auto py-1">
                {TABS.map((tab) => {
                  const TabIcon = tab.icon;
                  return (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={clsx('flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap rounded-lg transition-all', activeTab === tab.key ? 'text-civic-light bg-civic/10' : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover')}>
                      <TabIcon className="w-3.5 h-3.5" /> {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
              Tab Content
             ══════════════════════════════════════════════════════ */}
          <div className="px-4 sm:px-6 py-6">

            {/* ─── Summary Tab ─── */}
            {activeTab === 'summary' && (
              <div className="space-y-6 animate-fade-in">

                {/* ── AI Plain-Language Summary ── */}
                {bill.aiSummary && (
                  <div className="bg-gradient-to-br from-civic/5 via-surface-elevated to-surface-elevated rounded-xl border border-civic/20 p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-civic/15 flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4 text-civic-light" />
                      </div>
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-text-primary">AI Summary</h3>
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-civic/10 text-civic-light">
                            {bill.aiSummary.source === 'ai' ? 'AI-Generated' : 'Auto-Extracted'}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-muted leading-relaxed">
                          Plain-language explanation generated from the official CRS summary. Not a legal interpretation.
                        </p>
                      </div>
                    </div>

                    {/* Plain-language overview */}
                    <div className="bg-surface/60 rounded-lg p-4 border border-border-subtle">
                      <p className="text-sm text-text-primary leading-relaxed font-medium">
                        {bill.aiSummary.plainLanguage}
                      </p>
                    </div>

                    {/* Key Provisions */}
                    {bill.aiSummary.keyProvisions.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-[11px] font-semibold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                          <FileText className="w-3 h-3 text-civic-light" />
                          Key Provisions
                        </h4>
                        <ul className="space-y-1.5">
                          {bill.aiSummary.keyProvisions.map((provision, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-text-secondary leading-relaxed">
                              <span className="w-5 h-5 rounded-md bg-civic/10 text-civic-light text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                {i + 1}
                              </span>
                              <span>{provision}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Who is affected */}
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-semibold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-civic-light" />
                        Who is affected
                      </h4>
                      <p className="text-xs text-text-secondary leading-relaxed pl-5">
                        {bill.aiSummary.whoIsAffected}
                      </p>
                    </div>

                    {/* Current Status explained */}
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-semibold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <Zap className="w-3 h-3 text-civic-light" />
                        Current Status
                      </h4>
                      <p className="text-xs text-text-secondary leading-relaxed pl-5">
                        {bill.aiSummary.statusPlainText}
                      </p>
                    </div>

                    {/* Footer disclaimer */}
                    <div className="flex items-start gap-2 pt-2 border-t border-civic/10">
                      <Info className="w-3.5 h-3.5 text-text-muted shrink-0 mt-0.5" />
                      <p className="text-[10px] text-text-muted leading-relaxed">
                        This summary is auto-generated from the official Congressional Research Service analysis.
                        It is meant to help you understand the bill in plain language — it is not a legal interpretation.
                        Always refer to the{' '}
                        <a href={bill.officialTextUrl} target="_blank" rel="noopener noreferrer" className="text-civic-light hover:underline">
                          official bill text
                        </a>{' '}
                        for authoritative details.
                        {bill.aiSummary.generatedAt && (
                          <span className="ml-1">Generated {new Date(bill.aiSummary.generatedAt).toLocaleDateString()}.</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Official CRS Summary */}
                {bill.officialSummary ? (
                  <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-civic/10 flex items-center justify-center shrink-0">
                        <BookOpen className="w-4 h-4 text-civic-light" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-text-primary">Official CRS Summary</h3>
                        <p className="text-[11px] text-text-muted leading-relaxed">
                          From the Congressional Research Service.
                          {bill.summaryDate && ` Last updated ${new Date(bill.summaryDate).toLocaleDateString()}.`}
                        </p>
                      </div>
                    </div>
                    <div className="bg-surface/50 rounded-lg p-4 border border-border-subtle">
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {showFullSummary ? bill.officialSummary : bill.officialSummary.slice(0, 500)}
                        {!showFullSummary && bill.officialSummary.length > 500 ? '...' : ''}
                      </p>
                      {bill.officialSummary.length > 500 && (
                        <button onClick={() => setShowFullSummary(!showFullSummary)} className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-civic-light hover:text-civic transition-colors">
                          {showFullSummary ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          {showFullSummary ? 'Show Less' : 'Read Full Summary'}
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-text-muted leading-relaxed">
                      This summary is from official congressional sources and may not include late-breaking changes until the next sync.
                    </p>
                  </div>
                ) : (
                  <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5 space-y-2">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-text-muted" />
                      <h3 className="text-sm font-semibold text-text-primary">Summary</h3>
                    </div>
                    <p className="text-sm text-text-muted">
                      No official CRS summary is available for this bill yet. A summary will appear here once published by the Congressional Research Service.
                    </p>
                    {bill.latestAction && (
                      <p className="text-sm text-text-secondary leading-relaxed">
                        <strong>Latest action:</strong> {bill.latestAction.text} ({bill.latestAction.date})
                      </p>
                    )}
                  </div>
                )}

                {/* Sponsor info card */}
                {bill.sponsor && (
                  <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5 space-y-4">
                    <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-civic-light" /> Sponsor
                    </h4>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-surface-active flex items-center justify-center text-sm font-semibold text-text-primary">
                        {bill.sponsor.fullName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-primary">{bill.sponsor.fullName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', partyBadgeClasses(bill.sponsor.party))}>{partyLabel(bill.sponsor.party)}</span>
                          <span className="text-xs text-text-muted">{bill.sponsor.state}{bill.sponsor.district ? `, District ${bill.sponsor.district}` : ''}</span>
                        </div>
                      </div>
                    </div>

                    {/* Cosponsors */}
                    {bill.cosponsors.length > 0 && (
                      <div className="border-t border-border-subtle pt-4 space-y-2">
                        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                          Cosponsors ({bill.cosponsors.length})
                        </p>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {bill.cosponsors.map((cosponsor, i) => (
                            <div key={cosponsor.bioguideId || i} className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-surface-active flex items-center justify-center text-[10px] font-semibold text-text-secondary">
                                {cosponsor.fullName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                              <span className="text-sm text-text-secondary flex-1 min-w-0 truncate">{cosponsor.fullName}</span>
                              <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded-full', partyBadgeClasses(cosponsor.party))}>{cosponsor.party}</span>
                              <span className="text-[11px] text-text-muted">{cosponsor.state}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {bill.cosponsors.length === 0 && bill.cosponsorCount > 0 && (
                      <p className="text-xs text-text-muted">{bill.cosponsorCount} cosponsor{bill.cosponsorCount !== 1 ? 's' : ''}</p>
                    )}
                  </div>
                )}

                {/* Bill key stats */}
                <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5 space-y-3">
                  <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider flex items-center gap-2">
                    <Scale className="w-3.5 h-3.5 text-civic-light" /> Key Details
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-text-muted mb-0.5">Introduced</p>
                      <p className="text-text-primary font-medium">{bill.introducedDate || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-text-muted mb-0.5">Status</p>
                      <p className="text-text-primary font-medium">{STATUS_LABELS[bill.status] || bill.status}</p>
                    </div>
                    <div>
                      <p className="text-text-muted mb-0.5">Origin Chamber</p>
                      <p className="text-text-primary font-medium">{bill.originChamber}</p>
                    </div>
                    <div>
                      <p className="text-text-muted mb-0.5">Policy Area</p>
                      <p className="text-text-primary font-medium">{bill.policyArea || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-text-muted mb-0.5">Total Actions</p>
                      <p className="text-text-primary font-medium">{bill.actions.length}</p>
                    </div>
                    <div>
                      <p className="text-text-muted mb-0.5">Cosponsors</p>
                      <p className="text-text-primary font-medium">{bill.cosponsors.length || bill.cosponsorCount}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Impact Analysis Tab ─── */}
            {activeTab === 'impact' && (
              <div className="space-y-4 animate-fade-in">
                {bill.impactAnalysis && bill.impactAnalysis.impacts.length > 0 ? (
                  <>
                    <ImpactAnalysis impacts={bill.impactAnalysis.impacts} />

                    {/* Methodology & Source */}
                    <div className="bg-surface-elevated rounded-xl border border-border-subtle p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-civic-light" />
                        <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                          Analysis Methodology
                        </h4>
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed">
                        {bill.impactAnalysis.methodology}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        Source: {bill.impactAnalysis.sourceDescription}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        Generated: {new Date(bill.impactAnalysis.generatedAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-start gap-2 p-3 rounded-lg bg-surface-elevated border border-border-subtle">
                      <Info className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                      <p className="text-xs text-text-muted leading-relaxed">
                        This impact analysis is generated from the official Congressional Research Service summary.
                        All perspectives are presented neutrally using &quot;Supporters argue&quot; / &quot;Critics argue&quot; framing
                        and do not represent endorsements. For the full official text, visit{' '}
                        <a href={bill.congressGovUrl} target="_blank" rel="noopener noreferrer" className="text-civic-light hover:underline">Congress.gov</a>.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <Scale className="w-10 h-10 text-text-muted mx-auto mb-3" />
                    <h3 className="text-sm font-semibold text-text-primary mb-1">Impact Analysis Unavailable</h3>
                    <p className="text-xs text-text-muted max-w-md mx-auto leading-relaxed">
                      Impact analysis requires an official CRS summary to generate. This bill does not yet have
                      a Congressional Research Service summary published. Once available, a balanced analysis of
                      who this bill affects — positively and negatively — will appear here automatically.
                    </p>
                    <a
                      href={bill.congressGovUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-4 text-xs text-civic-light hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Check Congress.gov for updates
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* ─── Timeline Tab ─── */}
            {activeTab === 'timeline' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-civic-light" />
                  <h3 className="text-sm font-semibold text-text-primary">Legislative Timeline</h3>
                  <span className="text-[10px] text-text-muted ml-auto">{bill.actions.length} actions</span>
                </div>

                {bill.actions.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="w-8 h-8 text-text-muted mx-auto mb-3" />
                    <p className="text-sm text-text-muted">No action history available yet.</p>
                  </div>
                ) : (
                  <div className="relative space-y-0">
                    {/* Vertical line */}
                    <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-border-subtle" />

                    {bill.actions.map((action, i) => (
                      <div key={`${action.date}-${i}`} className="relative flex gap-4 py-3">
                        {/* Dot */}
                        <div className="relative z-10 shrink-0">
                          <div className={clsx(
                            'w-8 h-8 rounded-full flex items-center justify-center border-2',
                            action.type === 'BecameLaw' || action.type === 'President'
                              ? 'bg-positive/15 border-positive/30'
                              : action.type === 'Floor'
                                ? 'bg-civic/15 border-civic/30'
                                : 'bg-surface-elevated border-border-subtle',
                          )}>
                            {action.type === 'BecameLaw' || action.text.toLowerCase().includes('signed') ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-positive-light" />
                            ) : action.text.toLowerCase().includes('vetoed') || action.text.toLowerCase().includes('failed') ? (
                              <XCircle className="w-3.5 h-3.5 text-danger-light" />
                            ) : action.type === 'Floor' ? (
                              <Scale className="w-3.5 h-3.5 text-civic-light" />
                            ) : (
                              <Circle className="w-3 h-3 text-text-muted" />
                            )}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pb-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={clsx(
                              'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase',
                              action.type === 'BecameLaw' ? 'bg-positive/15 text-positive-light' :
                              action.type === 'Floor' ? 'bg-civic/10 text-civic-light' :
                              action.type === 'President' ? 'bg-warning/10 text-warning-light' :
                              action.type === 'Committee' ? 'bg-info/10 text-info-light' :
                              'bg-surface-active text-text-muted',
                            )}>
                              {action.type || 'Action'}
                            </span>
                            <span className="text-[11px] text-text-muted">
                              {action.date}
                            </span>
                          </div>
                          <p className="text-sm text-text-secondary leading-relaxed">{action.text}</p>
                          {action.sourceSystem && (
                            <p className="text-[10px] text-text-muted mt-0.5">Source: {action.sourceSystem}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── Discussion Tab ─── */}
            {activeTab === 'discussion' && (
              <div className="space-y-5 animate-fade-in">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-civic-light" />
                  <h3 className="text-sm font-semibold text-text-primary">Discussion on {bill.billCode}</h3>
                </div>

                <div className="space-y-3">
                  {MOCK_DISCUSSIONS.map((comment) => (
                    <div key={comment.id} className="bg-surface-elevated rounded-xl border border-border-subtle p-4 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-text-primary">{comment.author}</span>
                        <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded-full', partyBadgeClasses(comment.party))}>{comment.party}</span>
                        <span className="text-[11px] text-text-muted">{formatDistanceToNow(comment.time, { addSuffix: true })}</span>
                        <span className="ml-auto flex items-center gap-1 text-[10px] text-positive-light">
                          <CheckCircle2 className="w-3 h-3" /> Civility: {comment.civilityScore}%
                        </span>
                      </div>
                      <p className="text-sm text-text-secondary leading-relaxed">{comment.content}</p>
                    </div>
                  ))}
                </div>

                {/* ═══ Start Structured Discussion Button ═══ */}
                <button
                  onClick={() => { setShowDiscussionModal(true); setDiscSubmitted(false); }}
                  className="w-full py-3 px-4 bg-civic text-white text-sm font-semibold rounded-xl hover:bg-civic-dark transition-all hover:shadow-glow active:scale-[0.99]"
                >
                  Start Structured Discussion
                </button>

                {/* ═══ Ask an Expert Section ═══ */}
                <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-civic-light" />
                    <h4 className="text-sm font-semibold text-text-primary">Ask an Expert</h4>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Get answers from verified policy professionals with expertise in the topics covered by this bill.
                  </p>
                  <button
                    onClick={() => { setShowExpertModal(true); setExpertSubmitted(false); }}
                    className="text-xs text-civic-light font-semibold hover:underline"
                  >
                    Submit a Question
                  </button>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-surface-elevated border border-border-subtle">
                  <Info className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                  <p className="text-xs text-text-muted leading-relaxed">
                    Evidence-based comments with citations are ranked higher. All comments are scored for civility and factual accuracy.
                  </p>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════
                Structured Discussion Modal
               ═══════════════════════════════════════════════════════ */}
            {showDiscussionModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDiscussionModal(false)} />

                {/* Modal */}
                <div className="relative w-full max-w-lg bg-surface-elevated rounded-2xl border border-border shadow-xl animate-fade-in max-h-[90vh] overflow-y-auto">
                  {/* Header */}
                  <div className="sticky top-0 bg-surface-elevated z-10 flex items-center justify-between px-5 py-4 border-b border-border-subtle rounded-t-2xl">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-5 h-5 text-civic-light" />
                      <h2 className="text-base font-bold text-text-primary">Start Structured Discussion</h2>
                    </div>
                    <button onClick={() => setShowDiscussionModal(false)} className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors">
                      <X className="w-5 h-5 text-text-muted" />
                    </button>
                  </div>

                  {!discSubmitted ? (
                    <div className="p-5 space-y-5">
                      {/* Bill context */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-surface/50 rounded-lg border border-border-subtle">
                        <Landmark className="w-4 h-4 text-civic-light shrink-0" />
                        <span className="text-xs text-text-secondary truncate">
                          <strong>{bill.billCode}</strong> — {bill.shortTitle || bill.officialTitle}
                        </span>
                      </div>

                      {/* Position selector */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                          Your Position <span className="text-danger-light">*</span>
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            { value: 'support' as const, label: 'Support', icon: ThumbsUp, color: 'positive' },
                            { value: 'oppose' as const, label: 'Oppose', icon: ThumbsDown, color: 'danger' },
                            { value: 'neutral' as const, label: 'Neutral', icon: Minus, color: 'info' },
                          ]).map((pos) => {
                            const PosIcon = pos.icon;
                            const isSelected = discPosition === pos.value;
                            return (
                              <button
                                key={pos.value}
                                onClick={() => setDiscPosition(pos.value)}
                                className={clsx(
                                  'flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all text-xs font-semibold',
                                  isSelected
                                    ? pos.color === 'positive' ? 'border-positive bg-positive/10 text-positive-light'
                                    : pos.color === 'danger' ? 'border-danger bg-danger/10 text-danger-light'
                                    : 'border-info bg-info/10 text-info-light'
                                    : 'border-border-subtle bg-surface text-text-muted hover:bg-surface-hover hover:border-border',
                                )}
                              >
                                <PosIcon className="w-5 h-5" />
                                {pos.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Argument */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                          Your Argument <span className="text-danger-light">*</span>
                        </label>
                        <textarea
                          value={discArgument}
                          onChange={(e) => setDiscArgument(e.target.value)}
                          placeholder="Present your argument clearly and respectfully. Reference specific provisions, data, or outcomes to strengthen your position..."
                          rows={5}
                          className="w-full px-4 py-3 bg-surface border border-border-subtle rounded-xl text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-civic/40 focus:border-civic/50 transition-all"
                        />
                        <p className="text-[10px] text-text-muted text-right">{discArgument.length}/2000 characters</p>
                      </div>

                      {/* Evidence / Citation */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                          <Link2 className="w-3 h-3" /> Evidence / Citation
                          <span className="text-text-muted font-normal normal-case">(optional)</span>
                        </label>
                        <input
                          type="url"
                          value={discEvidence}
                          onChange={(e) => setDiscEvidence(e.target.value)}
                          placeholder="https://... link to a supporting source"
                          className="w-full px-4 py-2.5 bg-surface border border-border-subtle rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-civic/40 focus:border-civic/50 transition-all"
                        />
                        <p className="text-[10px] text-text-muted">
                          Comments with citations are ranked higher and earn credibility points.
                        </p>
                      </div>

                      {/* Civility guidelines */}
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-civic/5 border border-civic/15">
                        <Sparkles className="w-4 h-4 text-civic-light shrink-0 mt-0.5" />
                        <div className="text-[11px] text-text-muted leading-relaxed space-y-1">
                          <p className="font-semibold text-text-secondary">Discussion Guidelines</p>
                          <ul className="space-y-0.5 list-disc list-inside">
                            <li>Address the policy, not the person</li>
                            <li>Cite sources when making factual claims</li>
                            <li>Acknowledge valid points from other perspectives</li>
                            <li>All posts are scored for civility by AI moderation</li>
                          </ul>
                        </div>
                      </div>

                      {/* Submit */}
                      <button
                        onClick={async () => {
                          if (!discPosition || !discArgument.trim()) return;
                          setDiscSubmitting(true);
                          // Simulate API call
                          await new Promise((r) => setTimeout(r, 1200));
                          setDiscSubmitting(false);
                          setDiscSubmitted(true);
                        }}
                        disabled={!discPosition || !discArgument.trim() || discArgument.length > 2000 || discSubmitting}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-civic text-white text-sm font-semibold rounded-xl hover:bg-civic-dark transition-all hover:shadow-glow active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {discSubmitting ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                        ) : (
                          <><Send className="w-4 h-4" /> Post to Discussion</>
                        )}
                      </button>
                    </div>
                  ) : (
                    /* ── Success State ── */
                    <div className="p-8 text-center space-y-4">
                      <div className="w-14 h-14 mx-auto rounded-full bg-positive/10 flex items-center justify-center">
                        <CheckCircle2 className="w-7 h-7 text-positive-light" />
                      </div>
                      <h3 className="text-lg font-bold text-text-primary">Discussion Posted!</h3>
                      <p className="text-sm text-text-muted max-w-xs mx-auto leading-relaxed">
                        Your structured argument has been submitted and will appear in the discussion thread once reviewed for civility.
                      </p>
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <button
                          onClick={() => {
                            setShowDiscussionModal(false);
                            setDiscPosition('');
                            setDiscArgument('');
                            setDiscEvidence('');
                          }}
                          className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface-elevated rounded-lg border border-border-subtle hover:bg-surface-hover transition-colors"
                        >
                          Close
                        </button>
                        <button
                          onClick={() => {
                            setDiscSubmitted(false);
                            setDiscPosition('');
                            setDiscArgument('');
                            setDiscEvidence('');
                          }}
                          className="px-4 py-2 text-sm font-semibold text-civic-light bg-civic/10 rounded-lg border border-civic/20 hover:bg-civic/15 transition-colors"
                        >
                          Start Another
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════
                Ask an Expert Modal
               ═══════════════════════════════════════════════════════ */}
            {showExpertModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowExpertModal(false)} />

                {/* Modal */}
                <div className="relative w-full max-w-lg bg-surface-elevated rounded-2xl border border-border shadow-xl animate-fade-in max-h-[90vh] overflow-y-auto">
                  {/* Header */}
                  <div className="sticky top-0 bg-surface-elevated z-10 flex items-center justify-between px-5 py-4 border-b border-border-subtle rounded-t-2xl">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-civic-light" />
                      <h2 className="text-base font-bold text-text-primary">Ask an Expert</h2>
                    </div>
                    <button onClick={() => setShowExpertModal(false)} className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors">
                      <X className="w-5 h-5 text-text-muted" />
                    </button>
                  </div>

                  {!expertSubmitted ? (
                    <div className="p-5 space-y-5">
                      {/* Bill context */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-surface/50 rounded-lg border border-border-subtle">
                        <Landmark className="w-4 h-4 text-civic-light shrink-0" />
                        <span className="text-xs text-text-secondary truncate">
                          <strong>{bill.billCode}</strong> — {bill.shortTitle || bill.officialTitle}
                        </span>
                      </div>

                      {/* How it works */}
                      <div className="bg-civic/5 rounded-xl border border-civic/15 p-4 space-y-2">
                        <p className="text-xs font-semibold text-text-secondary">How it works</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          {[
                            { step: '1', label: 'You ask' },
                            { step: '2', label: 'Experts review' },
                            { step: '3', label: 'You get answers' },
                          ].map((s) => (
                            <div key={s.step} className="flex flex-col items-center gap-1">
                              <div className="w-7 h-7 rounded-full bg-civic/15 text-civic-light text-xs font-bold flex items-center justify-center">{s.step}</div>
                              <span className="text-[10px] text-text-muted">{s.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Topic category */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                          Topic Area <span className="text-danger-light">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            'Constitutional Law',
                            'Policy Impact',
                            'Economics & Budget',
                            'Implementation',
                            'Civil Rights',
                            'Other',
                          ].map((cat) => (
                            <button
                              key={cat}
                              onClick={() => setExpertCategory(cat)}
                              className={clsx(
                                'px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left',
                                expertCategory === cat
                                  ? 'border-civic bg-civic/10 text-civic-light'
                                  : 'border-border-subtle bg-surface text-text-muted hover:bg-surface-hover hover:border-border',
                              )}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Question */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                          Your Question <span className="text-danger-light">*</span>
                        </label>
                        <textarea
                          value={expertQuestion}
                          onChange={(e) => setExpertQuestion(e.target.value)}
                          placeholder={`Ask a specific question about ${bill.billCode}. For example: "How would this bill affect small businesses in rural areas?" or "What constitutional precedent applies to Section 3?"`}
                          rows={4}
                          className="w-full px-4 py-3 bg-surface border border-border-subtle rounded-xl text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-civic/40 focus:border-civic/50 transition-all"
                        />
                        <p className="text-[10px] text-text-muted text-right">{expertQuestion.length}/1000 characters</p>
                      </div>

                      {/* Expert info */}
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-surface border border-border-subtle">
                        <Shield className="w-4 h-4 text-civic-light shrink-0 mt-0.5" />
                        <div className="text-[11px] text-text-muted leading-relaxed">
                          <p>Questions are routed to verified policy professionals — lawyers, economists, former staffers, and academics — with expertise in <strong className="text-text-secondary">{bill.policyArea || 'this policy area'}</strong>. Expect a response within 24-48 hours.</p>
                        </div>
                      </div>

                      {/* Submit */}
                      <button
                        onClick={async () => {
                          if (!expertCategory || !expertQuestion.trim()) return;
                          setExpertSubmitting(true);
                          // Simulate API call
                          await new Promise((r) => setTimeout(r, 1000));
                          setExpertSubmitting(false);
                          setExpertSubmitted(true);
                        }}
                        disabled={!expertCategory || !expertQuestion.trim() || expertQuestion.length > 1000 || expertSubmitting}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-civic text-white text-sm font-semibold rounded-xl hover:bg-civic-dark transition-all hover:shadow-glow active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {expertSubmitting ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                        ) : (
                          <><Send className="w-4 h-4" /> Submit Question</>
                        )}
                      </button>
                    </div>
                  ) : (
                    /* ── Success State ── */
                    <div className="p-8 text-center space-y-4">
                      <div className="w-14 h-14 mx-auto rounded-full bg-positive/10 flex items-center justify-center">
                        <CheckCircle2 className="w-7 h-7 text-positive-light" />
                      </div>
                      <h3 className="text-lg font-bold text-text-primary">Question Submitted!</h3>
                      <p className="text-sm text-text-muted max-w-xs mx-auto leading-relaxed">
                        Your question about <strong className="text-text-secondary">{bill.billCode}</strong> has been routed to verified experts in <strong className="text-text-secondary">{expertCategory}</strong>. You&apos;ll be notified when an answer is posted.
                      </p>
                      <div className="bg-surface/50 rounded-lg border border-border-subtle p-3 text-left">
                        <p className="text-[10px] text-text-muted mb-1 font-semibold uppercase tracking-wider">Your question</p>
                        <p className="text-xs text-text-secondary leading-relaxed">{expertQuestion}</p>
                      </div>
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <button
                          onClick={() => {
                            setShowExpertModal(false);
                            setExpertQuestion('');
                            setExpertCategory('');
                          }}
                          className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface-elevated rounded-lg border border-border-subtle hover:bg-surface-hover transition-colors"
                        >
                          Close
                        </button>
                        <button
                          onClick={() => {
                            setExpertSubmitted(false);
                            setExpertQuestion('');
                            setExpertCategory('');
                          }}
                          className="px-4 py-2 text-sm font-semibold text-civic-light bg-civic/10 rounded-lg border border-civic/20 hover:bg-civic/15 transition-colors"
                        >
                          Ask Another
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── Source Data Tab ─── */}
            {activeTab === 'sources' && (
              <div className="space-y-5 animate-fade-in">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-civic-light" />
                  <h3 className="text-sm font-semibold text-text-primary">Source Data & Transparency</h3>
                </div>

                {/* Official links */}
                <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5 space-y-3">
                  <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Official Sources</h4>
                  <div className="space-y-2">
                    <a href={bill.congressGovUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-civic-light hover:underline">
                      <ExternalLink className="w-3.5 h-3.5" /> Congress.gov Bill Page
                    </a>
                    <a href={bill.officialTextUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-civic-light hover:underline">
                      <FileText className="w-3.5 h-3.5" /> Official Bill Text
                    </a>
                  </div>
                </div>

                {/* Data integrity details */}
                <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5 space-y-4">
                  <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Data Integrity</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-text-muted mb-0.5">Canonical Key</p>
                      <p className="text-text-primary font-mono text-[11px]">{bill.canonicalKey}</p>
                    </div>
                    <div>
                      <p className="text-text-muted mb-0.5">Data Source</p>
                      <p className="text-text-primary font-medium capitalize">{bill.source.replace(/_/g, ' ')}</p>
                    </div>
                    <div>
                      <p className="text-text-muted mb-0.5">Last Synced</p>
                      <p className="text-text-primary">{new Date(bill.lastSyncedAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-text-muted mb-0.5">Congress Session</p>
                      <p className="text-text-primary">{bill.congress}th Congress</p>
                    </div>
                    <div>
                      <p className="text-text-muted mb-0.5">Bill Type</p>
                      <p className="text-text-primary">{bill.billType}</p>
                    </div>
                    <div>
                      <p className="text-text-muted mb-0.5">Bill Number</p>
                      <p className="text-text-primary">{bill.billNumber}</p>
                    </div>
                  </div>
                </div>

                {/* Data provider */}
                <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5 space-y-3">
                  <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Data Provider</h4>
                  <p className="text-sm text-text-secondary">Congressional API via api.congress.gov</p>
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <Clock className="w-3.5 h-3.5" />
                    Last updated: {new Date(bill.lastSyncedAt).toLocaleString()}
                  </div>
                </div>

                {/* Accuracy disclaimer */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-surface-elevated border border-border-subtle">
                  <Shield className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                  <p className="text-xs text-text-muted leading-relaxed">
                    All data sourced from official government records via the Congress.gov API.
                    Bill identities are validated against canonical keys (country + congress session + bill type + number)
                    before display. If you believe any information is inaccurate, please report it through our feedback system.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Bottom spacer ── */}
          <div className="h-20 lg:h-8" />
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
