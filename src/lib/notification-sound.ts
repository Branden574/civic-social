// ═══════════════════════════════════════════════════════════════
// Notification Sound — Web Audio API tone generator
// ═══════════════════════════════════════════════════════════════
//
// Generates a pleasant two-tone chime using the Web Audio API.
// No audio file needed — works on all browsers that support Web Audio.
//
// Platform notes:
//  - iOS Safari: Audio only plays after user interaction (tap).
//    The first call to playNotificationSound() after page load will
//    be silent unless preceded by a user gesture. We "unlock" the
//    AudioContext on first user interaction.
//  - Android Chrome: Works after user interaction unlock.
//  - Desktop browsers: Generally work immediately after permission grant.
//  - PWA standalone: Same as browser, but may need service worker
//    for background notification sounds.
// ═══════════════════════════════════════════════════════════════

let audioCtx: AudioContext | null = null;
let unlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

/**
 * Call this once on a user interaction (click/tap) to unlock audio on iOS/Android.
 * After calling this, playNotificationSound() will work without user gestures.
 */
export function unlockAudio(): void {
  if (unlocked) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  // Create a silent buffer and play it to unlock the context
  const buffer = ctx.createBuffer(1, 1, 22050);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  unlocked = true;
}

/**
 * Play a pleasant two-tone notification chime.
 * Duration: ~300ms. Volume: moderate.
 */
export function playNotificationSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume if suspended (can happen after tab goes idle)
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const now = ctx.currentTime;

  // Master gain (volume control)
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.15, now);
  masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  masterGain.connect(ctx.destination);

  // Tone 1: E5 (659 Hz) — bright, attention-getting
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(659, now);
  const gain1 = ctx.createGain();
  gain1.gain.setValueAtTime(0.3, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc1.connect(gain1);
  gain1.connect(masterGain);
  osc1.start(now);
  osc1.stop(now + 0.2);

  // Tone 2: A5 (880 Hz) — follows 80ms later, rising feel
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(880, now + 0.08);
  const gain2 = ctx.createGain();
  gain2.gain.setValueAtTime(0, now);
  gain2.gain.setValueAtTime(0.25, now + 0.08);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  osc2.connect(gain2);
  gain2.connect(masterGain);
  osc2.start(now + 0.08);
  osc2.stop(now + 0.35);
}
