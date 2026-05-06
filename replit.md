# Book Haven

A cozy, mobile-first web app for discovering and reading classic books, with a 3D-rendered hero, in-app EPUB reader with page-flip animation, and per-device favorites & reviews stored in Postgres.

## Run & Operate

- `pnpm --filter @workspace/book-haven run dev` — web app
- `pnpm --filter @workspace/api-server run dev` — API server (favorites/reviews)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate OpenAPI types/hooks after editing the spec
- `pnpm --filter @workspace/db run push` — push Drizzle schema to Postgres
- `pnpm run typecheck` — typecheck across all packages
- Required env: `DATABASE_URL` (auto-provisioned by Replit). No third-party API keys.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + Tailwind, wouter (routing), TanStack Query
- 3D: three + @react-three/fiber v9 + @react-three/drei v10 (lazy-loaded)
- Animation: Framer Motion (page-flip overlay, scroll reveals)
- EPUB reader: epubjs
- Backend: Express (artifacts/api-server) + Drizzle ORM + Postgres, contract defined in `lib/api-spec/openapi.yaml`, typed client in `@workspace/api-client-react` (orval-generated)

## Where things live

- `artifacts/book-haven/src/pages/` — Home, Search, Book detail, Read (EPUB reader), Library
- `artifacts/book-haven/src/components/hero-3d.tsx` — Three.js floating book stack (lazy + WebGL error boundary)
- `artifacts/book-haven/src/hooks/use-local-library.ts` — wraps generated favorites/reviews hooks
- `artifacts/book-haven/src/lib/clean-description.ts` — strips Open Library markdown/footnote noise
- `artifacts/book-haven/src/index.css` — warm parchment theme tokens, Cormorant/Inter fonts
- `lib/db/src/schema/{favorites,reviews}.ts` — DB schema (deviceId + workId composite uniqueness on favorites)
- `lib/api-spec/openapi.yaml` — contract for `/api/favorites` and `/api/reviews`
- `artifacts/api-server/src/routes/{favorites,reviews}.ts` + `middlewares/device-id.ts` — server impl

## Architecture decisions

- **Per-device identity, no login.** A first-party `bh_device` httpOnly cookie (UUID) issued by `device-id` middleware scopes favorites and reviews. Cross-origin won't work; relies on the workspace reverse-proxy keeping the API same-origin.
- **Books/covers/ratings stay live from APIs.** Open Library for metadata + community ratings; Project Gutenberg via Gutendex for EPUBs. Only user-generated favorites/reviews live in Postgres.
- **CORS proxy for EPUBs.** Project Gutenberg blocks browser CORS, so EPUB downloads route through `https://corsproxy.io/?url=<encoded>` before reaching epubjs.
- **3D hero is progressive enhancement.** `hero-3d.tsx` is `React.lazy` and wrapped in a WebGL detection check + error boundary; environments without WebGL get a warm gradient fallback.
- **EPUB reader mounts once per book.** Theme/font-size apply via `rendition.themes.*` without remount. Page flip is a decorative Framer Motion overlay — actual paging is `rendition.next/prev`. EPUB rendition runs with `allowScriptedContent: false` since EPUBs are untrusted third-party content.
- **Reviews are public ("Reader's Notes" community wall).** Favorites are per-device (scoped by `bh_device` cookie). Reviews are intentionally readable by all visitors — only the act of posting is device-tied. If this should ever change, scope `GET /reviews/:workId` by `req.deviceId` and remove the public listing.

## Product

- Cinematic 3D book-stack hero on a warm parchment home page, alternating wooden shelves
- Search Open Library with subject/language/ebook-only filters and live debounce
- Book detail with cover, cleaned synopsis, community rating, plus star reviews
- In-app EPUB reader: sepia/light/dark themes, font-size, TOC, swipe + arrow keys, progress bar
- "My Shelf" of favorites synced per device

## User preferences

- No emojis in the UI

## Gotchas

- Project Gutenberg EPUBs MUST be fetched through the CORS proxy.
- Generated client hooks accept `{ query, request }` (NOT `fetch`); use `request` for `RequestInit` overrides.
- @react-three/fiber must be v9+ for React 19 compatibility (older versions throw `ReactCurrentOwner` errors).
- `req.deviceId` is augmented via `declare global { namespace Express { ... } }` in `middlewares/device-id.ts` — keep that file imported wherever the type is needed.
- After editing `lib/api-spec/openapi.yaml` you must run `pnpm --filter @workspace/api-spec run codegen`.

## Pointers

- Open Library API: https://openlibrary.org/developers/api
- Gutendex (Project Gutenberg): https://gutendex.com/
- See the `pnpm-workspace` skill for workspace structure and OpenAPI codegen
