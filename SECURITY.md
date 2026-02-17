# Civic Social — Security Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Security Audit Summary](#security-audit-summary)
3. [Go-Live Security Checklist](#go-live-security-checklist)
4. [Incident Response Playbook](#incident-response-playbook)
5. [Secrets Rotation Plan](#secrets-rotation-plan)

---

## Architecture Overview

### Defense Layers

```
Internet
  │
  ├─ CDN / WAF (Cloudflare, Vercel Edge)     ← Layer 1: Network defense
  │
  ├─ Next.js Middleware (src/middleware.ts)    ← Layer 2: Edge enforcement
  │   ├─ Global rate limiting (120 req/min/IP)
  │   ├─ Security headers (CSP, HSTS, X-Frame-Options)
  │   ├─ CSRF token provisioning + validation
  │   ├─ CORS lockdown (production origins only)
  │   └─ Server info header removal
  │
  ├─ API Route Guards (src/lib/security/)     ← Layer 3: Application security
  │   ├─ Session-based auth (civic-session cookie)
  │   ├─ Role-based access control (user/mod/admin/creator)
  │   ├─ Per-endpoint rate limiters
  │   ├─ Input sanitization (XSS, injection)
  │   ├─ SSRF prevention (URL validation)
  │   └─ Secure error responses (no stack traces)
  │
  ├─ Data Layer                                ← Layer 4: Data protection
  │   ├─ Parameterized queries (Prisma ORM)
  │   ├─ Server-only env vars (no NEXT_PUBLIC_ secrets)
  │   └─ Log redaction (PII, tokens, keys)
  │
  └─ Monitoring (src/lib/security/monitoring)  ← Layer 5: Detection
      ├─ Security event recording
      ├─ Anomaly thresholds + alerts
      └─ Audit trail for admin actions
```

---

## Security Audit Summary

### What Was Checked

| Area | Status | Details |
|------|--------|---------|
| **Secrets in repo** | PASS | `.env` in `.gitignore`; no hardcoded secrets in source |
| **Client bundle** | PASS | Zero `NEXT_PUBLIC_` secrets; all keys server-only |
| **API key exposure** | FIXED | Congress API key moved from env to server-only access |
| **Rate limiting** | ADDED | All 11 API routes now rate-limited per IP/user |
| **Input sanitization** | ADDED | XSS strip on all user content, SSRF block on URLs |
| **Auth hardening** | ADDED | Strong password policy, lockout, session cookies |
| **CSRF protection** | ADDED | Double-submit cookie pattern via middleware |
| **Security headers** | ADDED | CSP, HSTS, X-Frame-Options, Permissions-Policy |
| **Error handling** | FIXED | Generic errors only; no stack traces in production |
| **Log redaction** | ADDED | Tokens, keys, PII auto-redacted from logs |
| **Admin RBAC** | PRESENT | Server-side role check + client guard |
| **Dependency audit** | DONE | 8 moderate vulns (transitive Prisma deps) |
| **Monitoring** | ADDED | Security event tracking + anomaly alerting |

### What Was Fixed

1. **All 11 API routes hardened** with rate limiting, input validation, sanitization, and safe error responses
2. **Middleware created** enforcing security headers, rate limits, CSRF, and CORS on every request
3. **Auth system hardened** with strong password policy (10+ chars, complexity), progressive lockout (5 attempts → 15 min), session cookies for API auth
4. **Secure logger** with automatic redaction of tokens, keys, JWTs, and email addresses
5. **SSRF prevention** — all user-supplied URLs validated against private IP ranges
6. **next.config.ts** hardened — `poweredByHeader: false`, strict image policy, cache headers, server actions origin restriction
7. **`.env.example`** created for safe onboarding without exposing real secrets
8. **Security monitoring** with event recording, anomaly detection, and alert thresholds

### Known Remaining Items (Production Prerequisites)

| Item | Priority | Effort |
|------|----------|--------|
| Replace mock auth with real server-side auth (bcrypt/argon2 + JWT) | **P0** | Medium |
| Move session to HttpOnly server-set cookie | **P0** | Medium |
| Add email verification on signup | **P1** | Medium |
| Add 2FA/passkeys for admin accounts | **P1** | Medium |
| Move rate limiter to Redis for multi-instance | **P1** | Low |
| Add HaveIBeenPwned password check | **P2** | Low |
| Configure CDN/WAF (Cloudflare or Vercel) | **P1** | Low |
| Set up external SIEM (Datadog/Sentry) | **P1** | Low |
| Add file upload validation (avatars) | **P2** | Low |
| Job queue for heavy tasks (notifications, AI summarization) | **P2** | Medium |

---

## Go-Live Security Checklist

### Pre-Deployment (Must Pass)

- [ ] **Secrets**: `.env` is NOT in git; verify with `git log --all -- .env`
- [ ] **Secrets**: All API keys rotated since any dev exposure
- [ ] **Secrets**: `SESSION_SECRET` set to a random 64-char hex
- [ ] **Auth**: Mock auth replaced with real bcrypt/argon2 + server sessions
- [ ] **Auth**: Admin accounts require 2FA or strong passphrase
- [ ] **Headers**: CSP active and tested (check browser console for violations)
- [ ] **Headers**: HSTS enabled with `includeSubDomains; preload`
- [ ] **TLS**: HTTPS enforced; HTTP redirects to HTTPS
- [ ] **TLS**: TLS 1.2+ only; no SSLv3/TLS 1.0/1.1
- [ ] **CORS**: Only production domains in allowlist
- [ ] **Rate limits**: Tested under load; thresholds tuned
- [ ] **Dependencies**: `npm audit` shows 0 high/critical
- [ ] **Build**: `NODE_ENV=production` in deployment
- [ ] **Logs**: No secrets/PII in production logs (verify with log sample)
- [ ] **Error pages**: Custom 500 page with no stack traces
- [ ] **Database**: Encryption at rest enabled
- [ ] **Database**: Connection uses SSL (`?sslmode=require`)
- [ ] **Backups**: Automated DB backups with tested restore

### Post-Deployment Verification

- [ ] Test login with wrong password (verify lockout)
- [ ] Test rate limiting (verify 429 responses)
- [ ] Test CSRF (verify POST without token fails)
- [ ] Test admin access with non-admin user (verify 403)
- [ ] Test XSS payload in post creation (verify stripped)
- [ ] Test SSRF with internal URL in article link (verify rejected)
- [ ] Check response headers with `curl -I https://yourdomain.com`
- [ ] Check CSP violations in browser dev tools
- [ ] Verify monitoring alerts fire (simulate auth failures)

---

## Incident Response Playbook

### Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| **P0 Critical** | Active exploit, data breach, total outage | < 15 min | Credential leak, SQL injection, DDoS |
| **P1 High** | Security vulnerability, partial outage | < 1 hour | Auth bypass, rate limit failure |
| **P2 Medium** | Suspicious activity, degraded service | < 4 hours | Unusual login patterns, API errors |
| **P3 Low** | Informational, minor issue | < 24 hours | Dependency vulnerability, config drift |

### Playbook: Credential Exposure

```
1. IMMEDIATELY rotate all affected keys:
   - CONGRESS_API_KEY: Generate new at https://api.congress.gov/sign-up/
   - DATABASE_URL: Generate new Prisma connection URL
   - SESSION_SECRET: openssl rand -hex 32
   
2. Invalidate all active sessions:
   - Clear session store / database
   - Force re-login for all users
   
3. Purge caches:
   - CDN cache purge
   - Application cache clear (restart pods/instances)
   
4. Audit:
   - Check git history: git log --all --diff-filter=A -- '*.env' '*.key' '*.pem'
   - Check deployment logs for secret exposure
   - Review access logs for unauthorized usage
   
5. Notify:
   - Internal security team
   - Affected users (if PII exposed)
   - Legal/compliance (if required by regulation)
```

### Playbook: DDoS / Service Degradation

```
1. Enable lockdown mode (admin dashboard):
   - Increases rate limits to aggressive levels
   - Disables non-essential features
   - Shows maintenance page for anonymous users
   
2. Activate CDN/WAF protections:
   - Cloudflare: Enable "Under Attack" mode
   - Increase challenge threshold
   - Block offending IPs/ASNs
   
3. Scale infrastructure:
   - Increase instance count (auto-scaling)
   - Enable read replicas for database
   
4. Monitor:
   - Watch request rates, error rates, latency
   - Identify attack patterns (IPs, user agents, endpoints)
   
5. Post-incident:
   - Add identified IPs to block list
   - Review rate limit thresholds
   - Update WAF rules
```

### Playbook: Suspected Account Takeover

```
1. Lock affected account(s):
   - Disable login
   - Invalidate all sessions for user
   
2. Preserve evidence:
   - Export audit log for affected user
   - Capture recent IP addresses, user agents
   
3. Notify user:
   - Send email to verified email address
   - Require identity verification before re-enabling
   
4. Investigate:
   - Check for password reuse (HaveIBeenPwned)
   - Check for session hijacking (multiple IPs)
   - Check for phishing indicators
   
5. Remediate:
   - Force password reset
   - Enable 2FA requirement
   - Review and revert unauthorized actions
```

### Pause Posting / Notifications

For emergencies (coordinated abuse, election interference):

```
1. Admin Dashboard → Election Mode ON
   - Increases posting cooldowns to 60 seconds
   - Enables enhanced misinformation detection
   - Requires sources for election-related claims
   
2. For full lockdown:
   - Admin Dashboard → Lockdown Mode
   - Disables all user-generated content creation
   - Shows read-only view
   - Only admins can post
   
3. Status communication:
   - Update /status page
   - Post announcement via admin account
   - Tweet/social media notification
```

---

## Secrets Rotation Plan

### Rotation Schedule

| Secret | Rotation Frequency | Method |
|--------|--------------------|--------|
| `SESSION_SECRET` | Every 90 days | Generate with `openssl rand -hex 32` |
| `CONGRESS_API_KEY` | Every 180 days | Re-register at api.congress.gov |
| `DATABASE_URL` | Every 90 days | Rotate via cloud provider console |
| API tokens (future) | Every 30 days | Automated via CI/CD |

### Emergency Rotation

If ANY secret is suspected compromised:

1. Generate new secret immediately
2. Update in secrets manager / deployment env
3. Deploy with new secret
4. Verify old secret no longer works
5. Audit access logs for unauthorized usage
6. Document in incident postmortem
