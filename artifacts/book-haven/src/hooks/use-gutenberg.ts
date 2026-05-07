import { useQuery } from "@tanstack/react-query";

const GUTENDEX_URL = "https://gutendex.com/books/";

export interface GutenbergBook {
  id: number;
  title: string;
  authors: { name: string; birth_year: number | null; death_year: number | null }[];
  formats: Record<string, string>;
  download_count: number;
  languages: string[];
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

function epubFor(b: GutenbergBook): string | undefined {
  return (
    b.formats["application/epub+zip"] ||
    b.formats["application/epub"] ||
    undefined
  );
}

function pdfFor(b: GutenbergBook): string | undefined {
  // Gutendex sometimes appends "; charset=utf-8" or version suffixes
  for (const key of Object.keys(b.formats)) {
    if (key.startsWith("application/pdf")) return b.formats[key];
  }
  return undefined;
}

function coverFor(b: GutenbergBook): string | undefined {
  for (const key of Object.keys(b.formats)) {
    if (key.startsWith("image/jpeg") || key.startsWith("image/png")) {
      return b.formats[key];
    }
  }
  return undefined;
}

function score(b: GutenbergBook, title: string, author?: string): number {
  const nTitle = normalize(title);
  const nBookTitle = normalize(b.title);
  let s = 0;

  if (nBookTitle === nTitle) s += 100;
  else if (nBookTitle.startsWith(nTitle) || nTitle.startsWith(nBookTitle)) s += 60;
  else if (nBookTitle.includes(nTitle) || nTitle.includes(nBookTitle)) s += 40;

  if (author) {
    const nAuthor = normalize(author);
    const matches = b.authors.some((a) => {
      const na = normalize(a.name);
      const lastFromComma = na.split(",")[0]?.trim();
      return na.includes(nAuthor) || nAuthor.includes(na) ||
        (lastFromComma && nAuthor.includes(lastFromComma));
    });
    if (matches) s += 50;
  }

  if (b.languages.includes("en")) s += 30;
  if (epubFor(b)) s += 20;
  if (pdfFor(b)) s += 5;
  s += Math.min(b.download_count / 10000, 5);

  return s;
}

async function searchGutendex(params: string): Promise<GutenbergBook[]> {
  const ctrl = new AbortController();
  // Gutendex is occasionally slow. With 4 queries running in parallel,
  // total wait is capped at this per-request limit (vs ~24s if we had
  // chained 4 × 6s sequentially as the old implementation did).
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${GUTENDEX_URL}?${params}`, { signal: ctrl.signal });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []) as GutenbergBook[];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function isAsciiSafe(s: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]*$/.test(s);
}

export interface GutenbergMatch {
  book: GutenbergBook;
  epubUrl?: string;
  pdfUrl?: string;
  coverUrl?: string;
}

export function useGutenbergMatch(title?: string, author?: string) {
  const safeAuthor = author && isAsciiSafe(author) ? author : "";
  return useQuery({
    queryKey: ["gutenberg-match", title, safeAuthor],
    queryFn: async (): Promise<GutenbergMatch | null> => {
      if (!title) return null;

      // Run all four search strategies in parallel — cuts worst-case wait
      // from ~24s (sequential 4 × 6s timeout) down to a single ~6s window.
      const queries = [
        `search=${encodeURIComponent(title)}&languages=en`,
        `search=${encodeURIComponent(`${title} ${safeAuthor}`.trim())}&languages=en`,
        `search=${encodeURIComponent(title)}`,
        `search=${encodeURIComponent(`${title} ${safeAuthor}`.trim())}`,
      ];

      const settled = await Promise.allSettled(queries.map(searchGutendex));
      const seen = new Set<number>();
      const candidates: GutenbergBook[] = [];
      for (const r of settled) {
        if (r.status !== "fulfilled") continue;
        for (const book of r.value) {
          if (seen.has(book.id)) continue;
          seen.add(book.id);
          if (epubFor(book) || pdfFor(book)) candidates.push(book);
        }
      }

      if (!candidates.length) return null;

      candidates.sort((a, b) => score(b, title, safeAuthor) - score(a, title, safeAuthor));
      const best = candidates[0];

      return {
        book: best,
        epubUrl: epubFor(best),
        pdfUrl: pdfFor(best),
        coverUrl: coverFor(best),
      };
    },
    enabled: !!title,
    staleTime: 1000 * 60 * 60,
    retry: false,
  });
}
