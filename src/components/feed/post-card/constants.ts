// ─── Post card display constants (verification, ideology, post types) ──
//
// Shared between the main PostCard and ReplyCard so badge styling stays in
// lockstep. Colors map to the prototype's ideology + signal tokens.

import {
  ShieldCheck,
  Award,
  BadgeCheck,
} from 'lucide-react';

export const verificationIcons: Record<
  string,
  { icon: typeof ShieldCheck; label: string; color: string }
> = {
  EXPERT_VERIFIED: { icon: Award, label: 'Verified Expert', color: 'text-positive-light' },
  CITIZEN_VERIFIED: { icon: BadgeCheck, label: 'Verified Citizen', color: 'text-info-light' },
  EMAIL_VERIFIED: { icon: ShieldCheck, label: 'Verified', color: 'text-text-muted' },
  OFFICIAL_VERIFIED: { icon: Award, label: 'Verified Official', color: 'text-warning-light' },
};

// Ideology chip text color (subtle, ideology palette per prototype — outlined
// chip with the ideology color as text, neutral border).
export const ideologyTextColor: Record<string, string> = {
  left: 'text-ideology-left',
  'center-left': 'text-ideology-center-left',
  center: 'text-ideology-center',
  'center-right': 'text-ideology-center-right',
  right: 'text-ideology-right',
};

// Post / thread type pills — per-type colors lifted from the prototype.
// `text`/`bg` are Tailwind arbitrary-value-friendly class fragments.
export interface TypeStyle {
  label: string;
  text: string;
  bg: string;
}

export const threadTypeLabels: Record<string, TypeStyle> = {
  POLICY_PROPOSAL: { label: 'Policy Proposal', text: 'text-civic-light', bg: 'bg-civic-subtle' },
  STRUCTURED_DEBATE: { label: 'Debate', text: 'text-info-light', bg: 'bg-info/10' },
  CROSS_PARTY_ROUNDTABLE: { label: 'Cross-Party', text: 'text-ideology-center-left', bg: 'bg-ideology-center-left/10' },
  EXPERT_AMA: { label: 'Expert Q&A', text: 'text-warning-light', bg: 'bg-warning/10' },
  NEWS_DISCUSSION: { label: 'News Discussion', text: 'text-positive-light', bg: 'bg-positive/10' },
  OPEN_DISCUSSION: { label: 'Discussion', text: 'text-civic-light', bg: 'bg-civic-subtle' },
};
