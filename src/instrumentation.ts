// ═══════════════════════════════════════════════════════════════
// Civic Social — Next.js Instrumentation
// ═══════════════════════════════════════════════════════════════
//
// Next.js calls register() once per server process at startup
// (supported natively — no config flag required on Next 15+).
//
// Currently used to surface environment misconfiguration early
// via validateEnv(). It only logs findings — it never throws and
// never blocks boot. Values are never logged, only variable names.
// ═══════════════════════════════════════════════════════════════

export async function register(): Promise<void> {
  // Skip the edge runtime (middleware) — validate once in Node.js.
  if (process.env.NEXT_RUNTIME === 'edge') return;

  const { validateEnv } = await import('@/lib/security/env-check');
  validateEnv();
}
