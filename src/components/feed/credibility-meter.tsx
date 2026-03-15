'use client';

import { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ShieldQuestion,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  User,
  FileText,
  Flag,
  AlertTriangle,
} from 'lucide-react';
import clsx from 'clsx';

interface CredibilityData {
  sourceCredibility: number;    // 0–1
  authorReputation: number;     // 0–1
  civility: number;             // 0–1
  penalty: number;              // 0–1
  sourceCount: number;
  hasPrimarySources: boolean;
  verificationLevel: string;
  flagCount: number;
}

interface CredibilityMeterProps {
  data: CredibilityData;
  compact?: boolean;
}

// ── Compute overall trust score ──
function computeTrustScore(data: CredibilityData): number {
  const score =
    0.35 * data.sourceCredibility +
    0.25 * data.authorReputation +
    0.20 * data.civility +
    0.20 * (1 - data.penalty);
  return Math.max(0, Math.min(1, score));
}

// ── Trust level labels and styles ──
interface TrustLevel {
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof ShieldCheck;
}

function getTrustLevel(score: number): TrustLevel {
  if (score >= 0.8) {
    return {
      label: 'Highly Credible',
      shortLabel: 'Credible',
      description: 'Well-sourced content from a trusted, verified contributor',
      color: 'text-positive-light',
      bgColor: 'bg-positive/10',
      borderColor: 'border-positive/25',
      icon: ShieldCheck,
    };
  }
  if (score >= 0.6) {
    return {
      label: 'Generally Credible',
      shortLabel: 'Credible',
      description: 'Reasonably sourced with a reputable author',
      color: 'text-info-light',
      bgColor: 'bg-info/10',
      borderColor: 'border-info/25',
      icon: ShieldCheck,
    };
  }
  if (score >= 0.4) {
    return {
      label: 'Mixed Credibility',
      shortLabel: 'Mixed',
      description: 'Some supporting evidence but gaps in sourcing or reputation',
      color: 'text-warning-light',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/25',
      icon: ShieldQuestion,
    };
  }
  if (score >= 0.2) {
    return {
      label: 'Low Credibility',
      shortLabel: 'Low',
      description: 'Limited sources, low author reputation, or flagged content',
      color: 'text-[#FB923C]',
      bgColor: 'bg-[#FB923C]/10',
      borderColor: 'border-[#FB923C]/25',
      icon: ShieldAlert,
    };
  }
  return {
    label: 'Likely Misleading',
    shortLabel: 'Warning',
    description: 'No credible sources, high penalty signals, or confirmed misinformation',
    color: 'text-danger-light',
    bgColor: 'bg-danger/10',
    borderColor: 'border-danger/25',
    icon: ShieldX,
  };
}

export function CredibilityMeter({ data, compact = false }: CredibilityMeterProps) {
  const [expanded, setExpanded] = useState(false);
  const score = computeTrustScore(data);
  const level = getTrustLevel(score);
  const Icon = level.icon;

  if (compact) {
    return (
      <button
        onClick={() => setExpanded(!expanded)}
        className={clsx(
          'flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md border transition-colors cursor-pointer',
          level.bgColor,
          level.borderColor,
          level.color,
        )}
        title={`${level.label}: ${Math.round(score * 100)}%`}
      >
        <Icon className="w-3 h-3" />
        <span>{Math.round(score * 100)}%</span>
      </button>
    );
  }

  return (
    <div className="mt-3">
      {/* Main badge — colored but restrained */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={clsx(
          'flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl transition-colors',
          level.bgColor,
          'hover:opacity-80',
        )}
      >
        <Icon className={clsx('w-4 h-4 shrink-0', level.color)} />
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2.5">
            <span className={clsx('text-xs font-medium', level.color)}>
              {level.label}
            </span>
            <div className="flex-1 h-1 bg-surface-active/30 rounded-full overflow-hidden max-w-20">
              <div
                className={clsx(
                  'h-full rounded-full transition-all duration-700 opacity-60',
                  score >= 0.8 ? 'bg-positive' : score >= 0.6 ? 'bg-info' : score >= 0.4 ? 'bg-warning' : score >= 0.2 ? 'bg-warning' : 'bg-danger',
                )}
                style={{ width: `${Math.round(score * 100)}%` }}
              />
            </div>
            <span className={clsx('text-xs font-medium', level.color)}>
              {Math.round(score * 100)}%
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-text-muted shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
        )}
      </button>

      {/* Expanded breakdown */}
      {expanded && (
        <div className="mt-2 p-3 bg-surface-elevated rounded-xl border border-border-subtle animate-fade-in space-y-2.5">
          <p className="text-xs font-semibold text-text-muted">
            Credibility Breakdown
          </p>

          <BreakdownRow
            icon={FileText}
            label="Source Quality"
            value={data.sourceCredibility}
            detail={
              data.sourceCount > 0
                ? `${data.sourceCount} source${data.sourceCount !== 1 ? 's' : ''} cited${data.hasPrimarySources ? ' (includes primary)' : ''}`
                : 'No sources cited'
            }
          />
          <BreakdownRow
            icon={User}
            label="Author Reputation"
            value={data.authorReputation}
            detail={formatVerification(data.verificationLevel)}
          />
          <BreakdownRow
            icon={ShieldCheck}
            label="Civility Score"
            value={data.civility}
            detail="Tone quality, empathy, solution orientation"
          />
          {data.penalty > 0.05 && (
            <BreakdownRow
              icon={AlertTriangle}
              label="Content Warnings"
              value={1 - data.penalty}
              detail={
                data.flagCount > 0
                  ? `${data.flagCount} community flag${data.flagCount !== 1 ? 's' : ''}`
                  : 'Automated pattern detection'
              }
              isWarning
            />
          )}
          {data.flagCount > 0 && data.penalty <= 0.05 && (
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Flag className="w-3 h-3" />
              <span>{data.flagCount} community flag{data.flagCount !== 1 ? 's' : ''}</span>
            </div>
          )}

          <p className="text-xs text-text-muted pt-1 border-t border-border-subtle">
            {level.description}
          </p>
        </div>
      )}
    </div>
  );
}

function BreakdownRow({
  icon: Icon,
  label,
  value,
  detail,
  isWarning,
}: {
  icon: typeof FileText;
  label: string;
  value: number;
  detail: string;
  isWarning?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={clsx('w-3.5 h-3.5 shrink-0', isWarning ? 'text-warning-light' : 'text-text-muted')} />
      <span className="text-xs text-text-secondary w-28 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-surface-active rounded-full overflow-hidden">
        <div
          className={clsx(
            'h-full rounded-full transition-colors duration-500',
            isWarning
              ? 'bg-warning'
              : value >= 0.7
                ? 'bg-positive'
                : value >= 0.4
                  ? 'bg-info'
                  : 'bg-danger',
          )}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="text-xs font-mono text-text-muted w-8 text-right">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

function formatVerification(level: string): string {
  const map: Record<string, string> = {
    EXPERT_VERIFIED: 'Expert Verified contributor',
    CITIZEN_VERIFIED: 'Verified citizen',
    EMAIL_VERIFIED: 'Email verified',
    OFFICIAL_VERIFIED: 'Verified official',
    UNVERIFIED: 'Unverified account',
  };
  return map[level] || 'Unknown';
}

// Export the computation for use in the API
export { computeTrustScore, getTrustLevel };
export type { CredibilityData };
