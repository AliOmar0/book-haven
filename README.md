# Book Haven

A cozy, mobile-first web app for discovering and reading classic public-domain books. Browse Open Library, read in a built-in EPUB and PDF reader, save favorites and share short reviews.

- 3D book-stack hero on a warm parchment home page
- Search by title with subject, language, and ebook-only filters
- In-app EPUB reader (sepia/light/dark themes, bookmarks, highlights, auto-resume)
- In-app PDF reader (themed, bookmarked, paginated, auto-resume)
- "My Shelf" of favorites synced per device
- Public "Reader's Notes" community wall

## Stack

- **Frontend:** React 19, Vite, Tailwind CSS, wouter, TanStack Query, three.js, framer-motion, epub.js, react-pdf
- **Backend:** Express, Drizzle ORM, PostgreSQL
- **Contract:** OpenAPI spec in `lib/api-spec/openapi.yaml`, typed client in `@workspace/api-client-react`
- **Sources:** Open Library (metadata + ratings), Project Gutenberg via Gutendex (EPUB/PDF), Internet Archive (deep fallback), Google Books (cover/synopsis fallback)

## Repository layout

This is a [pnpm workspace](https://pnpm.io/workspaces) monorepo:

```text
artifacts/
  book-haven/        # React + Vite frontend (the deployable web app)
  api-server/        # Express + Drizzle API (favorites, reviews, file proxy)
  mockup-sandbox/    # Internal component preview sandbox (dev only)
lib/
  api-spec/          # OpenAPI contract + Orval codegen config
  api-client-react/  # Generated TanStack Query hooks
  db/                # Drizzle schema and client
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full deployment instructions, including how to publish the frontend to GitHub Pages and the API to Railway.

## Quick start (local)

Prerequisites: Node.js 24+, pnpm 10+, a PostgreSQL database.

```bash
# 1. Install
pnpm install

# 2. Provision the database schema
DATABASE_URL=postgres://... pnpm --filter @workspace/db run push

# 3. Generate the typed API client (only needed after editing openapi.yaml)
pnpm --filter @workspace/api-spec run codegen

# 4. Run the API server (port from $PORT, defaults to 8080 in workflows)
PORT=8080 DATABASE_URL=postgres://... pnpm --filter @workspace/api-server run dev

# 5. Run the frontend
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/book-haven run dev
```

The frontend will look for the API at the same origin under `/api/...`. In Replit, the workspace reverse-proxy makes this work out of the box. To point at a remote API instead, set `VITE_API_URL` (see `artifacts/book-haven/.env.example`).

## Environment variables

| Variable              | Where                | Required | Notes                                                                                          |
| --------------------- | -------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | API server           | Yes      | PostgreSQL connection string.                                                                  |
| `SESSION_SECRET`      | API server           | No       | Reserved; not currently used at runtime.                                                       |
| `CROSS_SITE_COOKIES`  | API server           | No       | Set to `1` when the API is on a different origin than the frontend (e.g. Railway + GH Pages). Switches the device cookie to `SameSite=None; Secure`. |
| `PORT`                | Both                 | Yes      | Port the service listens on.                                                                   |
| `BASE_PATH`           | Frontend (build)     | No       | Vite `base`. Defaults to `/`. Set to `/<repo>/` for a GitHub Pages project site.               |
| `VITE_API_URL`        | Frontend (build)     | No       | Public origin of the API (no trailing slash, no `/api`). Required when frontend ≠ API origin.  |

## Common tasks

- `pnpm run typecheck` — typecheck everything
- `pnpm --filter @workspace/api-spec run codegen` — regenerate the typed client after editing `openapi.yaml`
- `pnpm --filter @workspace/db run push` — push Drizzle schema to PostgreSQL
- `pnpm --filter @workspace/book-haven run build` — production frontend build (output in `artifacts/book-haven/dist/public`)

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full step-by-step guide covering:

- Publishing the API to Railway (with a managed Postgres add-on)
- Publishing the frontend to GitHub Pages via the included GitHub Actions workflow
- CORS, cookies, and the cross-origin gotchas you'll hit
- One-click alternative: deploying the entire stack on Replit Deployments

## Project notes

Project-specific architecture decisions, gotchas, and editing pointers live in [`replit.md`](./replit.md).
