# Civic Social — Mobile Device Testing Guide

## Stack Detection

This is a **Next.js 16.1.6 web application** (not React Native or Flutter).
Testing on real devices means accessing the dev server over your local network.

---

## Quick Start (3 Steps)

### Step 1: Find your computer's local IP

```bash
# macOS
ipconfig getifaddr en0

# Or use the built-in script
npm run local-ip

# Typical result: 192.168.1.42
```

### Step 2: Start the dev server for mobile access

```bash
# This binds to 0.0.0.0 so any device on your network can reach it
npm run dev:mobile
```

The console will show:
```
▲ Next.js 16.1.6
- Local:    http://localhost:3000
- Network:  http://192.168.1.42:3000    ← use this URL on your phone
```

### Step 3: Open on your phone

1. Connect your phone to the **same Wi-Fi network** as your computer
2. Open **Safari** (iPhone) or **Chrome** (Android)
3. Navigate to `http://192.168.1.42:3000` (your IP from Step 1)
4. The app should load with the splash screen, then the feed

> **Tip:** Bookmark the URL or create a home screen shortcut for quick access.

---

## Production-Like Testing

For testing with optimized builds (closer to production):

```bash
# Build the production bundle
npm run build

# Serve it on all interfaces
npm run start:mobile

# Open http://<your-ip>:3000 on phone
```

---

## Debugging on Device

### iOS Safari (iPhone/iPad)

1. On your **iPhone**: Settings → Safari → Advanced → **Web Inspector** ON
2. Connect iPhone to Mac via **USB cable**
3. On your **Mac**: Open Safari → Develop menu → [Your iPhone name] → [Page]
4. Safari Web Inspector opens — use it like Chrome DevTools

### Android Chrome

1. On your **Android**: Settings → Developer Options → **USB Debugging** ON
2. Connect Android to computer via **USB cable**
3. On your **computer**: Open Chrome → navigate to `chrome://inspect`
4. Your phone's open tabs appear — click **Inspect**

### Wireless Debugging (no cable)

- **iOS**: Use Safari Web Inspector over Wi-Fi (requires pairing)
- **Android**: Use `chrome://inspect` with ADB over Wi-Fi:
  ```bash
  adb tcpip 5555
  adb connect <phone-ip>:5555
  ```

---

## Performance Testing on Device

### Using the Dev Performance Panel

The app includes a built-in performance panel (development only):

1. Open the app on your phone
2. Tap the **purple "P" button** in the bottom-left corner
3. See real-time metrics:
   - **Cold Start**: Time from navigation to interactive (budget: < 2000ms)
   - **First Content**: Time until feed posts render (budget: < 1500ms)
   - **API p50/p95**: Server response latencies
   - **Recent API Calls**: List of fetch timings

### Using Lighthouse (Mobile Audit)

```bash
# Run Lighthouse against your local server from your computer
# (simulates mobile device)
npx lighthouse http://localhost:3000 --view --preset=perf --emulated-form-factor=mobile
```

### Chrome DevTools Throttling

In Chrome DevTools (connected to Android):
1. Network tab → Throttle to "Slow 3G" or "Fast 3G"
2. Performance tab → CPU 4x slowdown
3. This simulates mid-range Android devices

---

## HTTPS for Mobile (Optional)

Some features (like clipboard, notifications) require HTTPS. For local HTTPS:

```bash
# Install mkcert (macOS)
brew install mkcert
mkcert -install

# Generate local certs
mkcert localhost 192.168.1.42

# Start with HTTPS (add to next.config.ts experimental.https)
# Or use a reverse proxy like caddy
```

For most testing, HTTP is sufficient since we're not using PWA features that require HTTPS.

---

## Mobile Viewport QA Checklist

Test on at least these device sizes:

### Small Phone (iPhone SE / iPhone 13 mini)
- **Width**: 375px
- **Key checks**:
  - [ ] Feed cards don't overflow
  - [ ] Post content is readable (font size >= 13px)
  - [ ] All buttons have touch target >= 44px
  - [ ] Compose modal is usable
  - [ ] Bottom nav doesn't overlap content
  - [ ] No horizontal scroll

### Standard Phone (iPhone 15 / Pixel 8)
- **Width**: 390-412px
- **Key checks**:
  - [ ] Feed header is fully visible
  - [ ] Tab switcher (For You / Following) is tappable
  - [ ] Pull-to-refresh works smoothly
  - [ ] Keyboard doesn't cover compose input
  - [ ] Notification list scrolls smoothly

### Large Phone (iPhone 15 Pro Max / Samsung S24 Ultra)
- **Width**: 430-480px
- **Key checks**:
  - [ ] Content doesn't look stretched
  - [ ] Safe area insets respected (notch, dynamic island)
  - [ ] Bottom nav positioned correctly with home indicator

### Tablet (iPad / Android tablet)
- **Width**: 768px+
- **Key checks**:
  - [ ] Sidebar visible
  - [ ] Trending panel shows on XL screens
  - [ ] Content max-width is appropriate

---

## Feature-Specific QA

### Splash Screen
- [ ] Splash shows on cold load (clear cache, hard refresh)
- [ ] Shield logo animates in (check icon draws)
- [ ] Shimmer bar moves smoothly
- [ ] Crossfade into content is smooth (no flash)
- [ ] Auto-dismisses within 4 seconds even on slow load
- [ ] Dark mode: dark background
- [ ] Light mode: light background

### Feed
- [ ] Skeleton cards show while loading
- [ ] Posts appear with staggered animation
- [ ] Scroll is smooth (60fps)
- [ ] Pull-to-refresh spring effect works
- [ ] "New posts available" banner appears and works
- [ ] Post card text is selectable
- [ ] Links inside posts are tappable
- [ ] Algorithm explanation expandable

### Navigation
- [ ] Bottom mobile nav is visible
- [ ] Bottom nav has safe area padding
- [ ] Active tab is highlighted
- [ ] Page transitions don't flash white/black
- [ ] Back navigation works (browser back button)

### Compose
- [ ] Compose modal opens from bottom (mobile)
- [ ] Keyboard pushes content up (not hidden behind)
- [ ] Character counter visible
- [ ] Submit button is reachable above keyboard
- [ ] Topic tags are tappable
- [ ] Modal can be dismissed (swipe down or X)

### Dark/Light Mode
- [ ] Theme respects system preference
- [ ] Toggle works in settings
- [ ] No white flashes on theme change
- [ ] All text is readable in both modes
- [ ] Skeleton shimmer visible in both modes

### Touch Interactions
- [ ] All buttons have minimum 44x44px touch target
- [ ] No accidental taps on closely-spaced elements
- [ ] Scroll doesn't accidentally trigger buttons
- [ ] Long press doesn't interfere with native context menu
- [ ] Swipe gestures (pull-to-refresh) work

### Safe Areas
- [ ] Content not hidden behind status bar
- [ ] Content not hidden behind home indicator
- [ ] Content not hidden behind camera notch/dynamic island
- [ ] Bottom nav respects safe-area-inset-bottom

### Keyboard Behavior
- [ ] Keyboard opens when tapping text inputs
- [ ] Screen scrolls to keep input visible
- [ ] Keyboard dismisses on tap outside
- [ ] "Done" / "Return" key works appropriately
- [ ] No layout jump when keyboard opens/closes

### Offline / Slow Network
- [ ] App shows skeleton on slow connection
- [ ] App doesn't crash on network error
- [ ] Retry works after connection restored
- [ ] Cached content shows while refreshing

---

## Sharing Test Builds (For Non-Engineers)

### Option 1: Same Wi-Fi (Development)
1. Run `npm run dev:mobile`
2. Share the `http://<your-ip>:3000` URL
3. Anyone on the same Wi-Fi can test

### Option 2: Tunnel (Remote Testing)
```bash
# Using ngrok (free tier available)
npx ngrok http 3000

# Or using Cloudflare Tunnel (free)
npx cloudflared tunnel --url http://localhost:3000

# Share the https://xxxx.ngrok.io or https://xxxx.trycloudflare.com URL
```

### Option 3: Deploy Preview (Vercel)
```bash
# Push to a branch, Vercel auto-deploys a preview URL
git push origin feature/mobile-testing

# Share the https://civic-social-xxxx.vercel.app URL
```

---

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| "Can't connect" on phone | Ensure same Wi-Fi; check firewall allows port 3000 |
| Fonts look different | Inter is loaded via `next/font`; verify network access |
| Touch targets too small | Minimum 44px; check padding on buttons |
| Content behind notch | Add `viewport-fit=cover` + safe-area CSS (already set) |
| Horizontal scroll | Check for `overflow-x` or elements wider than viewport |
| Slow on Android | Normal — Android Chrome is slower; test with prod build |
| CORS errors | Dev server defaults allow all origins; check middleware in dev mode |
| Cookies don't work | HTTP cookies work on localhost; for IP access, `SameSite=Lax` works |
