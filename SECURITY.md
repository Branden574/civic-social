# Civic Social — Security Documentation

This document describes the security posture of the codebase **as it exists today**.
Where a control is aspirational or partial, it is listed under
[Known Limitations](#known-limitations) instead of being presented as done.

## Table of Contents

1. [Threat Model](#threat-model)
2. [Security Controls Inventory](#security-controls-inventory)
3. [Startup Environment Validation](#startup-environment-validation)
4. [Required Environment Variables](#required-environment-variables)
5. [Known Limitations](#known-limitations)
6. [Production Recommendations](#production-recommendations)
7. [Operational Playbooks](#operational-playbooks)
8. [Responsible Disclosure](#responsible-disclosure)

---

## Threat Model

### Assets

| Asset | Why it matters |
|-------|----------------|
| User credentials (PBKDF2 hashes in `searchableUser.passwordHash`) | Account takeover, credential stuffing against other sites |
| Session cookies (`civic-session`, HMAC-signed) | Full impersonation of a user, including moderators/admins |
| `SESSION_SECRET` | Forging sessions for **any** user/role — the highest-value secret |
| User-generated content (posts, debates, chat, profiles) | Stored XSS, harassment, doxxing, platform integrity |
| Moderation integrity (local rules + optional AI provider) | A bypassed or manipulated moderation pipeline enables abuse at scale |
| Third-party API keys (`MODERATION_API_KEY`, `CONGRESS_API_KEY`, `METERED_API_KEY`, `PUSHER_SECRET`, `RESEND_API_KEY`) | Cost abuse, quota exhaustion, sending email as the platform |
| Database (`DATABASE_URL` / `DIRECT_URL`) | All user data; PII (emails) |
| Admin/creator functionality (`/admin`, role-gated APIs) | Mass moderation actions, platform-wide configuration |

### Actors

| Actor | Capabilities assumed |
|-------|----------------------|
| Anonymous visitor | Can hit public routes and `/api/*`; controls own IP and headers |
| Authenticated user | Everything above + valid session; may attempt privilege escalation, spam, scraping |
| Malicious content author | Crafts posts to bypass moderation: evasion/masking, **prompt injection aimed at the AI moderation provider** |
| Off-site attacker (CSRF/XSS) | Lures a logged-in user to a hostile page; cannot read our cookies, may attempt cross-origin requests |
| Compromised dependency / leaked secret | Treated via rotation playbooks, log redaction, and least-privilege env design |

### Trust Boundaries

```
Browser (untrusted)
  │  cookies: civic-session (HttpOnly, HMAC), __csrf (JS-readable by design)
  ▼
Edge middleware (src/middleware.ts)            ← boundary 1
  │  rate limit / CORS / CSRF / auth-gate / security headers
  ▼
API routes + guards (src/lib/security/*)       ← boundary 2
  │  signed-session verification, RBAC, per-endpoint limits, sanitization
  ▼
Data layer (Prisma, parameterized)             ← boundary 3
  │
  └─► Third-party services (server-side only)  ← boundary 4
        Anthropic (moderation)  — untrusted OUTPUT, schema-validated
        Congress.gov, Metered (TURN), Pusher, Resend
```

Key boundary rules:

* **Nothing secret crosses to the client.** No `NEXT_PUBLIC_` variable holds a
  secret (Pusher public key/cluster are public by design).
* **User text crossing boundary 4 is data, not instructions** — see
  [AI provider hardening](#ai-moderation-pipeline).
* **AI provider output crossing back is untrusted** — schema-validated, clamped,
  and advisory only.

---

## Security Controls Inventory

### Session Authentication (`src/lib/security/session.ts`, `api-guard.ts`)

* Stateless session tokens: `base64url(JSON payload) + "." + base64url(HMAC-SHA256)`
  signed with `SESSION_SECRET`. Tampering invalidates the signature
  (constant-time comparison via `crypto.timingSafeEqual`).
* Server-enforced 24-hour expiry from the `iat` claim — browser `maxAge` is not
  trusted. Middleware refreshes the cookie past 50% of its lifetime (sliding
  session) without re-signing.
* Cookie flags: `HttpOnly`, `SameSite=Strict`, `Secure` in production, `Path=/`.
* `getSessionUser` / `requireAuth` / `requireAdmin` / `requireCreator` in
  `api-guard.ts` provide RBAC for roles `user | moderator | admin | creator`.
  Middleware additionally gates `/admin` routes and ejects `banned` sessions.

### Password Storage (`src/lib/security/hash.ts`, `password.ts`)

* PBKDF2-SHA512, 100,000 iterations, random 16-byte salt, 64-byte derived key,
  stored as `salt:hash`. Verification is timing-safe.
* Note: the stored format is **not yet version-prefixed** — see
  [Production Recommendations](#production-recommendations) for the
  versioning + Argon2id migration path.
* Password policy (`validatePassword`): 10–128 chars, all four character
  classes, common-password denylist, no email substring, no long repeats or
  trivial sequences.
* Login returns a single generic `Invalid email or password.` for unknown email
  vs. wrong password.

### Rate Limiting (`src/lib/security/rate-limiter.ts`, `src/middleware.ts`)

In-memory sliding-window counters, keyed per IP or per user:

| Limiter | Window | Max | Scope |
|---------|--------|-----|-------|
| Edge middleware (global) | 60 s | 600 | per IP, every matched route |
| `globalLimiter` | 60 s | 100 | per IP |
| `authLimiter` | 15 min | 5 | per IP (login) |
| `signupLimiter` | 60 min | 3 | per IP |
| `passwordResetLimiter` | 60 min | 3 | per email |
| `postLimiter` | 60 min | 10 | per user |
| `chatLimiter` | 60 s | 120 | per user |
| `socialLimiter` | 60 s | 30 | per user |
| `debateLimiter` | 60 min | 5 | per user |
| `readLimiter` | 60 s | 600 | per IP |

429 responses include `Retry-After` and `X-RateLimit-*` headers.
See [Known Limitations](#known-limitations): these stores are per-process.

### CSRF Posture (`src/lib/security/csrf.ts`, `src/middleware.ts`)

* **Primary defence:** the session cookie is `SameSite=Strict` — browsers do not
  attach it to cross-site requests at all.
* **Defence-in-depth:** double-submit cookie (`__csrf`, JS-readable by design,
  sent back as `x-csrf-token`). Middleware enforces the token **only for
  cross-origin mutating requests** (`POST/PUT/PATCH/DELETE` to `/api/*` with a
  non-allowlisted `Origin`), so same-origin `fetch()` is not burdened.
* CORS: production allowlist (`civicsocial.com`, `www`, the Vercel deployment
  URL, and same-origin); everything else gets 403 on `/api/*`.

### Input Sanitization & SSRF Guards (`src/lib/security/sanitize.ts`)

* `sanitizeText` strips HTML tags, `javascript:`/`vbscript:`/`data:text/html`
  URIs, and inline `on*=` handlers **before storage** (React escaping at render
  remains the second layer).
* `sanitizeDisplayName`, `sanitizeUsername`, `sanitizeTopics`, `clampInt`,
  `isValidId`, `isValidEmail` constrain shape and length of all structured input.
* `sanitizeUrl` (SSRF guard): http/https only, rejects `localhost`, `*.local`,
  loopback, `0.0.0.0`, RFC1918 ranges, link-local, CGNAT, IPv6 ULA/link-local.
  Any user-supplied URL must pass through it before being fetched or stored.

### Moderation Pipeline (`src/lib/moderation/*`)

Pipeline: `normalize → safety gate → tone rules → quality signals → calibrate →
policy action → [server-only: AI provider blend]`.

* **Local rules are the authoritative safety floor.** The optional AI provider
  can only add severity, never lower what local rules decided.
* Policy principles (viewpoint neutrality, protected political speech, no
  manipulative-politeness loophole, evasion escalation) are codified in
  `policy.ts` and enforced by `src/__tests__/moderation.test.ts`.

#### AI Moderation Pipeline (provider hardening, `provider.ts`)

| Hardening | Implementation |
|-----------|----------------|
| Fail-open to local rules | Returns `null` on **any** failure; caller falls back to local-only |
| Timeout | 4 s `AbortController` per attempt, 1 retry (5xx/429/network only) |
| Circuit breaker | 3 consecutive failures → open for 60 s (no outbound calls) |
| Prompt-injection wrapping | User text sent **only** inside `<post_content>` tags; system prompt declares it data-to-classify and instructs the model to ignore instructions inside it |
| Input bounding | Post text truncated to 4,000 chars |
| Output schema validation | Verdict parsed and validated: score clamped to [0,1], severity/action checked against closed enums, rationale truncated to 300 chars; anything malformed → `null` |
| Advisory-only output | The model never performs actions; it produces a signal blended under the local floor |
| Safe logging | Only scores/latency logged via `secureLog` — never post content, never the API key |
| Server-only | `import 'server-only'`; key read from `MODERATION_API_KEY`, never bundled |

### Security Headers & CSP (`src/middleware.ts`, `next.config.ts`)

* CSP enforced on every matched route: `default-src 'self'`, `frame-ancestors
  'none'`, `object-src 'none'`, explicit `connect-src` allowlist (Congress.gov,
  Vercel insights, Pusher). `script-src`/`style-src` still allow
  `'unsafe-inline'` — see limitations.
* HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Content-Type-Options:
  nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy:
  strict-origin-when-cross-origin`, restrictive `Permissions-Policy`
  (camera/mic limited to self for debates).
* `next.config.ts`: `poweredByHeader: false`, `no-store` on `/api/*` responses,
  image `remotePatterns` allowlist, `dangerouslyAllowSVG: false`, server
  actions origin restriction.

### Secure Logging & Monitoring (`src/lib/security/logger.ts`, `monitoring.ts`)

* `secureLog` auto-redacts bearer tokens, API keys, passwords, secrets,
  session IDs, JWTs, and partially redacts emails; error stacks suppressed in
  production. All API routes log through it.
* `monitoring.ts` records typed security events (auth failures, lockouts, rate
  limit hits, CSRF violations, admin actions, DDoS patterns) into a bounded
  in-memory buffer with per-type anomaly thresholds and alert logging.
  External alert delivery (`ALERT_WEBHOOK_URL`) is reserved but **not yet wired**.

### Endpoint-Specific Guards

* `/api/cron/*`: requires `Authorization: Bearer ${CRON_SECRET}`; returns 500
  when the secret is unconfigured (fail closed).
* `/api/turn-credentials`: authenticated + read-rate-limited; TURN secrets stay
  server-side, clients only ever receive short-lived ICE server entries.
* Database access goes exclusively through Prisma (parameterized queries). The
  only raw SQL (`$executeRawUnsafe` in the cron route) interpolates a
  hardcoded constant list of view names, not user input.

---

## Startup Environment Validation

`src/lib/security/env-check.ts` validates the environment **once per server
process** and logs clear findings — variable names only, never values:

* `SESSION_SECRET` present and ≥ 32 characters (error in production).
* `DATABASE_URL` or `DIRECT_URL` present in production (error — otherwise the
  app silently runs on volatile in-memory stores).
* `MODERATION_PROVIDER` / `MODERATION_API_KEY` set together, provider value
  supported (warn).
* `CRON_SECRET` present in production (warn — cron routes 500 without it).
* TURN trio (`TURN_URL`/`TURN_USERNAME`/`TURN_CREDENTIAL`) and Pusher
  quad (+ `NEXT_PUBLIC_PUSHER_*` client pair) configured all-or-none (warn).

It is wired through `src/instrumentation.ts` (`register()`), which Next.js
invokes natively at server startup — no config flag needed. `validateEnv()` is
singleton-guarded, never throws, and never blocks boot. For non-Next consumers
(scripts, workers), import and call `validateEnv()` at entry instead.

---

## Required Environment Variables

All variables are server-only unless prefixed `NEXT_PUBLIC_`.
See `.env.example` for placeholders and generation commands.

| Variable | Required | Purpose | Checked at startup |
|----------|----------|---------|--------------------|
| `SESSION_SECRET` | **Yes** | HMAC-SHA256 session signing; ≥ 32 chars (`openssl rand -hex 32`) | Yes (error in prod) |
| `DATABASE_URL` | Yes (prod)¹ | Prisma Accelerate connection | Yes (error in prod) |
| `DIRECT_URL` | Yes (prod)¹ | Direct TCP postgres URL (pg adapter, local dev) | Yes (error in prod) |
| `CRON_SECRET` | Yes (prod) | Bearer auth for `/api/cron/*` (Vercel Cron) | Yes (warn) |
| `CONGRESS_API_KEY` | Optional | Congress.gov legislation data (demo fallback without it) | No |
| `MODERATION_PROVIDER` | Optional² | AI moderation provider; only `anthropic` implemented | Yes (pairing) |
| `MODERATION_API_KEY` | Optional² | Anthropic API key for moderation | Yes (pairing) |
| `MODERATION_MODEL` | Optional | Model override (default `claude-haiku-4-5-20251001`) | No |
| `METERED_API_KEY` | Optional | Metered.ca TURN credential fetch for debates | No |
| `TURN_URL` / `TURN_USERNAME` / `TURN_CREDENTIAL` | Optional³ | Static TURN fallback | Yes (trio) |
| `PUSHER_APP_ID` / `PUSHER_KEY` / `PUSHER_SECRET` / `PUSHER_CLUSTER` | Optional³ | Real-time signaling (server) | Yes (quad) |
| `NEXT_PUBLIC_PUSHER_KEY` / `NEXT_PUBLIC_PUSHER_CLUSTER` | Optional³ | Pusher client config (public by design) | Yes (pairing) |
| `RESEND_API_KEY` / `RESEND_FROM` | Optional | Transactional email (console fallback in dev) | No |
| `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_BASE_URL` | Optional | Email links / sitemap base URL | No |
| `FEATURE_X_ENGINE` | Optional | `1` enables X-style feed ranking (needs DB) | No |
| `ALERT_WEBHOOK_URL` | Reserved | Future security-alert delivery (not yet wired) | No |

¹ At least one of the two. Without either, the app falls back to in-memory stores.
² Must be set together; otherwise AI moderation is disabled and local rules run alone.
³ All-or-none group.

---

## Known Limitations

Honest accounting of what the current implementation does **not** provide:

1. **In-memory rate limiters are per-process.** Both the edge middleware
   limiter and `rate-limiter.ts` reset on restart/redeploy and are not shared
   across instances or serverless invocations. Effective limits scale with
   instance count.
2. **In-memory store fallback.** When no database is configured,
   `social-store.ts` (follows/notifications) and related stores run in process
   memory: data is lost on restart and inconsistent across instances. The
   startup env check makes this an explicit production error.
3. **Sessions are stateless and not revocable.** There is no server-side
   session store; a signed token is valid until its 24-hour expiry. Bans are
   enforced via the role claim and middleware, but an already-issued token for
   a freshly-banned user remains structurally valid until expiry or rotation of
   `SESSION_SECRET` (which logs out everyone).
4. **CSP still allows `'unsafe-inline'`** for scripts and styles (Next.js
   inline runtime). Nonce-based CSP is the planned fix.
5. **PBKDF2 instead of a memory-hard KDF.** PBKDF2-SHA512 @ 100k iterations is
   acceptable but weaker against GPU attackers than Argon2id; the stored format
   has no version prefix yet, so parameter upgrades require a migration step.
6. **Middleware CSRF comparison is not constant-time** (`csrfCookie !==
   csrfHeader`); the `csrf.ts` helper is timing-safe but the edge path uses
   plain comparison. Low practical risk (token is random per browser), tracked
   for cleanup.
7. **Rate limiting trusts `X-Forwarded-For`.** Safe behind Vercel/CDN which
   overwrite it; unsafe if the app is ever exposed directly.
8. **SSRF guard is hostname-based.** `sanitizeUrl` blocks private literals but
   does not resolve DNS, so a hostname that resolves to a private IP
   (DNS-rebinding style) is not caught. User URLs are primarily stored/linked
   rather than fetched server-side, which limits exposure.
9. **Monitoring is in-memory and alerting is log-only.** Events vanish on
   restart; no SIEM/webhook delivery yet.
10. **No 2FA, email-verification enforcement gaps, no HaveIBeenPwned check** on
    passwords (denylist is a static top-100 subset).

---

## Production Recommendations

Priority-ordered hardening path:

1. **Redis-backed rate limiting** (e.g. `@upstash/ratelimit`) replacing both the
   middleware map and `rate-limiter.ts` stores — required for multi-instance
   correctness. Keep the same limiter names/limits.
2. **Argon2id migration with versioned hashes.** Introduce a version-prefixed
   format (e.g. `v2$argon2id$…` alongside legacy `salt:hash`), verify against
   the detected version, and transparently re-hash on successful login. Keeps
   PBKDF2 verifiable during the transition window.
3. **CSP nonces.** Generate a per-request nonce in middleware, drop
   `'unsafe-inline'` from `script-src`/`style-src`, and use `strict-dynamic`.
4. **Server-side session revocation.** Add a token-id (`jti`) claim plus a
   small denylist (Redis/DB) checked in `verifySession`, so bans and "log out
   everywhere" take effect immediately.
5. **Wire `ALERT_WEBHOOK_URL`** in `monitoring.ts` to Slack/PagerDuty and ship
   security events to a SIEM (Sentry/Datadog) instead of the in-memory buffer.
6. **2FA/passkeys for admin and creator accounts**; HaveIBeenPwned k-anonymity
   check on signup/password change.
7. **DNS-resolving SSRF guard** if server-side fetching of user URLs is ever
   added (resolve, then verify the resolved IP is public; pin the IP for the
   request).
8. **CDN/WAF in front** (Vercel Firewall or Cloudflare) for L7 DDoS absorption
   ahead of the in-app limiters.
9. **Secrets manager + rotation**: `SESSION_SECRET` and `CRON_SECRET` every 90
   days, third-party API keys per provider guidance; rotating `SESSION_SECRET`
   invalidates all sessions (communicate before rotating).

---

## Operational Playbooks

### Credential exposure

1. Rotate the affected secret immediately (`openssl rand -hex 32` for
   `SESSION_SECRET`/`CRON_SECRET`; provider consoles for API keys).
2. Redeploy; verify the old secret no longer works.
3. `SESSION_SECRET` rotation logs out all users — announce if planned.
4. Audit: `git log --all --diff-filter=A -- '*.env' '*.key' '*.pem'`, deployment
   logs, provider usage dashboards.

### Abuse wave / DDoS

1. Tighten CDN/WAF rules first (the in-app limiter is per-instance).
2. Reduce limiter thresholds and redeploy if needed.
3. Review `monitoring.ts` recent events (`rate_limit_hit`, `ddos_pattern`) for
   source patterns.

### Suspected account takeover

1. Set the account's role/suspension in the database (middleware ejects
   `banned` sessions; suspension blocks login).
2. For immediate session kill platform-wide, rotate `SESSION_SECRET`
   (see limitation #3 — per-account revocation is not yet implemented).
3. Force a password reset; review audit log entries (`secureLog.audit`).

---

## Responsible Disclosure

If you discover a security vulnerability in Civic Social:

* **Email the maintainer privately**: branden574@gmail.com with subject
  `[SECURITY] Civic Social`. Please do **not** open a public GitHub issue for
  security reports.
* Include reproduction steps, impact assessment, and affected
  endpoints/components. Proof-of-concept is welcome; mass data extraction is not.
* Do not access data belonging to other users, degrade service availability,
  or run automated scanners against production.
* You can expect an acknowledgement within 72 hours and a fix-or-mitigation
  plan within 14 days for confirmed issues. We will credit reporters who want
  credit once a fix ships. There is currently no paid bounty program.
