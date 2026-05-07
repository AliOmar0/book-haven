import { useQuery } from "@tanstack/react-query";

const OL_BASE = "https://openlibrary.org";
const ARCHIVE_BASE = "https://archive.org";

interface ArchiveFile {
  name: string;
  format?: string;
  size?: string;
}

interface ArchiveMetadata {
  metadata?: {
    identifier?: string;
    "access-restricted-item"?: string | boolean;
    mediatype?: string;
    title?: string;
    creator?: string | string[];
    language?: string | string[];
  };
  files?: ArchiveFile[];
}

export interface ArchiveMatch {
  identifier: string;
  title?: string;
  epubUrl?: string;
  pdfUrl?: string;
}

interface OLEdition {
  ocaid?: string;
  languages?: { key: string }[];
  publish_date?: string;
}

async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let t: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<T>((resolve) => {
    t = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (t) clearTimeout(t);
  }
}

async function fetchEditions(workId: string): Promise<OLEdition[]> {
  const id = workId.startsWith("/works/") ? workId : `/works/${workId}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(`${OL_BASE}${id}/editions.json?limit=50`, { signal: ctrl.signal });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.entries || []) as OLEdition[];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function fetchMetadata(ocaid: string): Promise<ArchiveMetadata | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`${ARCHIVE_BASE}/metadata/${encodeURIComponent(ocaid)}`, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.metadata) return null;
    return data as ArchiveMetadata;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function searchArchive(title: string, author?: string): Promise<string[]> {
  // Title + format filter, ranked by downloads. The `-access-restricted-item:true`
  // filter excludes loan-only books up front, so we don't waste probe budget on
  // items that would be unusable even if they have files.
  const escTitle = title.replace(/"/g, "");
  let q = `title:"${escTitle}" AND mediatype:texts AND (format:"Text PDF" OR format:EPUB) AND -access-restricted-item:true`;
  if (author) {
    const escAuthor = author.replace(/"/g, "");
    q += ` AND creator:"${escAuthor}"`;
  }
  const params = new URLSearchParams();
  params.append("q", q);
  params.append("fl[]", "identifier");
  params.append("sort[]", "downloads desc");
  params.append("rows", "10");
  params.append("output", "json");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(`${ARCHIVE_BASE}/advancedsearch.php?${params.toString()}`, { signal: ctrl.signal });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.response?.docs || []).map((d: { identifier: string }) => d.identifier).filter(Boolean);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function isRestricted(meta: ArchiveMetadata): boolean {
  const v = meta.metadata?.["access-restricted-item"];
  if (v === true || v === "true") return true;
  return false;
}

function pickFiles(meta: ArchiveMetadata): { epub?: string; pdf?: string } {
  const files = meta.files || [];
  let epub: string | undefined;
  let pdf: string | undefined;
  for (const f of files) {
    if (!f.name) continue;
    // Skip DRM-encrypted variants — they require Adobe Digital Editions / LCP.
    if (/_encrypted|_lcp/i.test(f.name)) continue;
    const isEpub = f.format === "EPUB" || /\.epub$/i.test(f.name);
    const isPdf = f.format === "Text PDF" || (/\.pdf$/i.test(f.name) && f.format !== "Image Container PDF" && f.format !== "Additional Text PDF");
    if (isEpub && !epub) epub = f.name;
    if (isPdf && !pdf) pdf = f.name;
  }
  return { epub, pdf };
}

function downloadUrl(ocaid: string, filename: string): string {
  return `${ARCHIVE_BASE}/download/${encodeURIComponent(ocaid)}/${encodeURIComponent(filename)}`;
}

// Identifier prefixes whose EPUBs are notoriously low-quality auto-conversions
// (image-only or malformed OPF). They usually have a usable PDF, so we keep
// them but drop their EPUB.
const FLAKY_EPUB_PREFIXES = ["bwb_", "in.ernet.dli."];

function epubLikelyUsable(ocaid: string): boolean {
  return !FLAKY_EPUB_PREFIXES.some((p) => ocaid.startsWith(p));
}

async function probeCandidates(ocaids: string[]): Promise<ArchiveMatch | null> {
  if (!ocaids.length) return null;
  const settled = await Promise.allSettled(ocaids.map(fetchMetadata));
  // Score each candidate: prefer items with both PDF and EPUB, drop EPUB-only
  // entries from flaky prefixes, prefer items whose mediatype is "texts".
  const viable: { ocaid: string; meta: ArchiveMetadata; epub?: string; pdf?: string; score: number }[] = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    if (r.status !== "fulfilled" || !r.value) continue;
    const meta = r.value;
    if (isRestricted(meta)) continue;
    if (meta.metadata?.mediatype && meta.metadata.mediatype !== "texts") continue;
    const ocaid = ocaids[i];
    let { epub, pdf } = pickFiles(meta);
    if (epub && !epubLikelyUsable(ocaid)) epub = undefined;
    if (!epub && !pdf) continue;
    let score = 0;
    if (pdf) score += 10;
    if (epub) score += 6;
    if (pdf && epub) score += 3;
    viable.push({ ocaid, meta, epub, pdf, score });
  }
  if (!viable.length) return null;
  viable.sort((a, b) => b.score - a.score);
  const best = viable[0];
  return {
    identifier: best.ocaid,
    title: best.meta.metadata?.title,
    epubUrl: best.epub ? downloadUrl(best.ocaid, best.epub) : undefined,
    pdfUrl: best.pdf ? downloadUrl(best.ocaid, best.pdf) : undefined,
  };
}

export function useArchiveMatch(workId?: string, title?: string, author?: string, enabled = true) {
  return useQuery({
    queryKey: ["archive-match", workId, title, author],
    queryFn: async (): Promise<ArchiveMatch | null> => {
      if (!workId) return null;

      // Two strategies in parallel:
      //   (a) ocaids attached to OL editions of this work — most precise
      //       when populated, but many works have no ocaids or only access-restricted ones.
      //   (b) IA full-text search by title (+ optional author), filtered to
      //       non-restricted items that actually have PDF/EPUB files.
      // First strategy that returns a viable match wins.

      const editionsP = (async () => {
        const editions = await fetchEditions(workId);
        const seen = new Set<string>();
        const englishFirst: string[] = [];
        const others: string[] = [];
        for (const e of editions) {
          if (!e.ocaid || seen.has(e.ocaid)) continue;
          seen.add(e.ocaid);
          const isEn = (e.languages || []).some((l) => /\/languages\/(eng|en)$/.test(l.key));
          if (isEn) englishFirst.push(e.ocaid);
          else others.push(e.ocaid);
        }
        return probeCandidates([...englishFirst, ...others].slice(0, 10));
      })();

      const searchP = title
        ? (async () => {
            const ids = await searchArchive(title, author);
            return probeCandidates(ids.slice(0, 8));
          })()
        : Promise.resolve(null);

      const [a, b] = await Promise.all([
        withTimeout(editionsP, 25000, null),
        withTimeout(searchP, 25000, null),
      ]);
      // Prefer the editions-derived match (tied to this exact work record);
      // fall back to the title search.
      return a || b;
    },
    enabled: !!workId && enabled,
    staleTime: 1000 * 60 * 60,
    retry: false,
  });
}
