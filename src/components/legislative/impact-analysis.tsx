'use client';

import { useState } from 'react';
import {
  BarChart3,
  ChevronDown,
  DollarSign,
  Building2,
  Users,
  Receipt,
  Leaf,
  Heart,
  Scale,
  Factory,
  HelpCircle,
} from 'lucide-react';
import clsx from 'clsx';

interface ImpactAnalysisProps {
  impacts: {
    category: string;
    icon: string;
    supportersArgue: string;
    criticsArgue: string;
    potentialOutcomes: string[];
  }[];
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  economic: DollarSign,
  'small business': Building2,
  'middle-class': Users,
  taxpayer: Receipt,
  environmental: Leaf,
  healthcare: Heart,
  'civil rights': Scale,
  industry: Factory,
};

function getIconForCategory(iconString: string) {
  const key = iconString.toLowerCase();
  return ICON_MAP[key] || HelpCircle;
}

export function ImpactAnalysis({ impacts }: ImpactAnalysisProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const toggleCard = (index: number) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
  };

  if (impacts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-civic-light" />
          <h3 className="text-lg font-semibold text-text-primary">Impact Analysis</h3>
        </div>
        <p className="text-xs text-text-muted italic">
          Presented neutrally — this is not an endorsement
        </p>
      </div>

      {/* Impact cards */}
      <div className="space-y-2">
        {impacts.map((impact, index) => {
          const isExpanded = expandedIndex === index;
          const CategoryIcon = getIconForCategory(impact.icon);

          return (
            <div
              key={index}
              className={clsx(
                'rounded-xl border transition-colors duration-300',
                isExpanded
                  ? 'bg-surface-elevated border-border'
                  : 'bg-surface border-border-subtle hover:border-border'
              )}
            >
              {/* Card header */}
              <button
                onClick={() => toggleCard(index)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-civic-subtle">
                    <CategoryIcon className="h-4 w-4 text-civic-light" />
                  </div>
                  <span className="text-sm font-semibold text-text-primary">
                    {impact.category}
                  </span>
                </div>
                <ChevronDown
                  className={clsx(
                    'h-4 w-4 text-text-muted transition-transform duration-300',
                    isExpanded && 'rotate-180'
                  )}
                />
              </button>

              {/* Expanded content */}
              <div
                className={clsx(
                  'overflow-hidden transition-colors duration-300',
                  isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
                )}
              >
                <div className="px-4 pb-4 space-y-4">
                  {/* Supporters argue */}
                  <div className="border-l-2 border-positive/50 pl-3 space-y-1">
                    <h4 className="text-xs font-semibold text-positive-light">
                      Supporters argue
                    </h4>
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {impact.supportersArgue}
                    </p>
                  </div>

                  {/* Critics argue */}
                  <div className="border-l-2 border-danger/50 pl-3 space-y-1">
                    <h4 className="text-xs font-semibold text-danger-light">
                      Critics argue
                    </h4>
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {impact.criticsArgue}
                    </p>
                  </div>

                  {/* Potential outcomes */}
                  {impact.potentialOutcomes.length > 0 && (
                    <div className="border-l-2 border-info/50 pl-3 space-y-1.5">
                      <h4 className="text-xs font-semibold text-info-light">
                        Potential outcomes may include
                      </h4>
                      <ul className="space-y-1">
                        {impact.potentialOutcomes.map((outcome, oIndex) => (
                          <li
                            key={oIndex}
                            className="flex items-start gap-2 text-sm text-text-secondary leading-relaxed"
                          >
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-info/50" />
                            {outcome}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
