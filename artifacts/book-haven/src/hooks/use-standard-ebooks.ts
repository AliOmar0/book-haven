import { useQuery } from "@tanstack/react-query";

// Standard Ebooks publishes meticulously-formatted public-domain EPUBs that
// are dramatically cleaner than Gutenberg's auto-generated files. Their
// catalog is much smaller than Gutenberg/Archive (~1k titles), so we use it
// as a deep fallback for the cases where the first two sources have nothing.
//
// Search uses the public Atom feed at /feeds/atom/all?query=... — that
// endpoint is open (no Patrons Circle auth) but only returns proper Atom
// XML when an Accept: application/atom+xml header is sent. The endpoint
// also has no CORS headers, so we route through our same-origin proxy.

const SE_BASE = "https://standardebooks.org";
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

export interface StandardEbooksMatch {
  title: string;
  author?: string;
  epubUrl: string;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function score(
  entryTitle: string,
  entryAuthor: string | undefined,
  queryTitle: string,
  queryAuthor?: string,
): number {
  const nt = normalize(entryTitle);
  const nq = normalize(queryTitle);
  let s = 0;

  if (nt === nq) s += 100;
  else if (nt.startsWith(nq) || nq.startsWith(nt)) s += 60;
  else if (nt.includes(nq) || nq.includes(nt)) s += 40;

  if (queryAuthor && entryAuthor) {
    const na = normalize(entryAuthor);
    const naq = normalize(queryAuthor);
    if (na === naq) s += 60;
    else if (na.includes(naq) || naq.includes(na)) s += 40;
  }

  return s;
}

async function fetchSEFeed(query: string): Promise<Document | null> {
  // Default per-page is only 3, which is too few — SE's relevance ordering
  // can push the canonical edition off the first page for common queries.
  // The full catalog is ~1k titles so per-page=50 still returns quickly.
  const upstream = `${SE_BASE}/feeds/atom/all?query=${encodeURIComponent(query)}&per-page=50`;
  const proxied =
    `${API_BASE}/api/proxy/epub` +
    `?url=${encodeURIComponent(upstream)}` +
    `&accept=${encodeURIComponent("application/atom+xml")}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(proxied, { signal: ctrl.signal, credentials: "include" });
    if (!res.ok) return null;
    const xml = await res.text();
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length > 0) return null;
    return doc;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function pickBestFromDoc(
  doc: Document,
  title: string,
  author?: string,
): { match: StandardEbooksMatch; score: number } | null {
  const entries = Array.from(doc.getElementsByTagName("entry"));
  let best: { match: StandardEbooksMatch; score: number } | null = null;

  for (const entry of entries) {
    const entryTitle = entry.getElementsByTagName("title")[0]?.textContent?.trim() ?? "";
    if (!entryTitle) continue;

    const authorEl = entry.getElementsByTagName("author")[0];
    const entryAuthor = authorEl?.getElementsByTagName("name")[0]?.textContent?.trim();

    // SE publishes 3 EPUB variants per book: the canonical .epub (broadest
    // reader compatibility), _advanced.epub (uses CSS3 features that some
    // readers choke on), and .kepub.epub (Kobo-specific). Prefer the
    // canonical one — that's what epub.js handles best.
    const links = Array.from(entry.getElementsByTagName("link"));
    let epubUrl: string | undefined;
    for (const l of links) {
      const href = l.getAttribute("href") ?? "";
      const type = l.getAttribute("type") ?? "";
      if (type !== "application/epub+zip") continue;
      if (/_advanced\.epub|\.kepub\.epub/i.test(href)) continue;
      epubUrl = href;
      break;
    }
    if (!epubUrl) continue;

    const s = score(entryTitle, entryAuthor, title, author);
    if (!best || s > best.score) {
      best = { match: { title: entryTitle, author: entryAuthor, epubUrl }, score: s };
    }
  }
  return best;
}

async function searchStandardEbooks(
  title: string,
  author?: string,
): Promise<StandardEbooksMatch | null> {
  // SE's "search" is essentially author-tokenized — title queries return
  // unrelated books (e.g. "pride and prejudice" returns Conrad/Wodehouse
  // and not P&P at all), but `query=austen` returns every Austen work in
  // the catalog. So when we have an author, prefer an author-only query
  // and let the title-similarity scorer pick the canonical edition. We
  // still race a title-only query in parallel as a fallback for cases
  // where the author lookup misses (anonymous works, missing OL author
  // record, transliterated names that don't match SE's spelling).
  const queries = author ? [author, title] : [title];
  const docs = await Promise.all(queries.map(fetchSEFeed));

  let best: { match: StandardEbooksMatch; score: number } | null = null;
  for (const doc of docs) {
    if (!doc) continue;
    const candidate = pickBestFromDoc(doc, title, author);
    if (candidate && (!best || candidate.score > best.score)) {
      best = candidate;
    }
  }

  // Require at least a partial title match to avoid pulling unrelated
  // books from the catalog when the title isn't in SE's collection.
  if (!best || best.score < 40) return null;
  return best.match;
}

export function useStandardEbooksMatch(
  title?: string,
  author?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ["standardebooks-match", title, author],
    queryFn: () => searchStandardEbooks(title!, author),
    enabled: !!title && enabled,
    staleTime: 1000 * 60 * 60,
    retry: false,
  });
}
