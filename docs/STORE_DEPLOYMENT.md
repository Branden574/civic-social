# Pushing Civic Social to the Web and App Stores

This guide walks you through: **(1)** deploying the app so testers can use it, **(2)** distributing it for testing, and **(3)** getting it on the Apple App Store and Google Play Store.

---

## Part 1 — Deploy the web app (so anyone can use it)

Before “stores,” get the app live on the web. Then testers can use it by URL; later you can wrap that same URL (or build) for the stores.

### 1.1 Deploy to Vercel (recommended for Next.js)

1. **Push your code to GitHub** (if you haven’t):
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com) and sign in (GitHub is easiest).
   - Click **Add New** → **Project** and import your `civic-social` repo.
   - **Root Directory:** leave as the repo root (or set to the folder that contains `package.json` if the app is in a subfolder).
   - **Framework Preset:** Vercel should detect Next.js.
   - Click **Deploy**.

3. **Set environment variables** (in Vercel → your project → **Settings** → **Environment Variables**):
   - `DATABASE_URL` — your production Postgres URL (see [SETUP_SEARCHABLE_USERS.md](./SETUP_SEARCHABLE_USERS.md)).
   - `SESSION_SECRET` — a long random string, e.g. `openssl rand -hex 32`.
   - Any others your app needs (e.g. `CONGRESS_API_KEY`).

4. **Redeploy** after adding env vars (Deployments → … → Redeploy).

5. You’ll get a URL like `https://civic-social-xxx.vercel.app`. Share this for **web testing**.

### 1.2 Optional: custom domain

In Vercel → **Settings** → **Domains**, add your domain and follow the DNS instructions. Then testers use `https://yourdomain.com` instead of the `.vercel.app` URL.

---

## Part 2 — Testing before stores (share with testers)

- **Web:** Share the Vercel URL. Testers open it in a browser (mobile or desktop). No install required.
- **“App-like” on phones:** Your app already has a [PWA manifest](https://developer.mozilla.org/en-US/docs/Web/Progressive_Web_Apps). On **Android** (Chrome), users can use the menu → **“Add to Home screen”** to get an icon. On **iOS** (Safari), **Share** → **“Add to Home Screen”**. Good for “download and try” without going through the stores yet.
- **Internal / beta:** For “store-like” testing (TestFlight / Internal testing), you’ll use the store flows in Part 3 after you have a build that can be submitted.

---

## Part 3 — Getting on the App Store and Play Store

Your app is a **Next.js web app**. To list it in Apple’s and Google’s stores, you need a **native wrapper** that either:

- Opens your web app in a full-screen browser (e.g. **Capacitor** or **TWA**), or  
- Serves a built version of the app inside a native shell.

Below is a practical path using **Capacitor** (one codebase, iOS + Android).

### 3.1 High-level steps (same for both stores)

| Step | What you do |
|------|-------------|
| 1 | Build the web app (e.g. `next build` and export static or use a deploy URL). |
| 2 | Create an iOS and/or Android project with **Capacitor** that loads that build (or your live URL). |
| 3 | Build native apps (Xcode for iOS, Android Studio / CLI for Android). |
| 4 | **Apple:** Create an app in **App Store Connect**, upload the build (or use Xcode), submit for TestFlight / App Review. |
| 5 | **Google:** Create an app in **Google Play Console**, upload the Android build (AAB), set up **Internal testing** (or closed/open testing), then publish. |

### 3.2 Option A — Capacitor (recommended: one wrapper for iOS + Android)

Capacitor wraps your existing web app in a native shell so you can build for both stores.

1. **Install Capacitor** (in your project root):
   ```bash
   npm install @capacitor/core @capacitor/cli
   npx cap init "Civic Social" com.civicsocial.app
   ```
   Use your desired app name and bundle ID (e.g. `com.yourcompany.civicsocial`).

2. **Build the web app:**
   ```bash
   npm run build
   ```
   Capacitor typically points at the Next.js **output** (e.g. `out` for static export, or a copied build). Next.js default is server-rendered; for Capacitor you often either:
   - **Static export:** In `next.config.ts` set `output: 'export'`, run `npm run build`, then point Capacitor’s `webDir` at `out`, or  
   - **Use your deployed URL** in a WebView (less common for “full” app experience but possible).

3. **Add iOS and Android:**
   ```bash
   npm install @capacitor/ios @capacitor/android
   npx cap add ios
   npx cap add android
   ```

4. **Point Capacitor at your built app:**
   - If you used static export, in `capacitor.config.ts` set `webDir` to your export folder (e.g. `out`).
   - Run `npx cap sync` after each `npm run build` so the native projects get the latest web assets.

5. **Open and build in native IDEs:**
   ```bash
   npx cap open ios    # Xcode — build for simulator or device, then archive for App Store
   npx cap open android # Android Studio — build bundle (AAB) for Play Store
   ```

6. **Apple App Store:**
   - **Apple Developer Program:** [developer.apple.com](https://developer.apple.com) — enroll ($99/year).
   - **App Store Connect:** Create an app, set name, description, screenshots, privacy policy URL.
   - In Xcode: select “Any iOS Device”, then **Product** → **Archive**. Upload the archive (Distribute App → App Store Connect).
   - In App Store Connect, submit the build for **TestFlight** (beta) or **App Review** (public).

7. **Google Play Store:**
   - **Google Play Console:** [play.google.com/console](https://play.google.com/console) — one-time fee.
   - Create an app, fill in store listing (description, graphics, etc.).
   - In Android Studio: **Build** → **Generate Signed Bundle / APK** → **Android App Bundle (AAB)**. Upload the AAB in Play Console.
   - Start with **Internal testing** (optional: add testers by email). Then **Closed** or **Open testing**, then **Production**.

### 3.3 Option B — Android only: PWA as a “store” app (TWA)

If you only need **Google Play** and are fine with the app being your live web app in a full-screen browser:

- Use **Trusted Web Activity (TWA)** so your PWA opens in a Chrome-based shell and can be published on the Play Store.
- Tools: [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) or [PWA Builder](https://www.pwabuilder.com/) (can output a TWA project).
- You’ll need your **web app URL** (e.g. your Vercel URL), a **manifest** (you already have `/manifest.json`), and icons. Then build the TWA and upload the AAB to Play Console as above.

This does **not** give you an iOS App Store listing; for that you still need something like Capacitor or a separate iOS app.

---

## Checklist before submitting to stores

- [ ] **Privacy policy URL** — Required by both stores. Host a page (e.g. `/privacy` on your site) and use that URL in store listing and in-app if you collect data.
- [ ] **App icons** — 1024×1024 (iOS), 512×512 (Android); your manifest already references icons; ensure they exist under `public/icons/` and add any sizes the store or Capacitor need.
- [ ] **Screenshots** — Both stores require screenshots (various device sizes). Use simulator/emulator or real devices.
- [ ] **Short description / full description** — Prepare copy for both stores.
- [ ] **Signing:**  
  - **iOS:** Apple handles this via Xcode and App Store Connect once you’re in the Developer Program.  
  - **Android:** Create a keystore and use it for the release AAB; store the keystore and passwords safely (e.g. in a secrets manager or secure backup).

---

## Suggested order

1. **Deploy web (Part 1)** → share link + “Add to Home Screen” for quick testing.  
2. **Add store assets** (privacy policy, icons, screenshots, descriptions).  
3. **Add Capacitor (Part 3.2)** → build iOS and Android once the web app is stable.  
4. **TestFlight (iOS)** and **Internal testing (Android)** → invite testers.  
5. **Submit for review** when you’re ready for public release.

If you tell me your target (e.g. “web only for now,” “Android first,” or “both stores”), I can narrow this to a minimal set of steps and, if you want, outline exact Capacitor config and Next.js `output: 'export'` for your repo.
