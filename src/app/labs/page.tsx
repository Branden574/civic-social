'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import { LiveBillCard } from '@/components/legislative/live-bill-card';
import { BillListingCard } from '@/components/legislative/bill-listing-card';
import {
  Landmark,
  Filter,
  Bell,
  BellRing,
  TrendingUp,
  Clock,
  AlertTriangle,
  AlertCircle,
  Zap,
  ChevronDown,
  ChevronUp,
  FileText,
  CalendarDays,
  BarChart3,
  Sparkles,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Info,
  Loader2,
  Shield,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Library,
} from 'lucide-react';
import clsx from 'clsx';
import type { OfficialBillData } from '@/lib/legislation/types';
import type { BillListingItem } from '@/lib/legislation/types';
import { AuthGate } from '@/components/auth/auth-gate';

// ─── Types ───────────────────────────────────────────────────

type SortMode = 'recent' | 'name';
type PageTab = 'featured' | 'browse';

interface FeedMeta {
  count: number;
  apiHealthy: boolean;
  syncStatus: string;
  lastSuccessAt: string | null;
  successRate: number;
}

// ─── Status filter options ───────────────────────────────────

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'introduced', label: 'Introduced' },
  { key: 'referred_to_committee', label: 'In Committee' },
  { key: 'reported_by_committee', label: 'Reported' },
  { key: 'passed_house', label: 'Passed House' },
  { key: 'passed_senate', label: 'Passed Senate' },
  { key: 'became_law', label: 'Became Law' },
];

// ─── Bill type filter options ────────────────────────────────

const BILL_TYPE_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All Types' },
  { key: 'hr', label: 'House Bills (H.R.)' },
  { key: 's', label: 'Senate Bills (S.)' },
  { key: 'hjres', label: 'House Joint Res.' },
  { key: 'sjres', label: 'Senate Joint Res.' },
  { key: 'hconres', label: 'House Con. Res.' },
  { key: 'sconres', label: 'Senate Con. Res.' },
  { key: 'hres', label: 'House Res.' },
  { key: 'sres', label: 'Senate Res.' },
];

const BROWSE_SORT_OPTIONS: { key: string; label: string }[] = [
  { key: 'updateDate+desc', label: 'Recently Updated' },
  { key: 'updateDate+asc', label: 'Oldest Updated' },
];

const PAGE_SIZE = 20;

// ═══════════════════════════════════════════════════════════════
// Legislative Tracker Dashboard
// ═══════════════════════════════════════════════════════════════

export default function LegislativeTrackerPage() {
  // ── Shared state ───────────────────────────────────────
  const [activeTab, setActiveTab] = useState<PageTab>('featured');
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  // ── Featured bills state ───────────────────────────────
  const [bills, setBills] = useState<OfficialBillData[]>([]);
  const [meta, setMeta] = useState<FeedMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [showFilters, setShowFilters] = useState(false);
  const [followedBills, setFollowedBills] = useState<Set<string>>(new Set());

  // ── Browse all bills state ─────────────────────────────
  const [browseBills, setBrowseBills] = useState<BillListingItem[]>([]);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [browseOffset, setBrowseOffset] = useState(0);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [browseTypeFilter, setBrowseTypeFilter] = useState('all');
  const [browseSortMode, setBrowseSortMode] = useState('updateDate+desc');
  const [browseSearchQuery, setBrowseSearchQuery] = useState('');
  const [browseSearchInput, setBrowseSearchInput] = useState('');
  const [browseSource, setBrowseSource] = useState<string>('');
  const browseFetchedRef = useRef(false);

  // ── Fetch featured bills from API ──────────────────────
  const fetchBills = useCallback(async (isRefresh: boolean = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const res = await fetch('/api/legislation');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setBills(data.bills || []);
      setMeta(data.meta || null);
      setLastFetchedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bills');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── Fetch browse listing from API ──────────────────────
  const fetchBrowseBills = useCallback(async (offset: number = 0) => {
    try {
      setBrowseLoading(true);
      setBrowseError(null);

      const params = new URLSearchParams({
        mode: 'browse',
        offset: String(offset),
        limit: String(PAGE_SIZE),
        sort: browseSortMode,
      });
      if (browseTypeFilter !== 'all') {
        params.set('billType', browseTypeFilter);
      }

      const res = await fetch(`/api/legislation?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setBrowseBills(data.bills || []);
      setBrowseTotal(data.pagination?.count || 0);
      setBrowseOffset(offset);
      setBrowseSource(data.source || '');
      setLastFetchedAt(new Date());
    } catch (err) {
      setBrowseError(err instanceof Error ? err.message : 'Failed to load bills');
    } finally {
      setBrowseLoading(false);
    }
  }, [browseTypeFilter, browseSortMode]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  // Fetch browse bills when tab switches to browse (or filters change)
  useEffect(() => {
    if (activeTab === 'browse') {
      fetchBrowseBills(0);
    }
  }, [activeTab, fetchBrowseBills]);

  // ── Auto-refresh every 5 minutes ──────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'featured') fetchBills(true);
      else fetchBrowseBills(browseOffset);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchBills, fetchBrowseBills, activeTab, browseOffset]);

  // ── Compute filtered + sorted featured bills ──────────
  const filteredBills = useMemo(() => {
    let result = [...bills];

    // Status filter
    if (selectedStatus !== 'all') {
      result = result.filter((b) => b.status === selectedStatus);
    }

    // Sort
    switch (sortMode) {
      case 'recent':
        result.sort((a, b) => {
          const dateA = a.latestAction?.date || a.introducedDate || '';
          const dateB = b.latestAction?.date || b.introducedDate || '';
          return dateB.localeCompare(dateA);
        });
        break;
      case 'name':
        result.sort((a, b) => a.officialTitle.localeCompare(b.officialTitle));
        break;
    }

    return result;
  }, [bills, selectedStatus, sortMode]);

  // ── Client-side search filtering for browse bills ──────
  const displayedBrowseBills = useMemo(() => {
    if (!browseSearchQuery) return browseBills;
    const q = browseSearchQuery.toLowerCase();
    return browseBills.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.displayCode.toLowerCase().includes(q) ||
        b.latestActionText.toLowerCase().includes(q),
    );
  }, [browseBills, browseSearchQuery]);

  // ── Stats ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = bills.filter((b) => !['became_law', 'vetoed', 'failed'].includes(b.status));
    const inCommittee = bills.filter((b) => b.status === 'referred_to_committee');
    const passedChamber = bills.filter((b) => ['passed_house', 'passed_senate'].includes(b.status));
    const becameLaw = bills.filter((b) => b.status === 'became_law');
    return {
      active: active.length,
      inCommittee: inCommittee.length,
      passedChamber: passedChamber.length,
      becameLaw: becameLaw.length,
    };
  }, [bills]);

  // ── Check if using demo data ───────────────────────────
  const isDemo = bills.length > 0 && bills.every((b) => b.source === 'demo');
  const hasStaleData = bills.some((b) => b.syncStatus === 'stale');

  const toggleFollow = (canonicalKey: string) => {
    setFollowedBills((prev) => {
      const next = new Set(prev);
      if (next.has(canonicalKey)) next.delete(canonicalKey);
      else next.add(canonicalKey);
      return next;
    });
  };

  // ── Format "minutes ago" ───────────────────────────────
  const minutesSinceRefresh = lastFetchedAt
    ? Math.max(0, Math.floor((Date.now() - lastFetchedAt.getTime()) / 60000))
    : null;

  // ── Pagination helpers ─────────────────────────────────
  const totalPages = Math.ceil(browseTotal / PAGE_SIZE);
  const currentPage = Math.floor(browseOffset / PAGE_SIZE) + 1;

  const goToPage = (page: number) => {
    const offset = (page - 1) * PAGE_SIZE;
    fetchBrowseBills(offset);
    // Scroll to top of bills list
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBrowseSearchQuery(browseSearchInput.trim());
  };

  const clearSearch = () => {
    setBrowseSearchInput('');
    setBrowseSearchQuery('');
  };

  // ═══════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════

  return (
    <AuthGate>
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-3xl mx-auto">
          {/* ── Header ── */}
          <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl border-b border-border-subtle">
            <div className="px-4 sm:px-6 py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-civic/15 flex items-center justify-center">
                    <Landmark className="w-4.5 h-4.5 text-civic-light" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-text-primary">
                      Live Legislative Tracker
                    </h1>
                    <p className="text-xs text-text-muted">
                      Real-time from Congress.gov · Canonical bill tracking
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => activeTab === 'featured' ? fetchBills(true) : fetchBrowseBills(browseOffset)}
                    disabled={refreshing || browseLoading}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-hover transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={clsx('w-3.5 h-3.5', (refreshing || browseLoading) && 'animate-spin')} />
                    {refreshing || browseLoading ? 'Syncing' : 'Refresh'}
                  </button>
                  {activeTab === 'featured' && (
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={clsx(
                        'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors',
                        showFilters
                          ? 'bg-civic/10 text-civic-light'
                          : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
                      )}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      Filters
                    </button>
                  )}
                </div>
              </div>

              {/* ── Tab bar: Featured / Browse All ── */}
              <div className="flex items-center gap-1 mt-3 border-b border-border-subtle -mb-[1px]">
                <button
                  onClick={() => setActiveTab('featured')}
                  className={clsx(
                    'flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
                    activeTab === 'featured'
                      ? 'border-civic text-civic-light'
                      : 'border-transparent text-text-muted hover:text-text-secondary',
                  )}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Featured
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-surface-elevated text-text-muted ml-1">
                    {bills.length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('browse')}
                  className={clsx(
                    'flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
                    activeTab === 'browse'
                      ? 'border-civic text-civic-light'
                      : 'border-transparent text-text-muted hover:text-text-secondary',
                  )}
                >
                  <Library className="w-3.5 h-3.5" />
                  All Bills
                  {browseTotal > 0 && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-surface-elevated text-text-muted ml-1">
                      {browseTotal.toLocaleString()}
                    </span>
                  )}
                </button>
              </div>

              {/* Bill pipeline overview (featured tab only) */}
              {activeTab === 'featured' && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mt-3">
                  {['Introduced', 'Committee', 'Reported', 'Passed Chamber', 'Conference', 'To President', 'Law'].map(
                    (step, i) => (
                      <div key={step} className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-medium px-2 py-1 rounded-md bg-surface-elevated text-text-muted whitespace-nowrap border border-border-subtle">
                          {step}
                        </span>
                        {i < 6 && <ArrowRight className="w-3 h-3 text-text-muted shrink-0" />}
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>

            {/* ── Filters (collapsible, featured tab only) ── */}
            {activeTab === 'featured' && showFilters && (
              <div className="px-4 sm:px-6 pb-4 border-t border-border-subtle pt-3 animate-fade-in space-y-3">
                {/* Status filter */}
                <div>
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                    Status
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_FILTERS.map((sf) => (
                      <button
                        key={sf.key}
                        onClick={() => setSelectedStatus(sf.key)}
                        className={clsx(
                          'text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors',
                          selectedStatus === sf.key
                            ? 'bg-civic text-white'
                            : 'bg-surface-elevated text-text-secondary border border-border-subtle hover:bg-surface-hover',
                        )}
                      >
                        {sf.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sort */}
                <div>
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                    Sort By
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { key: 'recent' as const, label: 'Recently Updated', icon: Clock },
                      { key: 'name' as const, label: 'Bill Name', icon: FileText },
                    ]).map((s) => (
                      <button
                        key={s.key}
                        onClick={() => setSortMode(s.key)}
                        className={clsx(
                          'flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors',
                          sortMode === s.key
                            ? 'bg-civic text-white'
                            : 'bg-surface-elevated text-text-secondary border border-border-subtle hover:bg-surface-hover',
                        )}
                      >
                        <s.icon className="w-3 h-3" />
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </header>

          {/* ══════════════════════════════════════════════════ */}
          {/* FEATURED TAB                                       */}
          {/* ══════════════════════════════════════════════════ */}
          {activeTab === 'featured' && (
            <>
              {/* ── Data Status Indicator ── */}
              <div className="mx-4 sm:mx-6 mt-3">
                {isDemo ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-info/5 border border-info/20 rounded-lg">
                    <Info className="w-4 h-4 text-info-light shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-info-light font-medium">
                        Demo Mode — Congress.gov API Key Not Configured
                      </p>
                      <p className="text-[10px] text-text-muted">
                        Set the <code className="font-mono text-[10px]">CONGRESS_API_KEY</code> environment
                        variable to enable live data. Bill information shown is placeholder only.
                      </p>
                    </div>
                  </div>
                ) : hasStaleData ? (
                  <div className="flex items-center justify-between px-3 py-2 bg-warning/5 border border-warning/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-warning-light" />
                      <span className="text-xs font-medium text-warning-light">
                        Some data may be stale
                      </span>
                      <span className="text-[11px] text-text-muted">
                        {lastFetchedAt ? `Last refresh: ${lastFetchedAt.toLocaleTimeString()}` : ''}
                      </span>
                    </div>
                    <button
                      onClick={() => fetchBills(true)}
                      disabled={refreshing}
                      className="text-[10px] text-warning-light hover:underline disabled:opacity-50"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-3 py-2 bg-surface-elevated rounded-lg border border-border-subtle">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-positive opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-positive" />
                      </span>
                      <span className="text-xs font-semibold text-positive-light">Live</span>
                      <span className="text-[11px] text-text-muted">
                        {minutesSinceRefresh !== null
                          ? `Last refresh: ${minutesSinceRefresh === 0 ? 'just now' : `${minutesSinceRefresh}m ago`}`
                          : 'Fetching...'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {meta && (
                        <span className="text-[10px] text-text-muted">
                          API: {Math.round(meta.successRate * 100)}% success
                        </span>
                      )}
                      <span className="text-[10px] text-text-muted">
                        Auto-refresh every 5 min
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Stats Summary ── */}
              <div className="px-4 sm:px-6 mt-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <StatCard label="Tracked Bills" value={bills.length.toString()} icon={FileText} />
                  <StatCard label="Active Bills" value={stats.active.toString()} icon={CalendarDays} />
                  <StatCard label="Passed Chamber" value={stats.passedChamber.toString()} icon={BarChart3} />
                  <StatCard label="Became Law" value={stats.becameLaw.toString()} icon={Landmark} />
                </div>
              </div>

              {/* ── Loading State ── */}
              {loading && (
                <div className="px-4 sm:px-6 py-16 text-center">
                  <Loader2 className="w-8 h-8 text-civic-light mx-auto mb-4 animate-spin" />
                  <p className="text-sm text-text-muted">
                    Fetching legislation from Congress.gov...
                  </p>
                </div>
              )}

              {/* ── Error State ── */}
              {error && !loading && bills.length === 0 && (
                <div className="px-4 sm:px-6 py-16 text-center">
                  <AlertTriangle className="w-10 h-10 text-danger-light mx-auto mb-3" />
                  <p className="text-sm text-text-primary font-semibold mb-1">
                    Unable to Load Legislative Data
                  </p>
                  <p className="text-xs text-text-muted mb-4">{error}</p>
                  <button
                    onClick={() => fetchBills()}
                    className="px-4 py-2 bg-civic text-white text-sm font-semibold rounded-lg hover:bg-civic-dark transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* ── Bill List ── */}
              {!loading && filteredBills.length > 0 && (
                <div className="mt-4 px-4 sm:px-6 space-y-3 pb-4">
                  {filteredBills.map((bill, i) => (
                    <LiveBillCard
                      key={bill.canonicalKey}
                      bill={bill}
                      index={i}
                    />
                  ))}
                </div>
              )}

              {/* ── Empty State ── */}
              {!loading && !error && filteredBills.length === 0 && bills.length > 0 && (
                <div className="px-4 sm:px-6 py-16 text-center">
                  <FileText className="w-10 h-10 text-text-muted mx-auto mb-3" />
                  <p className="text-sm text-text-secondary">
                    No bills match your current filters.
                  </p>
                  <button
                    onClick={() => {
                      setSelectedStatus('all');
                      setSortMode('recent');
                    }}
                    className="text-xs text-civic-light hover:underline mt-2"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </>
          )}

          {/* ══════════════════════════════════════════════════ */}
          {/* BROWSE ALL BILLS TAB                               */}
          {/* ══════════════════════════════════════════════════ */}
          {activeTab === 'browse' && (
            <>
              {/* ── Browse toolbar: search + filters + sort ── */}
              <div className="px-4 sm:px-6 mt-3 space-y-3">
                {/* Search bar */}
                <form onSubmit={handleSearchSubmit} className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                  <input
                    type="text"
                    value={browseSearchInput}
                    onChange={(e) => setBrowseSearchInput(e.target.value)}
                    placeholder="Search bills by title, code, or action..."
                    className="w-full pl-9 pr-9 py-2.5 text-sm bg-surface-elevated border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-civic/30 focus:border-civic/50 transition-colors"
                  />
                  {browseSearchInput && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </form>

                {/* Filter row */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Bill type filter */}
                  <select
                    value={browseTypeFilter}
                    onChange={(e) => setBrowseTypeFilter(e.target.value)}
                    className="text-xs px-3 py-1.5 bg-surface-elevated border border-border-subtle rounded-lg text-text-secondary focus:outline-none focus:ring-2 focus:ring-civic/30 cursor-pointer"
                  >
                    {BILL_TYPE_FILTERS.map((f) => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>

                  {/* Sort */}
                  <select
                    value={browseSortMode}
                    onChange={(e) => setBrowseSortMode(e.target.value)}
                    className="text-xs px-3 py-1.5 bg-surface-elevated border border-border-subtle rounded-lg text-text-secondary focus:outline-none focus:ring-2 focus:ring-civic/30 cursor-pointer"
                  >
                    {BROWSE_SORT_OPTIONS.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>

                  <div className="flex-1" />

                  {/* Result count + source */}
                  <div className="flex items-center gap-2 text-text-muted">
                    {browseTotal > 0 && (
                      <span className="text-[11px]">
                        {browseTotal.toLocaleString()} bills total
                      </span>
                    )}
                    {browseSource === 'congress_api' && (
                      <span className="flex items-center gap-1 text-[10px]">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-positive opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-positive" />
                        </span>
                        Live
                      </span>
                    )}
                    {browseSource === 'cached' && (
                      <span className="text-[10px] text-warning-light">Cached</span>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Browse loading state ── */}
              {browseLoading && (
                <div className="px-4 sm:px-6 py-16 text-center">
                  <Loader2 className="w-8 h-8 text-civic-light mx-auto mb-4 animate-spin" />
                  <p className="text-sm text-text-muted">
                    Fetching bills from Congress.gov...
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    Searching the 119th Congress ({browseTypeFilter === 'all' ? 'all bill types' : browseTypeFilter.toUpperCase()})
                  </p>
                </div>
              )}

              {/* ── Browse error ── */}
              {browseError && !browseLoading && (
                <div className="px-4 sm:px-6 py-16 text-center">
                  <AlertTriangle className="w-10 h-10 text-danger-light mx-auto mb-3" />
                  <p className="text-sm text-text-primary font-semibold mb-1">
                    Unable to Load Bills
                  </p>
                  <p className="text-xs text-text-muted mb-4">{browseError}</p>
                  <button
                    onClick={() => fetchBrowseBills(browseOffset)}
                    className="px-4 py-2 bg-civic text-white text-sm font-semibold rounded-lg hover:bg-civic-dark transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* ── Browse bill listing ── */}
              {!browseLoading && !browseError && displayedBrowseBills.length > 0 && (
                <div className="mt-4 px-4 sm:px-6 space-y-3 pb-4">
                  {displayedBrowseBills.map((bill, i) => (
                    <BillListingCard
                      key={bill.canonicalKey}
                      bill={bill}
                      index={i}
                    />
                  ))}
                </div>
              )}

              {/* ── Browse empty state ── */}
              {!browseLoading && !browseError && displayedBrowseBills.length === 0 && browseBills.length === 0 && (
                <div className="px-4 sm:px-6 py-16 text-center">
                  <FileText className="w-10 h-10 text-text-muted mx-auto mb-3" />
                  <p className="text-sm text-text-secondary">
                    No bills found. Try adjusting your filters.
                  </p>
                </div>
              )}

              {/* ── Search empty state ── */}
              {!browseLoading && !browseError && displayedBrowseBills.length === 0 && browseBills.length > 0 && browseSearchQuery && (
                <div className="px-4 sm:px-6 py-16 text-center">
                  <Search className="w-10 h-10 text-text-muted mx-auto mb-3" />
                  <p className="text-sm text-text-secondary">
                    No bills on this page match &quot;{browseSearchQuery}&quot;
                  </p>
                  <button
                    onClick={clearSearch}
                    className="text-xs text-civic-light hover:underline mt-2"
                  >
                    Clear search
                  </button>
                </div>
              )}

              {/* ── Pagination ── */}
              {!browseLoading && browseTotal > PAGE_SIZE && (
                <div className="px-4 sm:px-6 py-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage <= 1}
                      className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg bg-surface-elevated border border-border-subtle text-text-secondary hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Previous
                    </button>

                    <div className="flex items-center gap-1">
                      {/* Smart page number display */}
                      {(() => {
                        const pages: (number | 'ellipsis')[] = [];
                        if (totalPages <= 7) {
                          for (let i = 1; i <= totalPages; i++) pages.push(i);
                        } else {
                          pages.push(1);
                          if (currentPage > 3) pages.push('ellipsis');
                          for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                            pages.push(i);
                          }
                          if (currentPage < totalPages - 2) pages.push('ellipsis');
                          pages.push(totalPages);
                        }

                        return pages.map((p, idx) =>
                          p === 'ellipsis' ? (
                            <span key={`e${idx}`} className="text-xs text-text-muted px-1">...</span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => goToPage(p)}
                              className={clsx(
                                'text-xs font-medium w-10 h-10 sm:w-8 sm:h-8 rounded-lg transition-colors',
                                p === currentPage
                                  ? 'bg-civic text-white'
                                  : 'bg-surface-elevated text-text-secondary border border-border-subtle hover:bg-surface-hover',
                              )}
                            >
                              {p}
                            </button>
                          ),
                        );
                      })()}
                    </div>

                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                      className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg bg-surface-elevated border border-border-subtle text-text-secondary hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-center text-[10px] text-text-muted mt-2">
                    Showing {browseOffset + 1}–{Math.min(browseOffset + PAGE_SIZE, browseTotal)} of {browseTotal.toLocaleString()} bills
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── Data Source Footer ── */}
          <div className="px-4 sm:px-6 py-4">
            <div className="bg-surface-elevated rounded-xl border border-border-subtle p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-civic-light" />
                <h3 className="text-xs font-semibold text-text-primary">Data Source & Integrity</h3>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                All legislative data is sourced from the{' '}
                <a
                  href="https://api.congress.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-civic-light hover:underline"
                >
                  official Congress.gov API
                </a>.
                Bills are identified by canonical keys (country + congress session + bill type + number)
                to prevent mismatches across congressional sessions. Every fetch is validated against
                the requested canonical key before display.
              </p>
              <p className="text-[10px] text-text-muted">
                Canonical key format: <code className="font-mono text-[10px]">US:119:s:2103</code> ·
                Validation: congress session + bill type + number must match
              </p>
            </div>
          </div>

          <div className="h-20 lg:h-8" />
        </div>
      </main>
      <MobileNav />
    </div>
    </AuthGate>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof FileText;
}) {
  return (
    <div className="p-3 bg-surface-elevated rounded-lg border border-border-subtle">
      <Icon className="w-4 h-4 text-text-muted mb-1" />
      <p className="text-xl font-bold text-text-primary">{value}</p>
      <p className="text-[10px] text-text-muted uppercase tracking-wider">{label}</p>
    </div>
  );
}
