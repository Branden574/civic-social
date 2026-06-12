// ═══════════════════════════════════════════════════════════════
// Civic Social — Full Moderation Pipeline (SERVER ONLY)
// ═══════════════════════════════════════════════════════════════
// moderateContent(text) = moderateLocal(text) + optional AI provider
// blend. Lives in its own server-only module so that analyzer.ts
// stays importable from client components (compose preview,
// debate composer) without pulling the 'server-only' provider into
// client bundles — even a dynamic import() is statically bundled
// by webpack/Turbopack and breaks `next build`.
//
// Server callers (API routes) import from here; client code imports
// moderateLocal from './analyzer'.
// ═══════════════════════════════════════════════════════════════

import 'server-only';
import type { ModerationResult } from './types';
import { moderateLocal, blendProviderVerdict } from './analyzer';
import { getConfiguredProvider } from './provider';

/**
 * Full moderation with optional AI provider blend. SERVER ONLY.
 * Falls back to local-only when no provider is configured or the
 * provider errors/times out. The provider can never lower the
 * safety floor set by local rules (see blendProviderVerdict).
 */
export async function moderateContent(raw: string): Promise<ModerationResult> {
  const local = moderateLocal(raw);

  // Severe local verdicts are final — don't spend provider budget.
  if (local.action === 'block') return local;

  try {
    const provider = getConfiguredProvider();
    if (!provider) return local;

    const verdict = await provider.moderate(raw);
    if (!verdict) return local;

    return blendProviderVerdict(local, verdict);
  } catch {
    return local;
  }
}
