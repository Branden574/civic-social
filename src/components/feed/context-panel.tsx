'use client';

import { useState } from 'react';
import { Info, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import clsx from 'clsx';

// ─── Types ───────────────────────────────────────────────────

interface ContextPanelProps {
  topics: string[];
  isVisible?: boolean;
}

interface TopicContext {
  summary: string;
  facts: string[];
  perspectives: {
    ideology: 'left' | 'center' | 'right';
    label: string;
    summary: string;
  }[];
  learnMoreUrl: string;
}

// ─── Polarizing topics that trigger the context panel ────────

const POLARIZING_TOPICS = [
  'immigration',
  'gun-control',
  'abortion',
  'elections',
  'climate',
  'criminal-justice',
  'healthcare',
  'economy',
  'education',
  'technology',
  'foreign-policy',
  'housing',
  'taxation',
] as const;

type PolarizingTopic = (typeof POLARIZING_TOPICS)[number];

// ─── Hardcoded context data per topic ────────────────────────

const TOPIC_CONTEXT: Record<PolarizingTopic, TopicContext> = {
  healthcare: {
    summary: 'Healthcare policy in the US remains one of the most debated domestic issues.',
    facts: [
      'The US spends approximately 17.8% of GDP on healthcare — the highest among developed nations.',
      'An estimated 28 million Americans remain uninsured as of 2024.',
      'Life expectancy in the US has declined relative to peer countries over the past decade.',
    ],
    perspectives: [
      {
        ideology: 'left',
        label: 'Progressive',
        summary: 'Healthcare is a human right. A single-payer or public option system would reduce costs and guarantee universal coverage.',
      },
      {
        ideology: 'center',
        label: 'Moderate',
        summary: 'The ACA framework should be strengthened with targeted reforms to expand coverage while maintaining market competition.',
      },
      {
        ideology: 'right',
        label: 'Conservative',
        summary: 'Free-market competition, deregulation, and Health Savings Accounts drive down costs more effectively than government programs.',
      },
    ],
    learnMoreUrl: 'https://www.kff.org/health-reform/',
  },
  immigration: {
    summary: 'Immigration policy involves balancing border security, economic needs, and humanitarian obligations.',
    facts: [
      'The US admits roughly 1 million legal immigrants per year through various visa categories.',
      'An estimated 11 million undocumented immigrants currently reside in the United States.',
      'Immigrants make up about 14% of the US population — near the historic high of 15% in 1890.',
    ],
    perspectives: [
      {
        ideology: 'left',
        label: 'Progressive',
        summary: 'Pathways to citizenship for undocumented residents, expanded legal immigration, and humane asylum processing are priorities.',
      },
      {
        ideology: 'center',
        label: 'Moderate',
        summary: 'A comprehensive approach combining border security with earned legalization and merit-based reforms is needed.',
      },
      {
        ideology: 'right',
        label: 'Conservative',
        summary: 'Strong border enforcement, merit-based immigration, and reducing illegal crossings should be the top priorities.',
      },
    ],
    learnMoreUrl: 'https://www.migrationpolicy.org/',
  },
  'gun-control': {
    summary: 'Gun policy in the US intersects constitutional rights, public safety, and cultural identity.',
    facts: [
      'There are an estimated 400 million civilian-owned firearms in the United States.',
      'Gun violence causes approximately 45,000 deaths annually, including suicides.',
      'The Second Amendment has been interpreted as protecting individual gun ownership since DC v. Heller (2008).',
    ],
    perspectives: [
      {
        ideology: 'left',
        label: 'Progressive',
        summary: 'Universal background checks, assault weapon bans, and red flag laws are common-sense measures to reduce gun violence.',
      },
      {
        ideology: 'center',
        label: 'Moderate',
        summary: 'Enhanced background checks and mental health investment can reduce violence while respecting lawful gun ownership.',
      },
      {
        ideology: 'right',
        label: 'Conservative',
        summary: 'The Second Amendment protects an individual right. Enforcement of existing laws and addressing mental health are the real solutions.',
      },
    ],
    learnMoreUrl: 'https://www.rand.org/research/gun-policy.html',
  },
  abortion: {
    summary: 'Abortion access has become a state-by-state issue following the Dobbs decision in 2022.',
    facts: [
      'The Supreme Court overturned Roe v. Wade in June 2022, returning regulation to states.',
      'Over a dozen states have enacted near-total abortion bans since the Dobbs ruling.',
      'Approximately 1 in 4 women in the US will have an abortion by age 45.',
    ],
    perspectives: [
      {
        ideology: 'left',
        label: 'Pro-choice',
        summary: 'Reproductive autonomy is a fundamental right. Federal legislation should codify abortion access nationwide.',
      },
      {
        ideology: 'center',
        label: 'Moderate',
        summary: 'Most Americans support access with some restrictions. A balanced framework reflecting gestational limits and exceptions is needed.',
      },
      {
        ideology: 'right',
        label: 'Pro-life',
        summary: 'Life begins at conception. States should have the authority to protect unborn life through legislation.',
      },
    ],
    learnMoreUrl: 'https://www.guttmacher.org/state-policy',
  },
  elections: {
    summary: 'Election integrity and voting access are central to American democratic governance.',
    facts: [
      'Voter turnout in the 2020 presidential election reached 66.8% — the highest in over a century.',
      'Over 40 states have introduced legislation addressing election procedures since 2020.',
      'Mail-in and early voting accounted for roughly 46% of all votes cast in 2020.',
    ],
    perspectives: [
      {
        ideology: 'left',
        label: 'Progressive',
        summary: 'Expanding voting access through mail-in ballots, automatic registration, and eliminating gerrymandering strengthens democracy.',
      },
      {
        ideology: 'center',
        label: 'Moderate',
        summary: 'Election security and broad access are both important. Bipartisan reform can address legitimate concerns on both sides.',
      },
      {
        ideology: 'right',
        label: 'Conservative',
        summary: 'Voter ID requirements, clean voter rolls, and secure in-person voting are essential to maintaining election integrity.',
      },
    ],
    learnMoreUrl: 'https://www.brennancenter.org/issues/ensure-every-american-can-vote',
  },
  climate: {
    summary: 'Climate change policy involves balancing environmental protection with economic considerations.',
    facts: [
      'Global average temperature has risen approximately 1.1°C since pre-industrial levels.',
      'The US is the second-largest CO₂ emitter, responsible for roughly 13% of global emissions.',
      'The Inflation Reduction Act allocated $369 billion to clean energy and climate investments.',
    ],
    perspectives: [
      {
        ideology: 'left',
        label: 'Progressive',
        summary: 'Aggressive decarbonization, a Green New Deal, and environmental justice are urgent priorities to avert climate catastrophe.',
      },
      {
        ideology: 'center',
        label: 'Moderate',
        summary: 'Market-based solutions like carbon pricing, combined with clean energy investment, can achieve meaningful emissions reductions.',
      },
      {
        ideology: 'right',
        label: 'Conservative',
        summary: 'Energy independence, innovation-driven solutions, and avoiding economy-damaging regulations should guide climate policy.',
      },
    ],
    learnMoreUrl: 'https://climate.nasa.gov/',
  },
  'criminal-justice': {
    summary: 'Criminal justice reform addresses policing, sentencing, incarceration, and rehabilitation.',
    facts: [
      'The US incarcerates approximately 1.9 million people — the highest rate of any nation.',
      'Black Americans are incarcerated at nearly 5 times the rate of white Americans.',
      'Recidivism rates hover around 44% within the first year of release.',
    ],
    perspectives: [
      {
        ideology: 'left',
        label: 'Progressive',
        summary: 'Systemic reform is needed: end mass incarceration, redirect funding to social services, and address racial disparities.',
      },
      {
        ideology: 'center',
        label: 'Moderate',
        summary: 'Bipartisan sentencing reform, rehabilitation programs, and evidence-based policing can improve outcomes while maintaining safety.',
      },
      {
        ideology: 'right',
        label: 'Conservative',
        summary: 'Law enforcement must be supported. Reducing crime requires tough sentencing, community policing, and personal accountability.',
      },
    ],
    learnMoreUrl: 'https://www.sentencingproject.org/',
  },
  economy: {
    summary: 'Economic policy debates center on growth, inequality, fiscal responsibility, and the role of government intervention.',
    facts: [
      'US national debt exceeds $34 trillion as of 2024, roughly 120% of GDP.',
      'The top 1% of earners hold approximately 31% of national wealth.',
      'Median household income in the US is roughly $75,000, with wide regional variation.',
    ],
    perspectives: [
      {
        ideology: 'left',
        label: 'Progressive',
        summary: 'Stronger social safety nets, higher minimum wage, and progressive taxation can reduce inequality and boost shared prosperity.',
      },
      {
        ideology: 'center',
        label: 'Moderate',
        summary: 'A mix of market-friendly policies with targeted government programs can balance growth with equity.',
      },
      {
        ideology: 'right',
        label: 'Conservative',
        summary: 'Lower taxes, deregulation, and free markets drive innovation and growth more effectively than government intervention.',
      },
    ],
    learnMoreUrl: 'https://www.bls.gov/',
  },
  education: {
    summary: 'Education policy spans school funding, curriculum standards, school choice, student debt, and workforce preparation.',
    facts: [
      'US spending per student averages roughly $16,000 per year, among the highest globally.',
      'Total student loan debt in the US exceeds $1.7 trillion across 45 million borrowers.',
      'US students rank 25th in math and 13th in reading among OECD countries.',
    ],
    perspectives: [
      {
        ideology: 'left',
        label: 'Progressive',
        summary: 'Increase public school funding, make college affordable or free, and ensure equitable access for all students regardless of zip code.',
      },
      {
        ideology: 'center',
        label: 'Moderate',
        summary: 'A balanced approach of public school improvement, targeted loan reform, and some school choice options can serve diverse needs.',
      },
      {
        ideology: 'right',
        label: 'Conservative',
        summary: 'School choice, voucher programs, and local control empower parents and drive competition that improves educational outcomes.',
      },
    ],
    learnMoreUrl: 'https://nces.ed.gov/',
  },
  technology: {
    summary: 'Technology policy involves AI regulation, data privacy, social media governance, and antitrust in the digital economy.',
    facts: [
      'The global AI market is projected to reach $1.8 trillion by 2030.',
      'Over 80% of Americans say they have little control over how companies use their data.',
      'The top 5 tech companies have a combined market capitalization exceeding $10 trillion.',
    ],
    perspectives: [
      {
        ideology: 'left',
        label: 'Progressive',
        summary: 'Strong AI regulation, data privacy legislation, algorithmic accountability, and breaking up tech monopolies protect democracy and workers.',
      },
      {
        ideology: 'center',
        label: 'Moderate',
        summary: 'Thoughtful regulation that protects consumers while preserving innovation — a technology bill of rights with industry collaboration.',
      },
      {
        ideology: 'right',
        label: 'Conservative',
        summary: 'Light-touch regulation preserves American innovation leadership. Anti-censorship rules and free speech protections on platforms are priorities.',
      },
    ],
    learnMoreUrl: 'https://www.brookings.edu/topic/technology/',
  },
  'foreign-policy': {
    summary: 'US foreign policy encompasses alliances, military engagement, trade agreements, and global leadership.',
    facts: [
      'The US defense budget exceeds $850 billion — roughly 40% of global military spending.',
      'The US maintains approximately 750 military bases in over 80 countries.',
      'Foreign aid represents less than 1% of the federal budget ($60 billion annually).',
    ],
    perspectives: [
      {
        ideology: 'left',
        label: 'Progressive',
        summary: 'Reduce military spending, prioritize diplomacy and multilateral institutions, increase foreign aid, and address root causes of conflict.',
      },
      {
        ideology: 'center',
        label: 'Moderate',
        summary: 'Maintain strong alliances (NATO, EU), balance military readiness with diplomatic engagement, and lead on global challenges like climate.',
      },
      {
        ideology: 'right',
        label: 'Conservative',
        summary: 'Peace through strength. Prioritize American interests, ensure allies pay their fair share, and maintain military superiority.',
      },
    ],
    learnMoreUrl: 'https://www.cfr.org/',
  },
  housing: {
    summary: 'Housing policy addresses affordability, homelessness, zoning reform, and the gap between housing supply and demand.',
    facts: [
      'The US has a shortage of approximately 3.8 million housing units relative to demand.',
      'Median home prices have risen over 40% since 2020 in many metro areas.',
      'Roughly 580,000 Americans experience homelessness on any given night.',
    ],
    perspectives: [
      {
        ideology: 'left',
        label: 'Progressive',
        summary: 'Expand public housing, implement rent control, fund Housing First programs, and reform exclusionary zoning to increase supply.',
      },
      {
        ideology: 'center',
        label: 'Moderate',
        summary: 'Bipartisan zoning reform, incentives for affordable development, and targeted subsidies can address the supply-demand gap.',
      },
      {
        ideology: 'right',
        label: 'Conservative',
        summary: 'Reduce zoning regulations, let the free market increase supply, and provide tax incentives for developers to build more housing.',
      },
    ],
    learnMoreUrl: 'https://www.huduser.gov/',
  },
  taxation: {
    summary: 'Tax policy debates involve rates, fairness, loopholes, corporate taxation, and the balance between revenue and economic growth.',
    facts: [
      'The top federal income tax rate is 37%, down from 91% in the 1950s and 70% in the 1970s.',
      'US corporate tax revenue as a share of GDP is among the lowest in OECD countries.',
      'An estimated $600 billion per year is lost to the "tax gap" — taxes owed but not paid.',
    ],
    perspectives: [
      {
        ideology: 'left',
        label: 'Progressive',
        summary: 'A wealth tax, higher capital gains rates, and closing corporate loopholes would fund public investment and reduce inequality.',
      },
      {
        ideology: 'center',
        label: 'Moderate',
        summary: 'Simplify the tax code, close egregious loopholes, and find a balance between fair rates and economic competitiveness.',
      },
      {
        ideology: 'right',
        label: 'Conservative',
        summary: 'Lower tax rates spur investment, job creation, and growth. A simpler tax code with fewer brackets benefits everyone.',
      },
    ],
    learnMoreUrl: 'https://taxfoundation.org/',
  },
};

const IDEOLOGY_DOT_COLORS: Record<string, string> = {
  left: 'bg-ideology-left',
  center: 'bg-ideology-center',
  right: 'bg-ideology-right',
};

// ─── Component ───────────────────────────────────────────────

export function ContextPanel({ topics, isVisible = true }: ContextPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Find the first polarizing topic in this post's topics
  const matchedTopic = topics.find((t) =>
    POLARIZING_TOPICS.includes(t as PolarizingTopic),
  ) as PolarizingTopic | undefined;

  // Don't render if not visible or no polarizing topic matched
  if (!isVisible || !matchedTopic) return null;

  const context = TOPIC_CONTEXT[matchedTopic];

  return (
    <div className="mt-3 rounded-xl border border-border-subtle bg-surface-elevated overflow-hidden transition-colors duration-200">
      {/* Collapsed header — always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-surface-hover transition-colors"
      >
        <Info className="w-4 h-4 text-civic-light shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-text-primary">
            Context
          </span>
          <span className="mx-2 text-text-muted">·</span>
          <span className="text-xs text-text-muted">
            This topic is frequently debated
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-text-muted shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border-subtle animate-fade-in">
          {/* Summary */}
          <p className="text-xs text-text-secondary leading-relaxed mb-3">
            {context.summary}
          </p>

          {/* Key Facts */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-text-muted mb-2">
              Key Facts
            </h4>
            <ul className="space-y-1.5">
              {context.facts.map((fact, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs text-text-secondary leading-relaxed"
                >
                  <span className="text-civic-light mt-0.5 shrink-0">•</span>
                  {fact}
                </li>
              ))}
            </ul>
          </div>

          {/* Multiple Perspectives */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-text-muted mb-2">
              Multiple Perspectives
            </h4>
            <div className="space-y-2.5">
              {context.perspectives.map((perspective) => (
                <div
                  key={perspective.ideology}
                  className="flex items-start gap-2.5"
                >
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    <span
                      className={clsx(
                        'w-2 h-2 rounded-full',
                        IDEOLOGY_DOT_COLORS[perspective.ideology] ||
                          'bg-text-muted',
                      )}
                    />
                    <span className="text-xs font-semibold text-text-muted uppercase w-16">
                      {perspective.label}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {perspective.summary}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Learn More */}
          <a
            href={context.learnMoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-civic-light hover:underline transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Learn More
          </a>
        </div>
      )}
    </div>
  );
}
