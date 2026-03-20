# Civic Social — System Architecture Manual

**Application:** Civic Social
**Document Type:** Deep-Dive System Architecture & Operations Manual
**Version:** 1.0
**Date:** March 20, 2026
**Scope:** Complete platform — frontend, backend, database, auth, integrations, algorithms

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [User Types and Permissions](#3-user-types-and-permissions)
4. [Route and Page Map](#4-route-and-page-map)
5. [Feature Inventory](#5-feature-inventory)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Authentication System](#7-authentication-system)
8. [Backend / API Logic](#8-backend--api-logic)
9. [Database / Data Model](#9-database--data-model)
10. [Major User Flows](#10-major-user-flows)
11. [Feed Algorithm](#11-feed-algorithm)
12. [Integrations / External Services](#12-integrations--external-services)
13. [Error Handling / Edge Cases](#13-error-handling--edge-cases)
14. [Performance / Maintainability / Scalability](#14-performance--maintainability--scalability)
15. [Why the System Works](#15-why-the-system-works)
16. [File and Folder Map](#16-file-and-folder-map)
17. [Design System](#17-design-system)
18. [Glossary](#18-glossary)
19. [Appendix](#19-appendix)

---

## 1. Executive Summary

Civic Social is a civic engagement platform designed for evidence-based political discourse. It combines social networking (posting, following, commenting, reacting) with real-time legislative tracking from Congress.gov, structured debates with voice chat, and a transparent feed algorithm that prioritizes civility and source quality over engagement metrics.

### Who It Serves
- **Citizens** who want to discuss policy grounded in facts
- **Experts/Journalists** who want verified credibility and audience
- **Moderators/Admins** who manage content quality and user safety

### Major Capabilities
- Post creation with real-time civility scoring
- Algorithmic feed ranked by civility (25%), source quality, viewpoint diversity
- Live legislation tracker powered by Congress.gov API
- Structured debates with WebRTC voice chat
- Credibility scoring (0-100) based on 6 behavioral factors
- Admin moderation dashboard with audit trail
- Verified identity tiers (Email → Citizen → Expert → Official)

### Tech Stack
- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4, Motion (animation)
- **Backend:** Next.js API routes (serverless), Edge middleware
- **Database:** PostgreSQL (Neon) via Prisma ORM 7
- **Auth:** Custom HMAC-SHA256 signed HttpOnly cookies
- **Email:** Resend (transactional)
- **3D:** Three.js + React Three Fiber (landing page)
- **Hosting:** Vercel
- **Testing:** Vitest + Playwright

---

## 2. System Overview

### Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│  BROWSER (Client)                                       │
│  ├─ React 19 + Next.js App Router                       │
│  ├─ AuthContext (localStorage + cookie recovery)         │
│  ├─ PostStoreContext (optimistic UI)                     │
│  ├─ NotificationContext (SSE + polling)                  │
│  └─ ThemeContext (dark/light)                            │
├─────────────────────────────────────────────────────────┤
│  EDGE MIDDLEWARE (Vercel Edge Runtime)                   │
│  ├─ Rate limiting (120 req/min/IP)                       │
│  ├─ Route protection (public vs private)                 │
│  ├─ Security headers (CSP, HSTS, X-Frame-Options)        │
│  ├─ CSRF double-submit validation                        │
│  ├─ CORS enforcement                                     │
│  └─ Session cookie refresh (sliding window)              │
├─────────────────────────────────────────────────────────┤
│  API ROUTES (Node.js Serverless Functions)               │
│  ├─ 41 endpoints across 10 domains                       │
│  ├─ Per-route rate limiters                               │
│  ├─ HMAC session verification via api-guard               │
│  ├─ Input sanitization (XSS, SSRF prevention)            │
│  └─ Civility scoring + credibility recomputation          │
├─────────────────────────────────────────────────────────┤
│  DATA LAYER                                              │
│  ├─ Prisma ORM → PostgreSQL (Neon)                       │
│  ├─ In-memory fallback stores (dev/demo mode)             │
│  ├─ Congress.gov API v3 (legislation)                     │
│  ├─ RSS feeds (news aggregation)                          │
│  └─ Resend API (email)                                    │
└─────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Custom auth over NextAuth** — Full control over session signing, cookie attributes, and role management. HMAC-SHA256 prevents forgery without JWT complexity.

2. **Dual-table user model** — `User` (profile data, reputation metrics) and `SearchableUser` (auth credentials, normalized search fields). Separation of concerns for search performance.

3. **Optimistic UI with server confirmation** — Posts appear instantly in the feed, then merge server data on confirmation. Failures roll back gracefully.

4. **In-memory fallback for all stores** — Every data store (posts, users, follows, debates, notifications) works without a database, enabling local development and graceful degradation.

5. **Civility-first algorithm** — Feed ranking weights civility at 25% (highest signal), intentionally deprioritizing engagement metrics that reward outrage.

---

## 3. User Types and Permissions

### Role Hierarchy

| Role | Access Level | How Assigned |
|------|-------------|--------------|
| `user` | Standard features: post, comment, follow, react | Default on signup |
| `moderator` | User features + report review | Manual DB update |
| `admin` | Moderator features + user management, audit logs | Manual DB update |
| `creator` | Full admin + platform configuration | Manual DB update |
| `banned` | No access (login blocked) | Admin action |

### Role Enforcement Points

- **Middleware** (`src/middleware.ts`): Decodes session cookie to check role for `/admin/*` routes. Redirects non-admin/creator to `/feed`.
- **API Guard** (`src/lib/security/api-guard.ts`): `requireAuth()`, `requireAdmin()`, `requireCreator()` verify HMAC-signed session on every protected API call.
- **Client** (`src/lib/auth-context.tsx`): `isAdmin`, `isCreator`, `isModerator` computed flags control UI rendering.

### Why This Works
- Roles are stored in `SearchableUser.role` column, read from DB on login, and signed into the session cookie
- The HMAC signature prevents client-side role elevation
- API routes verify the signature before trusting any role claim
- Middleware checks are a UX convenience (redirect), not a security boundary — API guards are the real enforcement

### What Would Break
- If `SESSION_SECRET` leaked, an attacker could forge any role
- If `requireAdmin()` were removed from an API route, that endpoint would be unprotected
- The middleware role check does NOT verify the HMAC signature (performance optimization for edge runtime) — if someone could tamper with the cookie payload without the signature check, they'd only see the wrong page briefly before API calls fail

---

## 4. Route and Page Map

### Public Pages (No Auth Required)

| Route | Purpose | Key Component |
|-------|---------|---------------|
| `/` | Landing page (logged out) or feed (logged in) | `LandingPage` / `FeedView` |
| `/login` | Email/password login | Login page |
| `/register` | 3-step signup flow | Register page |
| `/forgot-password` | Password reset request | Forgot password form |
| `/reset-password` | Set new password via token | Reset form |
| `/verify-email` | Email verification link handler | Redirect handler |
| `/how-it-works` | Platform explanation | Info page |
| `/safety` | Safety & privacy principles | Info page |
| `/contact` | Contact form | Form + FAQ |
| `/credibility` | Credibility score explanation | Info page |
| `/source-transparency` | News source trust methodology | Info page |
| `/profile/[username]` | Public user profile | Profile page |
| `/hashtag/[tag]` | Topic exploration | Posts + news by tag |

### Protected Pages (Auth Required)

| Route | Purpose | Key Component |
|-------|---------|---------------|
| `/feed` | Main timeline (implicit via `/`) | `FeedView` |
| `/profile` | Own profile with stats | Profile page |
| `/settings` | Account settings (10 sections) | Settings page |
| `/notifications` | Notification center | Notifications page |
| `/saved` | Bookmarked posts | Saved items page |
| `/search` | Search posts/people/news/debates | Search page |
| `/post/[postId]` | Post detail with comments | Thread page |
| `/debates` | Debate listings | Debate browser |
| `/debates/[debateId]` | Live debate with voice chat | Debate detail |
| `/labs` | Legislative tracker (featured + browse) | Legislation page |
| `/legislation/[country]/[congress]/[billType]/[billNumber]` | Bill detail | Bill page |
| `/news` | Curated news aggregation | News page |
| `/live` | Live civic events | Events page |
| `/appeals` | Content moderation appeals | Appeals page |

### Admin Pages (Admin/Creator Role Required)

| Route | Purpose |
|-------|---------|
| `/admin` | Trust & Safety dashboard (users, posts, reports, audit) |
| `/admin/legislation` | Congress API health monitoring |
| `/admin/guide` | Admin documentation |

### API Routes (41 Endpoints)

**Auth (7):** login, signup, register, logout, verify-email, forgot-password, reset-password
**Posts (4):** CRUD posts, comments, comment reactions
**Reactions (1):** Toggle agree/disagree/insightful/nuance + feedback
**Users (5):** Profile, avatar, banner, onboarding, connections
**Social (1):** Follow/unfollow/subscribe/unsubscribe
**Feed (2):** Personalized feed, check-new polling
**Debates (4):** CRUD debates, chat, voice signaling
**Admin (8):** Users, posts, reports, audit, stats, feedback
**Content (5):** Notifications (+ SSE stream), reports, legislation, news, hashtags
**Support (3):** Contact, health, env check

---

## 5. Feature Inventory

### 5.1 Post System
- **What it does:** Users create text posts (2000 char max) with optional topics, article URLs, and comment policies
- **Where it lives:** `src/components/compose/compose-modal.tsx` (UI), `src/app/api/posts/route.ts` (API), `src/lib/post-data-store.ts` (persistence)
- **Key dependencies:** Civility analyzer, credibility recomputer, mention parser, sanitization
- **Data flow:** User types → real-time civility check (client) → submit → server sanitizes + scores civility → creates `StoredPost` → records civility event → updates credibility → notifies @mentions
- **Comment policies:** `everyone` (default), `followers_only`, `off` — enforced server-side via `canComment()`

### 5.2 Feed Algorithm
- **What it does:** Ranks posts by quality (civility 25%, engagement 20%, diversity 15%, sources 15%, topics 15%, author reputation 10%) minus penalties
- **Where it lives:** `src/lib/algorithm/` (scoring, signals, diversity, types)
- **Key dependencies:** User following list, post civility scores, source trust scores, author credibility
- **Cold start:** New users (< 7 days) get topic/affiliation-matched feed via `generateColdStartFeed()`
- **Safety filters:** Removes posts with botLikelihood > 0.9, flagCount > 20, toxicityScore > 0.95
- **Diversity enforcement:** Sliding window ensures max 60% same political affiliation per 5 posts

### 5.3 Civility Scoring
- **What it does:** Analyzes text for hate speech, slurs, harassment, sarcasm, and constructive signals
- **Where it lives:** `src/lib/civility.ts` (analyzer), `src/lib/civility-events.ts` (durable logging)
- **Severity levels:** Critical (score floor 0.05 — slurs/violence), High (0.15 — dehumanization), Medium (-0.18 per issue), Low (-0.09 per issue)
- **Key design:** Events persist even if post is deleted. This prevents users from erasing violation history by deleting offending posts.

### 5.4 Credibility System
- **What it does:** Computes a 0-100 score based on 6 behavioral factors
- **Where it lives:** `src/lib/credibility-recompute.ts`
- **Factors:** Civil engagement (25%), Citation quality (25%), Report accuracy (15%), Cross-party engagement (15%), Verified identity (10%), Behavioral consistency (10%)
- **Recovery mechanism:** Critical violations cap score at 60; 5+ consecutive positive events raise cap by 2 points each (max 20 point recovery)
- **Minimum data:** Requires 3+ posts before recomputing; defaults to 50 until then

### 5.5 Legislation Tracker
- **What it does:** Fetches real bill data from Congress.gov API v3, generates plain-language summaries and impact analyses
- **Where it lives:** `src/lib/legislation/` (API client, AI summary, impact generator, canonical keys), `src/app/api/legislation/route.ts`, `src/components/legislative/`
- **Featured bills:** 8 hardcoded bills from 119th Congress (H.R. 1, S. 5, H.R. 22, etc.)
- **Caching:** In-memory with 15min TTL (2min for high-priority). Falls back to stale cache on API errors.
- **Data integrity:** `validateBillMatch()` detects when API returns wrong bill data. Never renders mismatched data.

### 5.6 Debates
- **What it does:** Structured debates with sides (A/B), timed stages, live chat, WebRTC voice
- **Where it lives:** `src/lib/debate-store.ts`, `src/lib/chat-store.ts`, `src/lib/voice-signaling.ts`, `src/components/debates/`
- **Status lifecycle:** waiting → live → paused → completed
- **Default stages:** Opening, Rebuttal, Cross-Examination, Closing, Sources
- **Chat moderation:** Profanity filtering, rate limiting, muting, spam detection, 500-char max

### 5.7 Social Graph
- **What it does:** Follow/unfollow users, subscribe to post notifications at 3 levels (all/debates/mentions)
- **Where it lives:** `src/lib/social-store.ts`, `src/app/api/follow/route.ts`
- **Notification types:** follow, like, reply, repost, mention, post_from_followed, debate_invite, civility_boost, post_removed, system
- **SSE streaming:** Real-time notifications via `/api/notifications/stream` with 25s heartbeat

### 5.8 Admin Dashboard
- **What it does:** User management (ban/suspend/unban), post moderation (remove/restore), report review, audit logging, platform statistics
- **Where it lives:** `src/app/admin/page.tsx`, `src/app/api/admin/`
- **Audit trail:** Every admin action logged to `AuditLog` table with actor, action, target, details, IP
- **Automated moderation:** 3+ reports → auto-flag; 5+ reports → auto-remove post

### 5.9 User Profiles & Settings
- **What it does:** Avatar/banner upload with client-side crop, bio editing, topic interests, theme preferences, privacy toggles, mute filters
- **Where it lives:** `src/app/settings/page.tsx`, `src/app/profile/page.tsx`, `src/app/api/me/`
- **Image processing:** Client crops to 256x256 (avatar) or 1200x400 (banner), converts to WebP, uploads as base64 data URL
- **Profile completion:** Tracks missing fields (bio, topics, country) and shows completion card

---

## 6. Frontend Architecture

### Component Organization

```
src/components/
├── auth/           # AuthGate (route protection wrapper)
├── compose/        # ComposeModal, ReplySheet
├── debates/        # CreateDebateModal, DebateComposer, LiveChat, VoiceChat
├── feed/           # FeedView, PostCard, ContextPanel, CredibilityMeter
├── landing/        # LandingPage, LandingNav, ScrollReveal
├── layout/         # Sidebar (main navigation)
├── legislative/    # BillCard, BillProgress, ImpactAnalysis, VoteTally, Timeline
├── moderation/     # ReportModal
├── onboarding/     # OnboardingCarousel
├── profile/        # (inline in page files)
├── settings/       # (inline in page files)
└── ui/             # Primitives: Skeleton, PullToRefresh, MentionText,
                    #   NotificationToast, CredibilityBadge, DeleteConfirmModal,
                    #   ImageCropModal, SplashScreen, BillOfRightsHero,
                    #   ContainerScrollAnimation
```

### State Management Architecture

**Layer 1: AuthContext (Global)**
- Source of truth for user identity
- Hydrates from localStorage (instant), then validates against server via `/api/me`
- Provides: `user`, `isAuthenticated`, `stats`, `onboardingDone`, `profileCompletion`

**Layer 2: PostStoreContext (Global)**
- Manages current user's posts with optimistic UI
- Watches `user.id` from AuthContext
- Hydrates from `/api/posts?author=<id>` on mount
- Provides: `addPost()`, `confirmPost()`, `removePost()`, `markPostFailed()`

**Layer 3: NotificationContext (Global)**
- Badge count + toast notifications
- Primary: SSE stream from `/api/notifications/stream`
- Fallback: 60s polling
- Provides: `unreadCount`, `markAllRead()`, `soundEnabled`

**Layer 4: ThemeContext (Global)**
- Dark/light/system preference
- Stored in localStorage, applied as HTML class
- Flash prevention via inline script before React hydration

**Layer 5: Component State (Local)**
- FeedView: `feed`, `loading`, `activeTab`, `sortMode`, `pendingNewIds`
- PostCard: `viewerReaction`, `reactionDeltas`, `expanded`, `showAlgorithm`
- ComposeModal: useReducer for complex form (content, topics, civility, mentions, policy)

### Rendering Patterns

- **Server Components:** Layout files, metadata generation
- **Client Components:** All interactive pages (marked `"use client"`)
- **Optimistic Updates:** Posts appear immediately with `_optimistic: true`, confirmed or rolled back on server response
- **Staggered Animations:** PostCards animate in with `animationDelay: ${index * 60}ms`
- **Pull-to-Refresh:** Touch gesture tracking with pointer events on profile page

---

## 7. Authentication System

### Login Flow (End-to-End)

```
1. Client validates email format + password length
2. Client checks lockout (5 attempts / 15 min)
3. POST /api/auth/login { email, password }
4. Server: rate limit check (authLimiter: 5/15min/IP)
5. Server: lookup SearchableUser by email
6. Server: verify PBKDF2-SHA512 hash (100K iterations, constant-time)
7. Server: check suspension/ban status
8. Server: sign session { id, email, role, displayName, iat } with HMAC-SHA256
9. Server: set HttpOnly cookie (civic-session, Secure, SameSite=Strict, 24h)
10. Client: store user in localStorage (UI state only)
11. Client: fetch /api/me for authoritative stats (followers, posts, credibility)
```

### Session Cookie Design

| Attribute | Value | Purpose |
|-----------|-------|---------|
| Name | `civic-session` | Identifies session |
| HttpOnly | `true` | JS cannot read (XSS-proof) |
| Secure | `true` (prod) | HTTPS only |
| SameSite | `Strict` | No cross-site requests (CSRF-proof) |
| MaxAge | 86400 (24h) | Auto-expire |
| Path | `/` | Available to all routes |

**Token format:** `base64url(JSON_payload).base64url(HMAC-SHA256_signature)`

### Session Recovery (Cold Start)

1. On mount: read localStorage → show content immediately (no splash delay)
2. Background: fetch `/api/me` to get server-authoritative data
3. If no localStorage: try recovering from HttpOnly cookie via `/api/me`
4. If `civic-just-logged-out` flag in sessionStorage: skip recovery

### Password Security

- **Hashing:** PBKDF2-SHA512, 100,000 iterations, 16-byte random salt
- **Comparison:** Constant-time (`timingSafeEqual`) prevents timing attacks
- **Validation:** Min 10 chars, requires uppercase/lowercase/digit/special, rejects common passwords and email substrings

### CSRF Protection

- **Primary:** SameSite=Strict cookie (browser won't send cross-origin)
- **Secondary:** Double-submit pattern — `__csrf` cookie + `x-csrf-token` header must match
- **Scope:** Only checked on cross-origin POST/PUT/PATCH/DELETE

### Security Headers (Middleware)

| Header | Value |
|--------|-------|
| Content-Security-Policy | `default-src 'self'`, script-src with nonces |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` |
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `DENY` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | Disables camera/mic/geolocation except self |

---

## 8. Backend / API Logic

### Request Lifecycle

Every API request follows this path:

```
1. Edge Middleware
   ├─ Global rate limit (120 req/min/IP)
   ├─ Security headers applied
   ├─ CORS validation (production whitelist)
   ├─ CSRF token check (mutating requests)
   ├─ Session cookie refresh (if >50% expired)
   └─ Route protection (redirect if no session)

2. API Route Handler
   ├─ Per-route rate limit check
   ├─ Session verification: getSessionUser() → HMAC verify
   ├─ Input parsing + validation
   ├─ Sanitization (sanitizeText, sanitizeUrl, sanitizeTopics)
   ├─ Business logic execution
   ├─ Database operations (Prisma)
   ├─ Side effects (notifications, credibility, audit)
   └─ JSON response with appropriate status code
```

### Rate Limiting Configuration

| Limiter | Limit | Window | Scope |
|---------|-------|--------|-------|
| Global | 120 req | 60s | Per IP |
| Auth (login) | 5 attempts | 15 min | Per IP |
| Signup | 3 signups | 60 min | Per IP |
| Posts | 10 posts | 60 min | Per user |
| Social (follow) | 30 actions | 60 min | Per user |
| Chat | 30 messages | 60s | Per user |
| Read | 60 req | 60s | Per IP |
| Password reset | 3 attempts | 60 min | Per email |

### Input Sanitization

All user input passes through `src/lib/security/sanitize.ts`:
- **Text:** Strips HTML tags, `javascript:` URIs, `on*` event handlers, normalizes whitespace
- **URLs:** Validates format, blocks private IPs (SSRF prevention: 10.*, 172.16-31.*, 192.168.*, localhost)
- **Display names:** Letters/numbers/spaces/hyphens only, max 50 chars, profanity check
- **Topics:** Max 10 items, 50 chars each, lowercase

### Key API Patterns

**Post Creation (`POST /api/posts`):**
1. Auth required, rate limited
2. Sanitize content, topics, URL
3. Compute civility score SERVER-SIDE (never trust client)
4. Create `StoredPost` in database
5. Record `CivilityEvent` (persists even if post deleted later)
6. Update credibility score (fire-and-forget)
7. Extract @mentions, send notifications (max 10)
8. Return full post object

**Feed Generation (`GET /api/feed`):**
1. Fetch all published posts (DB + mock)
2. Safety filter (remove bots, flagged, toxic)
3. If "for-you": run algorithm (score + diversity re-rank)
4. If "following": filter to followed accounts
5. If "latest": sort chronologically
6. Batch-fetch comment counts (single SQL query)
7. Serialize with algorithm explanation + tags

---

## 9. Database / Data Model

### Entity Relationship Overview

```
User (1) ──── (N) Post
  │                 │
  │                 ├── (N) StoredComment
  │                 ├── (N) Reaction
  │                 ├── (N) Source
  │                 └── (N) Report
  │
  ├── (N) Follow ──── (1) User
  ├── (N) Notification
  ├── (N) UserAffiliation ──── (1) PoliticalParty
  ├── (N) CivilityEvent
  ├── (N) AuditLog
  └── (1) SearchableUser (denormalized mirror)

Thread (1) ──── (N) Post
Debate (1) ──── (N) VoiceRoom
             └── (N) VoiceSignal
```

### Core Tables

#### User
- **Purpose:** Full user profile with reputation metrics
- **Key fields:** id, email (unique), username (unique), displayName, avatar (base64), bannerUrl, bio, country, verificationLevel, civicReputation (0-1), civilityAvg, accuracyScore, crossPartyEngagement
- **Read by:** Profile pages, post author enrichment, credibility computation
- **Written by:** Signup, settings updates, credibility recomputer

#### SearchableUser
- **Purpose:** Auth credentials + search-optimized user discovery
- **Key fields:** id, email (unique), passwordHash, displayName, username, displayNameNorm, usernameNorm, role, suspendedUntil, credibilityScore (0-100), followerCount, followingCount, postCount, onboardingCompletedAt
- **Why separate:** Normalized fields for search performance; password hash isolated from profile data
- **Sync with User:** Manual upsert via `registerUser()` — not automatic

#### StoredPost
- **Purpose:** User-created post persistence
- **Key fields:** id, authorId, content, topics[], articleUrl, civilityScore, status (published/pending_review/removed), deletedAt, visibility, comment_policy, is_thread_locked, postType
- **Soft delete:** Sets deletedAt + content='[deleted]' (preserves audit trail)

#### StoredComment
- **Purpose:** Comments on posts with threading
- **Key fields:** id, postId (cascade delete), authorId, parentCommentId (for nesting), body, status, deletedAt
- **Cascade:** Deleting a StoredPost cascades to its comments

#### Follow
- **Purpose:** Social graph edges
- **Key fields:** followerId, followingId, createdAt
- **Constraint:** Unique on [followerId, followingId]

#### CivilityEvent
- **Purpose:** Durable behavioral history (persists even if post deleted)
- **Key fields:** userId, postId (optional), eventType (violation/positive/neutral), severity, category, score, details (JSON)
- **Critical design:** Used by credibility engine. Hard ceilings on scores for users with critical violations.

#### Debate
- **Purpose:** Structured debate state (serverless-reliable)
- **Key fields:** id, title, creatorId, sideALabel/sideBLabel, status (waiting/live/paused/completed), durationMinutes, stages[], participantsJson (JSON), spectatorCount

#### Notification
- **Purpose:** DB-persisted notifications (survives cold starts)
- **Key fields:** recipientUserId, actorUserId, type, entityType, entityId, metadata (JSON), readAt, seenAt

### Data Flow Patterns

**Source of Truth by Feature:**

| Feature | Source of Truth | Cache Layer |
|---------|----------------|-------------|
| User identity | HttpOnly `civic-session` cookie | localStorage (UI only) |
| User profile | User + SearchableUser tables | In-memory (auth-context) |
| Posts | StoredPost table | PostStore (client optimistic) |
| Follow graph | Follow table | social-store.ts (in-memory) |
| Reactions | In-memory reaction-store | None (not persisted!) |
| Credibility | SearchableUser.credibilityScore | Computed on demand |
| Notifications | Notification table | notification-context (polling) |
| Legislation | Congress.gov API | In-memory cache (15min TTL) |
| Debates | Debate table | debate-store.ts (per-instance cache) |

---

## 10. Major User Flows

### 10.1 User Signup

```
1. User fills email, password, display name on /register
2. Client validates: email format, password strength (10+ chars, mixed case,
   digit, special), display name (2-50 chars, no profanity)
3. POST /api/auth/signup
4. Server: rate limit (3/hour/IP)
5. Server: validate password against 28 common passwords + email substring
6. Server: sanitize display name (strip HTML, special chars)
7. Server: check profanity/slurs via regex patterns
8. Server: check email + display name uniqueness (case-insensitive)
9. Server: generate ID: user-{UUID-without-hyphens, first 16 chars}
10. Server: hash password (PBKDF2-SHA512, 100K iterations, 16-byte salt)
11. Server: create SearchableUser + User records
12. Server: generate email verification token (32 bytes, 24h expiry)
13. Server: send verification email via Resend (async, non-blocking)
14. Server: sign session cookie, set on response
15. Client: store user in localStorage, redirect to onboarding
16. Onboarding: country, political affiliation, topic interests
17. POST /api/me/onboarding to persist choices
```

### 10.2 Post Creation

```
1. User opens compose modal (Cmd+N or button click)
2. Types content — civility check runs every 300ms (client-side, informational)
3. If civility < 0.8: auto-show civility panel with issues
4. Selects topics (preset list + custom hashtags)
5. Optionally attaches article URL
6. Sets comment policy (everyone/followers_only/off)
7. Clicks "Post" (or Cmd+Enter)
8. CLIENT: addPost() creates optimistic UserPost (_optimistic: true)
9. CLIENT: post appears immediately in feed with spinner
10. POST /api/posts { content, topics, articleUrl, comment_policy }
11. SERVER: sanitize text, topics, URL (SSRF check)
12. SERVER: compute civility score (AUTHORITATIVE — never trust client)
13. SERVER: create StoredPost in database
14. SERVER: record CivilityEvent (durable behavioral log)
15. SERVER: update credibility score incrementally
16. SERVER: extract @mentions, send notifications (max 10)
17. CLIENT on 200: confirmPost() merges server data, clears _optimistic
18. CLIENT on error: removePost() or markPostFailed(), show error toast
19. CLIENT: refreshMe() to update post count, then full feed refresh
```

### 10.3 Feed Loading & Polling

```
1. FeedView mounts → fetchFeed()
2. GET /api/feed?tab=for-you&sort=top
3. Server fetches all published posts + mock data
4. Safety filter removes bots/flagged/toxic
5. Algorithm scores each post (7 signals × weights)
6. Diversity re-rank (max 60% same affiliation per 5-post window)
7. Batch-fetch comment counts (single SQL groupBy)
8. Serialize with algorithm explanations
9. Client receives feed, merges with optimistic posts (dedup by ID)
10. Every 30s: poll /api/feed/check-new?since=lastFetchTime&excludeIds=...
11. If new posts found: show floating "N new posts" pill
12. User taps pill → scroll to top → full feed refresh
```

### 10.4 Following a User

```
1. User visits /profile/[username]
2. GET /api/follow?target=userId → returns isFollowing, counts
3. User clicks "Follow" button
4. CLIENT: optimistic update (button shows "Following")
5. POST /api/follow { action: 'follow', target_user_id }
6. SERVER: validate not following self
7. SERVER: dbFollow() — upsert Follow record + update in-memory cache
8. SERVER: create 'follow' notification for target user
9. SERVER: push SSE event to target (real-time badge update)
10. CLIENT on 200: update follower count display
11. CLIENT on error: rollback to "Follow" button, show toast
```

### 10.5 Admin Post Removal

```
1. Admin navigates to /admin → Posts tab
2. Searches/filters posts by status
3. Clicks "Remove" on a post
4. PATCH /api/admin/posts/[postId] { action: 'remove', reason: 'misinformation' }
5. SERVER: requireAdmin() verifies role
6. SERVER: setPostStatus(postId, 'removed')
7. SERVER: logAuditAction() → AuditLog table
8. SERVER: dbCreateNotification() → notify post author (type: post_removed)
9. Post disappears from feed for all users
10. Author sees notification: "Your post was removed for: misinformation"
```

---

## 11. Feed Algorithm

### Signal Weights

| Signal | Weight | What It Measures |
|--------|--------|-----------------|
| Civility | 25% | Post civility score (slurs, tone, constructiveness) |
| Engagement Quality | 20% | Insightful/nuance reactions, substantive replies, read completion |
| Viewpoint Diversity | 15% | Cross-party engagement, ideology distance from viewer |
| Source Credibility | 15% | Trust scores of cited sources, multi-source bonus |
| Topic Relevance | 15% | Jaccard similarity with user's topic interests |
| Author Reputation | 10% | Credibility score, verification level, accuracy |
| **Penalty** | **-1.5x** | Bot likelihood, flags, toxicity, spam patterns, all-caps |

### Quality Score Formula

```
Q = Σ(wᵢ × Sᵢ) − P × 1.5
```

Where S₁-S₆ are normalized signals (0-1) and P is the penalty signal.

### What the Algorithm Never Does
- Never amplifies outrage or engagement bait
- Never hides content based on political viewpoint
- Never weights "time spent" (no doomscrolling incentive)
- Never uses social proof alone (likes don't dominate ranking)
- Explanation is transparent: every post shows "Why you're seeing this"

### Cold Start Feed
- Users < 7 days old get `generateColdStartFeed()` instead of full algorithm
- Matches posts to declared interests (topics, affiliation, country)
- Ensures diverse perspectives (not echo chamber)
- Warmup progress tracked (0% → 100% as user generates data)

---

## 12. Integrations / External Services

### Congress.gov API v3
- **Purpose:** Real-time legislative data (bills, sponsors, actions, summaries)
- **Endpoints used:** `/bill/{congress}/{billType}/{billNumber}`, `/actions`, `/cosponsors`, `/summaries`
- **Auth:** API key via `CONGRESS_API_KEY` env var
- **Caching:** In-memory, 15min TTL (2min for high-priority)
- **Fallback:** Stale cache → demo data → "unavailable" marker
- **Health monitoring:** Success rate, latency tracking, mismatch detection
- **What would break:** Without API key, legislation tracker shows demo data with "[Demo]" marker

### Resend (Email)
- **Purpose:** Password reset and email verification emails
- **Auth:** `RESEND_API_KEY` env var
- **Fallback:** If API key not set, logs to console (never crashes signup flow)
- **Templates:** Professional HTML emails with branding

### Neon PostgreSQL
- **Purpose:** Primary data persistence
- **Connection modes:** Direct TCP (`DIRECT_URL`) for local dev, Prisma Accelerate (`DATABASE_URL`) for Vercel
- **Fallback:** All stores have in-memory alternatives when DB unavailable
- **What would break:** Without DB, data is ephemeral (lost on restart). Auth still works (session cookie is self-contained).

### Vercel
- **Purpose:** Hosting, edge middleware, serverless functions
- **Speed Insights:** Performance monitoring via `@vercel/speed-insights`
- **Edge Runtime:** Middleware runs at edge for low-latency security checks

### RSS Feeds (News)
- **Purpose:** News aggregation from AP, Reuters, NPR, PBS, BBC
- **Refresh:** 15-minute cooldown between fetches
- **Topic detection:** Keyword matching (healthcare, economy, climate, etc.)

---

## 13. Error Handling / Edge Cases

### Authentication Failures
- **Wrong password:** Generic "Invalid email or password" (no enumeration)
- **Suspended account:** "Your account is suspended until [date]"
- **Banned account:** "Your account has been permanently banned"
- **Rate limited:** 429 with `Retry-After` header
- **Expired session:** 401, client redirects to login

### Post Creation Failures
- **Content too long:** 400 "Content exceeds 2000 characters"
- **Failed sanitization:** 400 with specific error
- **Rate limited:** 429, compose modal stays open with content preserved
- **Server error:** Post marked `_failed: true`, shown with red border, retry available

### Feed Failures
- **DB unavailable:** Falls back to mock data
- **No posts:** Empty state with helpful message per tab
- **Polling failure:** Silent retry on next interval (30s)

### Legislation Failures
- **API rate limited (429):** Return stale cache with "Rate limited" indicator
- **API error (5xx):** Return stale cache with error message
- **Data mismatch:** Detected by canonical key validation, logged, stale data shown
- **No API key:** Demo data with "[Demo]" marker

### Missing/Fragile Areas
- **In-memory reactions:** Lost on server restart (should use Reaction table)
- **In-memory chat messages:** Lost on cold start (debate chat history ephemeral)
- **Rate limiter not distributed:** Single-instance only; needs Redis for multi-instance
- **SearchableUser ↔ User sync:** Manual upsert, not automatic — can drift
- **Mute filters:** UI exists in settings but not persisted or enforced in feed

---

## 14. Performance / Maintainability / Scalability

### Strengths
- **Batch comment counts:** Single SQL `groupBy` instead of N+1 queries
- **Optimistic UI:** Posts/reactions appear instantly, no perceived latency
- **React.memo on PostCard:** Prevents unnecessary re-renders
- **useMemo for feed merging:** Dedup only recomputes when dependencies change
- **Staggered animations:** `animationDelay` based on index, not scroll position
- **Pull-to-refresh:** Native-feeling gesture with pointer events
- **Debounced civility check:** 300ms delay prevents excessive computation

### Weaknesses
- **In-memory stores on serverless:** Data lost on cold starts. Rate limiter, reactions, chat messages, deleted posts tracking — all ephemeral. Redis or DB migration needed.
- **Base64 image storage:** Avatar/banner stored as data URLs in database rows. Should use object storage (S3/Vercel Blob) for images > 100KB.
- **No pagination cursor in feed API:** Returns up to 100 posts but no `hasMore` flag or cursor for infinite scroll.
- **Dual user tables:** SearchableUser and User can drift. Consider merging or adding automatic sync triggers.

### Scaling Concerns
- **Rate limiter needs Redis:** In-memory Map won't work across multiple Vercel serverless instances. Upstash or AWS ElastiCache recommended.
- **Reaction persistence:** Currently in-memory only. Will lose all reaction data on restart. Should use Prisma Reaction table.
- **Feed algorithm is O(n):** Scores every published post. At 100K+ posts, needs pre-computation or index-based filtering.
- **Congress API rate limits:** 500 requests/hour. Heavy traffic could exhaust quota. Consider caching in database with longer TTLs.

---

## 15. Why the System Works

### Why Auth Persists Correctly
The HttpOnly cookie is the single source of truth. Even if localStorage is cleared, the cookie persists across tabs and survives page refreshes. The HMAC signature ensures only the server can create valid sessions. The client localStorage is a speed optimization (show content before verifying), not a security mechanism.

### Why the Feed Shows Correct Data
The feed merges two sources: server posts (from `/api/feed`) and client optimistic posts (from PostStore). Deduplication happens by post ID — server posts take priority. The `renderedIdsRef` tracks what's displayed, so the polling endpoint excludes those IDs to find genuinely new posts.

### Why Route Protection Works
Three layers enforce it: (1) Middleware redirects unauthenticated users from protected paths, (2) AuthGate component renders nothing until auth resolves, (3) API routes call `requireAuth()` which verifies the HMAC signature. Even if layers 1 and 2 fail, layer 3 prevents data access.

### Why Civility Scoring Can't Be Gamed
- Client civility scores are informational only — the server recomputes independently
- CivilityEvents persist even after post deletion (can't erase violations)
- Critical violations have hard score ceilings that bonuses cannot override
- Recovery requires sustained positive behavior (5+ consecutive good events)

### Why a User Only Sees Their Own Data
- Session cookie contains user ID, verified by HMAC
- API routes use `getSessionUser()` to extract the authenticated user
- Database queries filter by `authorId` or `userId` matching the session
- Profile edits check `session.id === targetId` before allowing writes

### Why Credibility Scores Are Fair
- 6 independent factors reduce single-point manipulation
- Cross-party engagement rewards diverse interaction
- Citation quality rewards evidence-based posting
- Minimum 3 posts required before scoring (prevents empty-profile gaming)
- Durable civility events mean violations can't be erased

---

## 16. File and Folder Map

### Most Important Files (Read These First)

```
src/
├── middleware.ts                    # Edge security: rate limits, headers, CORS, CSRF
├── app/
│   ├── layout.tsx                  # Root: providers, metadata, fonts
│   ├── page.tsx                    # Home: landing or feed (conditional)
│   ├── app-shell.tsx              # Splash screen + perf monitoring
│   └── api/
│       ├── auth/login/route.ts    # Login endpoint
│       ├── auth/signup/route.ts   # Signup endpoint
│       ├── posts/route.ts         # Post CRUD
│       ├── feed/route.ts          # Feed algorithm
│       └── me/route.ts            # User bootstrap
├── lib/
│   ├── auth-context.tsx           # Client auth state (START HERE)
│   ├── post-store.tsx             # Client optimistic posts
│   ├── post-data-store.ts         # Server post persistence
│   ├── user-registry.ts           # User lookup/search
│   ├── social-store.ts            # Follow graph + notifications
│   ├── civility.ts                # Civility analyzer
│   ├── credibility-recompute.ts   # Credibility scoring
│   ├── db.ts                      # Prisma client init
│   ├── algorithm/                 # Feed ranking engine
│   │   ├── index.ts              # Pipeline entry
│   │   ├── scoring.ts            # Signal computation
│   │   ├── signals.ts            # 7 signal definitions
│   │   └── diversity.ts          # Re-ranking for diversity
│   ├── security/                  # Auth & security
│   │   ├── session.ts            # HMAC session signing
│   │   ├── api-guard.ts          # Route protection
│   │   ├── hash.ts               # PBKDF2 password hashing
│   │   ├── sanitize.ts           # Input sanitization
│   │   └── rate-limiter.ts       # Rate limiting
│   └── legislation/              # Congress.gov integration
│       ├── congress-api.ts       # API client + caching
│       └── canonical-key.ts      # Bill identification
├── components/
│   ├── feed/feed-view.tsx         # Main feed UI
│   ├── feed/post-card.tsx         # Individual post
│   ├── compose/compose-modal.tsx  # Post creation
│   └── landing/landing-page.tsx   # Public landing
└── prisma/
    └── schema.prisma              # Database schema (17+ models)
```

### Folder Purposes

| Folder | Purpose |
|--------|---------|
| `src/app/` | Next.js App Router pages + API routes |
| `src/lib/` | Business logic, data stores, algorithms, security |
| `src/lib/security/` | Auth, hashing, rate limiting, sanitization, CSRF |
| `src/lib/algorithm/` | Feed ranking engine (scoring, signals, diversity) |
| `src/lib/legislation/` | Congress.gov API integration |
| `src/components/` | React UI components organized by feature |
| `src/components/ui/` | Reusable primitives (skeletons, modals, badges) |
| `prisma/` | Database schema and migrations |
| `public/` | Static assets (video, images) |

---

## 17. Design System

### Color Palette

**Dark Mode (Default):**
- Backgrounds: `#141414` → `#191919` → `#1e1e1e` → `#262626`
- Text: `#f0f0f0` (primary), `#a0a0a0` (secondary), `#666666` (muted)
- Brand (Civic): `#6366F1` (Indigo), `#818CF8` (light), `#4F46E5` (dark)

**Semantic Colors:**
- Positive: `#10B981` (Emerald) — success, verified
- Warning: `#F59E0B` (Amber) — caution, pending
- Danger: `#EF4444` (Red) — errors, violations
- Info: `#3B82F6` (Blue) — informational

**Political Spectrum:**
- Left: `#818CF8` (Indigo)
- Center-Left: `#A78BFA` (Purple)
- Center: `#C4B5FD` (Violet)
- Center-Right: `#FB923C` (Orange)
- Right: `#F87171` (Red)

### Typography
- **Sans:** Inter (primary — all UI text)
- **Mono:** JetBrains Mono (code, technical content)
- **Scale:** 12px → 14px → 16px → 20px → 24px → 30px → 36px

### Motion
- **Easing:** `ease-decel` for entries, `ease-accel` for exits, `ease-spring` for bounce
- **Durations:** 100ms (instant) → 150ms (fast) → 250ms (normal) → 350ms (slow)
- **Reduced motion:** Full `prefers-reduced-motion` support throughout

### Key Animations
- `fadeIn` — Post cards appearing in feed (staggered)
- `bottomSheetUp` — Compose modal, reply sheet
- `scrollReveal` — Landing page sections (scroll-driven)
- `skeletonPulse` — Loading skeletons
- `cardPopIn` — Feature cards with 3D perspective

---

## 18. Glossary

| Term | Definition |
|------|-----------|
| **Civility Score** | 0-1 score computed by `analyzeCivility()`. Measures tone quality (slurs = 0.05, constructive = 0.95+) |
| **Credibility Score** | 0-100 score computed from 6 behavioral factors. Stored on SearchableUser. |
| **Canonical Key** | Unique bill identifier: `{country}:{congress}:{billType}:{billNumber}` (e.g., `US:119:s:2103`) |
| **Cold Start Feed** | Special feed algorithm for users < 7 days old, matching interests without behavioral data |
| **CivilityEvent** | Durable record of a user's content quality. Persists even if post is deleted. |
| **Optimistic Post** | Post that appears in UI immediately before server confirmation. Has `_optimistic: true` flag. |
| **Session Payload** | JSON signed into cookie: `{ id, email, role, displayName, iat }` |
| **HMAC-SHA256** | Hash-based Message Authentication Code. Used to sign session tokens. |
| **PBKDF2** | Password-Based Key Derivation Function. 100K iterations for hash stretching. |
| **StoredPost** | Database model for posts (content, topics, civility score, status, visibility) |
| **SearchableUser** | Denormalized user table optimized for search (normalized names, auth credentials) |
| **SSE** | Server-Sent Events. Used for real-time notification streaming. |
| **Sliding Window** | Rate limiting technique. Tracks requests within a time window per key (IP or user). |
| **Diversity Re-rank** | Algorithm pass that shuffles posts to ensure max 60% same political affiliation per 5-post window. |

---

## 19. Appendix

### A. Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `DATABASE_URL` | Neon pooled connection string | Yes (prod) |
| `DIRECT_URL` | Neon direct TCP connection | Yes (local dev) |
| `SESSION_SECRET` | 32+ byte hex for HMAC signing | Yes |
| `CONGRESS_API_KEY` | Congress.gov API authentication | No (demo mode without) |
| `RESEND_API_KEY` | Email service (Resend) | No (logs to console without) |

### B. Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.1.6 | App Router framework |
| `react` | 19.2.3 | UI library |
| `@prisma/client` | 7.4.0 | ORM |
| `motion` | 12.38.0 | Animation (formerly Framer Motion) |
| `three` | 0.183.2 | 3D rendering |
| `@react-three/fiber` | 9.5.0 | React Three.js bindings |
| `resend` | 6.9.2 | Email service |
| `lucide-react` | 0.563.0 | Icon library |
| `date-fns` | 4.1.0 | Date formatting |
| `clsx` | 2.1.1 | Conditional classnames |
| `tailwind-merge` | 3.5.0 | Tailwind class conflict resolution |

### C. Recommended Codebase Reading Order

1. `src/lib/auth-context.tsx` — Understand how auth state flows
2. `src/lib/security/session.ts` — How sessions are signed/verified
3. `src/middleware.ts` — How every request is secured
4. `src/app/api/auth/login/route.ts` — Complete login flow
5. `src/lib/post-data-store.ts` — How posts are persisted
6. `src/lib/post-store.tsx` — How optimistic UI works
7. `src/components/feed/feed-view.tsx` — How the feed renders
8. `src/lib/algorithm/scoring.ts` — How posts are ranked
9. `src/lib/civility.ts` — How content is scored
10. `src/lib/credibility-recompute.ts` — How user reputation works
11. `prisma/schema.prisma` — All database models
12. `src/lib/social-store.ts` — Follow graph and notifications
13. `src/lib/legislation/congress-api.ts` — Congress.gov integration

### D. Security Checklist for Production

- [ ] Rotate `SESSION_SECRET` (32+ byte cryptographic random hex)
- [ ] Rotate `CONGRESS_API_KEY`
- [ ] Verify `.env` is in `.gitignore`
- [ ] Replace in-memory rate limiter with Redis (Upstash)
- [ ] Migrate reaction storage to database (Prisma Reaction table)
- [ ] Move avatar/banner images to object storage (Vercel Blob / S3)
- [ ] Enable 2FA for admin accounts
- [ ] Set up database backup with point-in-time recovery
- [ ] Run `npm audit` and update dependencies
- [ ] Test CORS whitelist matches production domains only

---

*This document was generated by auditing every file in the Civic Social codebase across 11 parallel analysis passes covering: app structure, authentication, database models, API routes, frontend components, styling, Congress integration, library files, page components, profile/social features, and feed/posts system.*
