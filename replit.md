# Book Haven

A cozy, mobile-first web app for discovering and reading classic books, with a built-in EPUB reader, page-flip transitions, and local star ratings & reviews.

## Run & Operate

- `pnpm --filter @workspace/book-haven run dev` — run the web app
- `pnpm --filter @workspace/book-haven run build` — production build
- `pnpm run typecheck` — typecheck across all packages
- No env vars or database required (all data fetched live from public APIs; user data stored in localStorage)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind, wouter (routing), TanStack Query (fetching/cache)
- Animation: Framer Motion (page-flip 3D transitions, scroll reveals)
- EPUB reader: epubjs
- Lazy-loading: react-intersection-observer

## Where things live

- `artifacts/book-haven/src/pages/` — Home, Search, Book detail, Read (EPUB reader), Library
- `artifacts/book-haven/src/components/` — UI components (cover-image, layout, etc.)
- `artifacts/book-haven/src/index.css` — theme tokens (cozy luxury palette + Cormorant/Inter fonts)
- `artifacts/api-server/` — present but unused by Book Haven (kept for future use)

## Architecture decisions

- **No backend / no database.** Book metadata + ratings come from Open Library, EPUBs from Project Gutenberg via Gutendex. User-added star ratings, reviews, and favorites persist in `localStorage` keyed by Open Library work ID.
- **CORS proxy for EPUBs:** Project Gutenberg blocks browser CORS, so EPUB downloads are routed through `https://corsproxy.io/?url=<encoded>` before being handed to epubjs.
- **Open Library ratings shown as the "community rating":** Goodreads' public API was discontinued, so Open Library's `ratings.json` is used and styled prominently as the community/social proof number.
- **Mobile-first** with bottom nav on small screens, top nav on desktop.

## Product

- Browse curated shelves of classic books on a cozy, library-themed home page
- Search Open Library with subject/language/ebook filters
- Book detail pages with cover, synopsis, community rating, plus user star rating + comments (local)
- In-app EPUB reader with page-flip animation, theme toggle (sepia/light/dark), font-size, and TOC
- Personal "My Shelf" of favorited books

## User preferences

- No emojis in the UI

## Gotchas

- Project Gutenberg EPUBs MUST be fetched through the CORS proxy — direct fetches will fail in the browser.
- Not every Open Library work has a cover or a Gutenberg EPUB; UI must degrade gracefully.

## Pointers

- Open Library API: https://openlibrary.org/developers/api
- Gutendex (Project Gutenberg): https://gutendex.com/
- See the `pnpm-workspace` skill for workspace structure
