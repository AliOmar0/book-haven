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
- `artifacts/book-haven/src/components/hero-3d.tsx` — Three.js floating book stack with PBR leather covers, gold trim, dramatic 3-point lighting (lazy + WebGL error boundary)
- `artifacts/book-haven/src/hooks/use-local-library.ts` — wraps generated favorites/reviews hooks
- `artifacts/book-haven/src/lib/clean-description.ts` — strips Open Library markdown/footnote noise
- `artifacts/book-haven/src/hooks/use-gutenberg.ts` — Gutendex matcher (English-first, ASCII-author-only, scored, parallel queries, returns both `epubUrl` and `pdfUrl`)
- `artifacts/book-haven/src/hooks/use-google-books.ts` — Google Books cover fallback + `useGoogleBookInfo` (description/publisher)
- `artifacts/book-haven/src/hooks/use-enhanced-description.ts` — Picks the best synopsis: Google Books description first, Open Library cleaned text fallback
- `artifacts/book-haven/src/hooks/use-epub-data.ts` — TanStack Query book-file ArrayBuffer cache (`useBookFile`/`usePrefetchBookFile` work for both EPUB and PDF; `useEpubData`/`usePrefetchEpub` retained as aliases)
- `artifacts/book-haven/src/hooks/use-reader-state.ts` — per-workId localStorage state (lastCfi, bookmarks, highlights)
- `artifacts/api-server/src/routes/proxy.ts` — same-origin file proxy (`/api/proxy/epub?url=…`, allowlists gutenberg.org). Despite the path name "epub", forwards the upstream Content-Type so it serves PDFs and any other Gutenberg file.
- `artifacts/book-haven/src/pages/read-pdf.tsx` — PDF reader (react-pdf), mirrors the EPUB reader's chrome (themes, sidebar, toolbar, slide+sweep animation). Bookmarks keyed by page number; reader state namespaced as `<workId>:pdf` so it doesn't collide with EPUB CFIs.
- `artifacts/book-haven/src/index.css` — warm parchment theme tokens, Cormorant/Inter fonts
- `lib/db/src/schema/{favorites,reviews}.ts` — DB schema (deviceId + workId composite uniqueness on favorites)
- `lib/api-spec/openapi.yaml` — contract for `/api/favorites` and `/api/reviews`
- `artifacts/api-server/src/routes/{favorites,reviews}.ts` + `middlewares/device-id.ts` — server impl

## Architecture decisions

- **Per-device identity, no login.** A first-party `bh_device` httpOnly cookie (UUID) issued by `device-id` middleware scopes favorites and reviews. Cross-origin won't work; relies on the workspace reverse-proxy keeping the API same-origin.
- **Books/covers/ratings stay live from APIs.** Open Library for metadata + community ratings; Project Gutenberg via Gutendex for EPUBs **and PDFs** (both surfaced when available). Only user-generated favorites/reviews live in Postgres.
- **Synopsis prefers a richer source.** `useEnhancedDescription` chains Google Books `volumeInfo.description` (publisher-grade blurbs) → cleaned Open Library description → empty. The source is shown as a tiny "via Google Books" / "via Open Library" tag next to the heading.
- **Dual-format reading.** Book detail surfaces a "Read EPUB" + "Read PDF" stack when both formats exist (EPUB primary). Each button prefetches its file on hover/focus/touch via `usePrefetchBookFile`. EPUB → `/read/:workId?epub=…`, PDF → `/read-pdf/:workId?pdf=…`. The PDF reader uses `react-pdf` with `pdfjs-dist` pinned to the version `react-pdf` bundles internally to avoid worker/API version mismatches.
- **Faster edition lookup.** The four Gutendex search variants run in parallel via `Promise.allSettled` (was sequential, ~24s worst case). Per-request timeout is 20s — wall-clock is bounded at 20s instead of summing.
- **First-party EPUB proxy.** Project Gutenberg blocks browser CORS, so EPUB downloads route through our own `/api/proxy/epub?url=…` route (allowlists `www.gutenberg.org`). Public CORS proxies (corsproxy.io) are kept only as last-ditch fallback. The proxy streams the body through and caches in TanStack Query (`gcTime: 1h`, `staleTime: Infinity`) as an ArrayBuffer — page turns never refetch.
- **English-edition preference.** `useGutenbergMatch` queries Gutendex with `&languages=en` first, skips author when it contains non-ASCII (since OL stores native-script names like Достоевский but Gutendex stores transliterations like "Dostoyevsky"), and scores candidates by title/author similarity + English bonus + EPUB presence + downloads.
- **Cover fallback chain.** `<CoverImage src fallbacks={[…]} />` walks Open Library → Gutendex `image/jpeg` → Google Books `imageLinks` on each `onError`.
- **3D hero is progressive enhancement.** `hero-3d.tsx` is `React.lazy` and wrapped in a WebGL detection check + error boundary; environments without WebGL get a warm gradient fallback.
- **EPUB reader mounts once per book.** Theme/font-size apply via `rendition.themes.*` without remount. Page-turn animation is a Framer Motion `useAnimationControls` slide+opacity dim on the viewer wrapper plus an `AnimatePresence` gradient sweep keyed per turn (no fake 3D flip overlay). Auto-resume calls `rendition.display(lastCfi)`; if that CFI is invalid (different edition), it falls back to `rendition.display()` and clears `lastCfi` so the reader never bricks. EPUB rendition runs with `allowScriptedContent: false` since EPUBs are untrusted third-party content.
- **Reader state is per-device, per-workId, in localStorage.** `useReaderState(workId)` persists `{ lastCfi, bookmarks[], highlights[] }` under `bh:reader:<workId>`. Bookmarks store a CFI + chapter label; highlights store a CFI range + color id (yellow/pink/blue/green) + selected text and are rehydrated via `rendition.annotations.add("highlight", ...)` after each `display()` resolves. Removal goes through `rendition.annotations.remove(cfi, "highlight")` plus the `markClicked` event.
- **EPUB prefetch on intent.** `usePrefetchEpub()` is wired to the "Read Now" button's `mouseenter`/`focus`/`touchstart` so the ArrayBuffer is usually already cached by the time the reader mounts. Download progress is shown as a percentage + bytes during the first fetch.
- **Reviews are public ("Reader's Notes" community wall).** Favorites are per-device (scoped by `bh_device` cookie). Reviews are intentionally readable by all visitors — only the act of posting is device-tied. If this should ever change, scope `GET /reviews/:workId` by `req.deviceId` and remove the public listing.

## Product

- Cinematic 3D book-stack hero on a warm parchment home page, alternating wooden shelves
- Search Open Library with subject/language/ebook-only filters and live debounce
- Book detail with cover, cleaned synopsis, community rating, plus star reviews
- In-app EPUB reader: sepia/light/dark themes, font-size, TOC sidebar with Contents/Bookmarks/Highlights tabs, bookmarks (B key or toolbar button), text highlighting in 4 colors, auto-resume to last position, swipe + arrow keys, download progress, soft slide+sweep page-turn animation
- In-app PDF reader (react-pdf): same visual chrome, themed via mix-blend-mode, sidebar with Contents (PDF outline) + Bookmarks tabs, page bookmarks, auto-resume to last page, zoom in/out, swipe + arrow keys, download progress, same slide+sweep animation
- "My Shelf" of favorites synced per device

## User preferences

- No emojis in the UI

## Gotchas

- Project Gutenberg files (EPUB and PDF) MUST be fetched through the same-origin proxy.
- Gutendex requests have a 20s per-request `AbortController` timeout. They run in parallel, so the worst-case wait is 20s rather than 4 × 20s. Lower values starve slow-day responses entirely.
- `pdfjs-dist` MUST stay pinned to the version `react-pdf` bundles (currently 5.4.296 for react-pdf@10.4.x). A skewed version triggers the classic "API version does not match Worker version" error and breaks PDF rendering.
- PDF reader stores its state under `useReaderState("<workId>:pdf")` to avoid colliding with EPUB CFIs for the same work. PDF bookmarks store CFI as `pdf:<page>`.
- Generated client hooks accept `{ query, request }` (NOT `fetch`); use `request` for `RequestInit` overrides.
- @react-three/fiber must be v9+ for React 19 compatibility (older versions throw `ReactCurrentOwner` errors).
- `req.deviceId` is augmented via `declare global { namespace Express { ... } }` in `middlewares/device-id.ts` — keep that file imported wherever the type is needed.
- After editing `lib/api-spec/openapi.yaml` you must run `pnpm --filter @workspace/api-spec run codegen`.

## Pointers

- Open Library API: https://openlibrary.org/developers/api
- Gutendex (Project Gutenberg): https://gutendex.com/
- See the `pnpm-workspace` skill for workspace structure and OpenAPI codegen
