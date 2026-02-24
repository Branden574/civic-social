# Make users searchable right after signup (database setup)

This guide walks you through setting up the database so that **everyone who signs up appears in search immediately**, on any server (no more “only when they’re logged in”).

---

## What you need

- A **PostgreSQL database** and a **connection URL** (`DATABASE_URL`).
- The **migration** in this repo applied to that database once.

You can use:

- **Local:** Prisma Postgres (e.g. `prisma dev`) or any local Postgres.
- **Production (e.g. Vercel):** Vercel Postgres, Neon, Supabase, or any hosted Postgres.

---

## Part 1: Get a database and `DATABASE_URL`

### Option A — Local development (Prisma Postgres)

1. **Start local Postgres with Prisma:**
   ```bash
   cd civic-social
   npx prisma dev
   ```
   Leave this running. It starts a local Postgres and prints a `DATABASE_URL` (often `prisma+postgres://localhost:51213/?api_key=...`).

2. **Put that URL in `.env`:**
   - Copy the `DATABASE_URL` from the `prisma dev` output.
   - In the project root, create or edit `.env` and set:
     ```env
     DATABASE_URL="prisma+postgres://localhost:51213/?api_key=YOUR_KEY_FROM_PRISMA_DEV"
     ```
   - Your existing `.env` may already have this if you’ve run `prisma dev` before.

3. **Run the app (in another terminal):**
   ```bash
   npm run dev
   ```
   Signups will be stored in this local DB and will be searchable.

---

### Option B — Production (e.g. Vercel)

1. **Create a Postgres database:**
   - **Vercel:** Project → Storage → Create Database → Postgres.  
     Vercel will add `POSTGRES_URL` (and sometimes `DATABASE_URL`) to your project.
   - **Neon:** [neon.tech](https://neon.tech) → New project → copy the connection string.
   - **Supabase:** [supabase.com](https://supabase.com) → New project → Settings → Database → Connection string (URI).

2. **Set `DATABASE_URL` in your deployment:**
   - **Vercel:** Project → Settings → Environment Variables.
   - Add:
     - **Name:** `DATABASE_URL`
     - **Value:** your Postgres connection URL (e.g. `postgresql://user:pass@host:5432/dbname?sslmode=require`).
   - If Vercel gave you `POSTGRES_URL`, you can use that as the value (and optionally set `DATABASE_URL` to the same value so the app keeps using `DATABASE_URL`).

3. **Important:**  
   Prisma 7 with a `prisma+postgres://` URL is for Prisma’s own Postgres (e.g. local `prisma dev`). For **hosted** Postgres (Vercel, Neon, Supabase), use the **normal** URL format, e.g.:
   ```text
   postgresql://user:password@host:5432/database?sslmode=require
   ```
   So in production, `DATABASE_URL` should be that standard Postgres URL.

---

## Part 2: Apply the migration (create the `SearchableUser` table)

Do this **once per database** (once locally, once in production).

1. **Ensure `DATABASE_URL` is set** in the environment (`.env` locally, or in Vercel/env for production).

2. **Apply migrations:**
   ```bash
   cd civic-social
   npx prisma migrate deploy
   ```
   - **Local:** With `prisma dev` running and `DATABASE_URL` in `.env`, this applies the migration to your local DB.
   - **Production:** Run this in a context where `DATABASE_URL` points to your production DB (e.g. locally with production `.env`, or in a CI/deploy script that has `DATABASE_URL` set).  
   You should see something like:
   ```text
   Applying migration `20250601000000_add_searchable_user`
   The following migration(s) have been applied:
   migrations/
     20250601000000_add_searchable_user/
       migration.sql
   ```

3. **If you prefer to run the SQL by hand** (e.g. in a DB console), use the contents of:
   ```text
   prisma/migrations/20250601000000_add_searchable_user/migration.sql
   ```

---

## Part 3: Verify

1. **Start the app** (with `DATABASE_URL` set and migration applied).
2. **Register a new test user** (e.g. “pmathis” or another account).
3. **In another browser or incognito**, open the app and use **Search** for that username.
4. The new user should appear even if they’re not logged in — that means the DB-backed search is working.

---

## Quick reference

| Step | Local | Production (e.g. Vercel) |
|------|--------|---------------------------|
| 1. Database | `npx prisma dev` → copy `DATABASE_URL` into `.env` | Create Postgres (Vercel/Neon/Supabase), set `DATABASE_URL` in project env |
| 2. Migration | `npx prisma migrate deploy` (with `.env` loaded) | Run `npx prisma migrate deploy` with production `DATABASE_URL` |
| 3. Run app | `npm run dev` | Deploy as usual; app will use `DATABASE_URL` automatically |

After this, every signup (and each `refreshMe`) is written to the database, and search reads from it, so **users are searchable as soon as they sign up**, on any server and whether or not they’re currently logged in.
