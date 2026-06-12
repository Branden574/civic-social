// ═══════════════════════════════════════════════════════════════
// Debates feature — two-user end-to-end verification
// ═══════════════════════════════════════════════════════════════
// Drives two real browser sessions (host + debater) with fake
// camera/mic devices against a locally running app:
//
//   signup → create debate → join sides → enable voice → join voice
//   → cameras on → BOTH sides see BOTH video tiles with real frames
//   → live chat round-trip → participant sync without refresh
//
// Usage:  node scripts/e2e-debates.mjs [baseURL]
//         (default http://localhost:3000 — start `npm run dev` first)
// ═══════════════════════════════════════════════════════════════

import { chromium } from '@playwright/test';
import { randomBytes } from 'node:crypto';

const BASE = process.argv[2] || 'http://localhost:3000';
const TS = Date.now();
// Per-run random password for the throwaway accounts. Generated at
// runtime (never a committed literal) so it can't be reconstructed from
// this public source, and satisfies the app's complexity rules.
const RUN_SECRET = `Aa1!${randomBytes(18).toString('base64url')}`;
const PASS = [];
const FAIL = [];

function ok(name) { PASS.push(name); console.log(`  ✓ ${name}`); }
function bad(name, detail) { FAIL.push(`${name}: ${detail}`); console.log(`  ✗ ${name} — ${detail}`); }

async function check(name, fn) {
  try { await fn(); ok(name); }
  catch (e) { bad(name, e?.message ?? String(e)); }
}

// Click a button by its text via in-page DOM dispatch. More robust than
// Playwright's synthesized pointer-click against this app's responsive
// layout (which mounts/unmounts the mobile vs desktop VoiceChat on a
// matchMedia boundary). Picks the VISIBLE, enabled instance.
async function clickText(page, text, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const did = await page.evaluate((t) => {
      const b = [...document.querySelectorAll('button')]
        .find((x) => x.textContent?.includes(t) && x.offsetParent !== null && !x.disabled);
      if (!b) return false;
      b.click();
      return true;
    }, text);
    if (did) return;
    await page.waitForTimeout(300);
  }
  throw new Error(`button "${text}" not visible/enabled within ${timeout}ms`);
}

async function waitText(page, text, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const found = await page.evaluate((t) => document.body.innerText.includes(t), text);
    if (found) return;
    await page.waitForTimeout(300);
  }
  throw new Error(`text "${text}" not found within ${timeout}ms`);
}

async function makeUser(browser, label) {
  const context = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const email = `e2e-${label}-${TS}@example.com`;
  const password = RUN_SECRET;
  const displayName = `E2E ${label} ${TS % 10000}`;
  const res = await context.request.post(`${BASE}/api/auth/signup`, {
    data: { email, password, displayName },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok() || !body.user) {
    throw new Error(`signup failed for ${label}: HTTP ${res.status()} ${JSON.stringify(body).slice(0, 200)}`);
  }
  const page = await context.newPage();
  page.on('pageerror', (err) => console.log(`  [${label} pageerror] ${String(err).slice(0, 160)}`));
  return { context, page, email, displayName, userId: body.user.id, label };
}

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

let debateId = null;
let host, debater;

try {
  console.log(`\n■ Debates E2E against ${BASE}\n`);

  // ── 1. Accounts ─────────────────────────────────────────────
  await check('signup: host account (auto-login)', async () => {
    host = await makeUser(browser, 'host');
  });
  await check('signup: debater account (auto-login)', async () => {
    debater = await makeUser(browser, 'debater');
  });
  if (!host || !debater) throw new Error('accounts failed — aborting');

  // ── 2. Create debate (API, as host) ────────────────────────
  await check('create debate via POST /api/debates', async () => {
    const res = await host.context.request.post(`${BASE}/api/debates`, {
      data: {
        title: `E2E camera test debate ${TS}`,
        description: 'Automated verification run.',
        sideA: { label: 'For', ideology: 'center-left' },
        sideB: { label: 'Against', ideology: 'center-right' },
        topics: ['testing'],
        durationMinutes: 30,
        creatorSide: 'A',
      },
    });
    const body = await res.json();
    if (!res.ok() || !body.debate?.id) throw new Error(`HTTP ${res.status()} ${JSON.stringify(body).slice(0, 200)}`);
    debateId = body.debate.id;
  });
  if (!debateId) throw new Error('no debate — aborting');

  // ── 3. Host opens page; debater joins side B via API ───────
  await host.page.goto(`${BASE}/debates/${debateId}`, { waitUntil: 'domcontentloaded' });
  await host.page.waitForTimeout(2500); // let page settle + first polls

  await check('debater joins side B via PATCH action=join', async () => {
    const res = await debater.context.request.patch(`${BASE}/api/debates/${debateId}`, {
      data: { action: 'join', side: 'B' },
    });
    const body = await res.json();
    if (!res.ok()) throw new Error(`HTTP ${res.status()} ${JSON.stringify(body).slice(0, 200)}`);
  });

  // ── 4. Participant sync: host sees debater WITHOUT refresh ──
  await check('host sees debater appear within 8s (no refresh)', async () => {
    await waitText(host.page, debater.displayName.split(' ')[0], 8000);
  });

  await debater.page.goto(`${BASE}/debates/${debateId}`, { waitUntil: 'domcontentloaded' });
  await debater.page.waitForTimeout(2500);

  // ── 5. Voice: host enables, debater joins ───────────────────
  await check('host enables voice chat', async () => {
    await clickText(host.page, 'Enable Voice Chat');
    // Enabled speaker UI exposes the camera toggle (host joins unmuted,
    // so the mic button reads "Mute", not "Unmute").
    await waitText(host.page, 'Cam Off', 8000);
  });

  await check('debater discovers enabled room without refresh (poll fix)', async () => {
    await waitText(debater.page, 'Join Voice', 8000);
  });

  await check('debater joins voice', async () => {
    await clickText(debater.page, 'Join Voice');
    await debater.page.waitForTimeout(3500);
  });

  // ── 6. Cameras on, both sides ───────────────────────────────
  await check('host turns camera on', async () => {
    await clickText(host.page, 'Cam Off');
    await host.page.waitForTimeout(1500);
  });
  await check('debater turns camera on', async () => {
    await clickText(debater.page, 'Cam Off');
    await debater.page.waitForTimeout(1500);
  });

  // Give WebRTC time to negotiate both directions (poll 1.5s + ICE +
  // the second renegotiation when each camera track is added).
  async function countLiveVideos(page) {
    return page.evaluate(() => {
      const vids = [...document.querySelectorAll('video')];
      return vids.filter((v) => {
        const s = v.srcObject;
        const hasTrack = s && typeof s.getVideoTracks === 'function' && s.getVideoTracks().some((t) => t.readyState === 'live');
        return hasTrack && v.videoWidth > 0; // frames actually decoded
      }).length;
    });
  }
  // Poll up to 20s for both sides to reach 2 decoded feeds.
  let hostN = 0, debN = 0;
  for (let i = 0; i < 20; i++) {
    await host.page.waitForTimeout(1000);
    hostN = await countLiveVideos(host.page);
    debN = await countLiveVideos(debater.page);
    if (hostN >= 2 && debN >= 2) break;
  }

  // ── 7. THE core assertion: both sides see both cameras ─────
  await check('HOST sees 2 decoded video feeds (self + debater)', async () => {
    if (hostN < 2) throw new Error(`host sees ${hostN} decoded video(s)`);
  });
  await check('DEBATER sees 2 decoded video feeds (self + host)', async () => {
    if (debN < 2) throw new Error(`debater sees ${debN} decoded video(s)`);
  });

  // ── 8. Audio: remote audio element exists & has live track ──
  await check('debater has live remote AUDIO from host', async () => {
    const n = await debater.page.evaluate(() => {
      const els = [...document.querySelectorAll('audio')];
      return els.filter((a) => {
        const s = a.srcObject;
        return s && typeof s.getAudioTracks === 'function' && s.getAudioTracks().some((t) => t.readyState === 'live');
      }).length;
    });
    if (n < 1) throw new Error(`no live remote audio element (found ${n})`);
  });

  // ── 9. Live chat round-trip ─────────────────────────────────
  await check('chat: host → debater round-trip without refresh', async () => {
    const msg = `e2e-chat-${TS}`;
    const input = host.page.getByPlaceholder('Send a message...').first();
    await input.fill(msg, { timeout: 8000 });
    await input.press('Enter');
    await waitText(debater.page, msg, 8000);
  });

  // ── 10. Console error sweep (WebRTC noise vs real errors) ───
  // (collected via pageerror handler above; hard failures would have
  //  shown as test failures — this is informational)

} catch (e) {
  bad('test-run', e?.message ?? String(e));
} finally {
  // ── Cleanup: delete the debate (best effort) ───────────────
  if (debateId && host) {
    await host.context.request.delete(`${BASE}/api/debates/${debateId}`).catch(() => {});
  }
  await browser.close();
  console.log(`\n■ RESULT: ${PASS.length} passed, ${FAIL.length} failed`);
  if (FAIL.length) {
    console.log('FAILURES:');
    for (const f of FAIL) console.log('  ✗ ' + f);
    process.exit(1);
  }
  process.exit(0);
}
