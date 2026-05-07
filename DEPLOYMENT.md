# Deployment Guide

Book Haven is split into two deployable pieces:

1. A **static frontend** (Vite-built React app) — can live on GitHub Pages, Cloudflare Pages, Netlify, anywhere.
2. An **API server** (Express + PostgreSQL) — must run on a host that supports long-running Node processes and a Postgres database. Railway, Fly.io, Render, and Replit Deployments all work.

This guide walks through the **GitHub Pages + Railway** combination. If you'd prefer a single-button deploy, jump to [Option B](#option-b-one-platform-replit-deployments) at the bottom.

---

## Option A: Frontend on GitHub Pages, API on Railway

### Architecture

```text
                ┌─────────────────────────────┐
                │   <user>.github.io/<repo>   │   (static, served by GitHub Pages)
                │   React + Vite frontend     │
                └──────────────┬──────────────┘
                               │  HTTPS, credentials: include
                               ▼
                ┌─────────────────────────────┐
                │  <project>.up.railway.app   │   (Express API + file proxy)
                │  ┌───────────────────────┐  │
                │  │ Postgres (Railway)    │  │
                │  └───────────────────────┘  │
                └─────────────────────────────┘
```

### Step 1 — Deploy the API to Railway

You said you've already done this. Confirm the following:

1. The Railway service runs **`pnpm --filter @workspace/api-server run start`** (or your equivalent). The build command should run `pnpm install && pnpm --filter @workspace/api-server run build` and then start the compiled output.
2. Railway has provisioned a **PostgreSQL** add-on and exposed `DATABASE_URL` to the service.
3. **Push the schema** so the `favorites` and `reviews` tables exist:
   ```bash
   # one-shot, locally, with the Railway DATABASE_URL exported
   DATABASE_URL="postgres://...railway..." pnpm --filter @workspace/db run push
   ```
4. Set these Railway environment variables on the API service:

   | Variable             | Value                                               | Why                                                                                                |
   | -------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
   | `DATABASE_URL`       | (auto-injected by the Postgres plugin)              | DB connection.                                                                                     |
   | `PORT`               | (auto-injected by Railway)                          | Express binds here.                                                                                |
   | `NODE_ENV`           | `production`                                        |                                                                                                    |
   | `CROSS_SITE_COOKIES` | `1`                                                 | **Required.** Switches the `bh_device` cookie to `SameSite=None; Secure` so the browser sends it on cross-origin requests from GitHub Pages. Without this, favorites/reviews silently fail. |

5. Make the service **public** (Railway → service → Settings → Networking → Generate Domain). Note the URL; it will look like `https://book-haven-api-production.up.railway.app`. **Do not include a trailing slash.**

6. Smoke-test the API directly in your browser or with `curl`:

   ```bash
   curl -i https://<your-api>.up.railway.app/api/favorites
   # Expect: 200 OK, JSON body, and a "Set-Cookie: bh_device=...; Secure; SameSite=None" header.
   ```

### Step 2 — Configure GitHub Pages

In the GitHub repo for this project:

1. Go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**. (Do *not* pick "Deploy from a branch".)

### Step 3 — Add the API URL as a repo secret

1. Go to **Settings → Secrets and variables → Actions → New repository secret**.
2. Name: `VITE_API_URL`
3. Value: the Railway public origin from Step 1, with **no trailing slash and no `/api` suffix**, e.g. `https://book-haven-api-production.up.railway.app`.

### Step 4 — Push to `main`

The repo already includes the workflow at [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml). On every push to `main` it will:

1. Install dependencies with pnpm.
2. Generate the typed API client.
3. Build the Vite frontend with `BASE_PATH=/<repo-name>/` and `VITE_API_URL` baked in.
4. Add a `.nojekyll` file (required so Vite's `_assets` folder isn't stripped).
5. Upload the build to GitHub Pages.

The first run also creates the `github-pages` environment automatically.

### Step 5 — Visit your site

After the workflow finishes, your app will be live at:

```text
https://<your-username>.github.io/<your-repo-name>/
```

### Step 6 — Verify end-to-end

Open the site, pick any classic book, and check:

- ✅ Search returns results from Open Library.
- ✅ A book detail page loads and shows the cover, synopsis, rating, and reviews.
- ✅ Clicking **Read EPUB** or **Read PDF** opens the in-app reader and the file downloads (this proves the file proxy and CORS work).
- ✅ Adding a favorite persists across reloads (this proves the cross-origin cookie works).
- ✅ Posting a review shows up in the public list.

If favorites or reading don't work, jump to [Troubleshooting](#troubleshooting).

---

## Will it work perfectly with GitHub Actions?

**Yes, with these caveats:**

| Concern                          | Status     | Detail                                                                                                                                                                |
| -------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static build & deploy            | ✅ Works   | Standard Vite build. The included workflow handles pnpm + Node 24.                                                                                                    |
| SPA deep links (`/book/OL...`)   | ✅ Works   | `public/404.html` redirects unknown paths back to `index.html`, which restores the original URL via `history.replaceState`. Standard `spa-github-pages` technique.   |
| Sub-path base (`/<repo>/`)       | ✅ Works   | `BASE_PATH` is wired through Vite (`base`) and Wouter (`<Router base>`). Asset URLs resolve correctly.                                                                |
| Talking to the Railway API       | ✅ Works   | `setBaseUrl(VITE_API_URL)` is called in `main.tsx`. Every generated hook automatically prepends the API origin.                                                       |
| Per-device favorites + reviews   | ⚠️ Needs `CROSS_SITE_COOKIES=1` on Railway | Otherwise the device cookie is `SameSite=Lax` and the browser drops it on cross-origin requests.                                                                       |
| EPUB/PDF reading                 | ⚠️ Routes through Railway proxy | The browser can't fetch Project Gutenberg / Internet Archive files directly (CORS), so they go through `/api/proxy/epub?url=...` on Railway. Counts toward Railway egress. |
| 3D hero (three.js)               | ✅ Works   | Lazy-loaded; environments without WebGL fall back to a gradient.                                                                                                      |
| PDF reader (pdfjs worker)        | ✅ Works   | Worker is bundled by Vite via `?url` import. No CDN dependency.                                                                                                       |

The only thing GitHub Pages **can't** do is host the Express server itself — and that's exactly why the API lives on Railway.

---

## Troubleshooting

### "Not available to read" on every book

The frontend can't reach the API. Open DevTools → Network and look at the `OPTIONS` and `GET` requests to your Railway origin.

- **CORS error?** Make sure the API has `cors({ origin: true, credentials: true })` (it does by default in `artifacts/api-server/src/app.ts`).
- **404?** `VITE_API_URL` was either unset or wrong at build time. Re-check the GitHub repo secret, then re-run the workflow.
- **Mixed content blocked?** `VITE_API_URL` must be `https://` (Railway gives you HTTPS automatically).

### Favorites disappear after reload, reviews 401

The device cookie isn't being sent cross-origin.

- On Railway, set `CROSS_SITE_COOKIES=1` and redeploy.
- In the browser, verify the `Set-Cookie` response header from the API includes `Secure; SameSite=None`.
- Some privacy browsers (Brave, Safari with strict tracking protection) block third-party cookies entirely. Test in Chrome/Firefox.

### Page refresh on `/book/OL123W` shows GitHub's 404 page

`public/404.html` wasn't included in the deploy. Re-check the workflow logs — the `Upload Pages artifact` step should include `404.html`. The included workflow handles this automatically.

### Workflow fails on `pnpm install`

The lockfile must be in sync. Run `pnpm install` locally and commit any changes to `pnpm-lock.yaml`.

### Worker version mismatch in the PDF reader

`pdfjs-dist` is pinned to the version `react-pdf` bundles internally. If you bump either, bump both. See `replit.md` → Gotchas.

---

## Option B: One platform (Replit Deployments)

If splitting hosts is more friction than you want, deploy the whole stack on Replit:

1. In the workspace, click **Deploy** (or run the deployment skill).
2. Replit provisions a PostgreSQL database, builds both artifacts, and serves the frontend + API behind the same domain. The same-origin reverse-proxy means **none** of the cross-origin cookie/CORS plumbing matters.
3. You get a `*.replit.app` URL (or attach a custom domain).

This is the fastest path. The GitHub Pages route is best when you specifically want the frontend on GitHub's CDN (e.g. for an open-source demo) or when you already pay for Railway.

---

## Updating after the first deploy

- **Schema changes.** Edit `lib/db/src/schema/*.ts`, then run `DATABASE_URL=... pnpm --filter @workspace/db run push` against Railway's database.
- **API contract changes.** Edit `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen`, commit. The next push to `main` rebuilds the frontend with the regenerated client.
- **Frontend-only changes.** Push to `main`. GitHub Actions does the rest.
- **API-only changes.** Push to your Railway-connected branch (Railway auto-deploys).
