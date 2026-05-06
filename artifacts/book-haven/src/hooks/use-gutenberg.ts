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

function coverFor(b: GutenbergBook): string | undefined {
  return b.formats["image/jpeg"] || b.formats["image/png"] || undefined;
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
      // Author names are often "Last, First" — compare last name token too.
      const lastFromComma = na.split(",")[0]?.trim();
      return na.includes(nAuthor) || nAuthor.includes(na) ||
        (lastFromComma && nAuthor.includes(lastFromComma));
    });
    if (matches) s += 50;
  }

  if (b.languages.includes("en")) s += 30;
  if (epubFor(b)) s += 20;
  s += Math.min(b.download_count / 10000, 5);

  return s;
}

async function searchGutendex(params: string): Promise<GutenbergBook[]> {
  try {
    const res = await fetch(`${GUTENDEX_URL}?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []) as GutenbergBook[];
  } catch {
    return [];
  }
}

function isAsciiSafe(s: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]*$/.test(s);
}

export interface GutenbergMatch {
  book: GutenbergBook;
  epubUrl: string;
  coverUrl?: string;
}

export function useGutenbergMatch(title?: string, author?: string) {
  // Skip author when it contains non-ASCII chars — Gutendex stores English
  // transliterations (e.g. "Dostoyevsky") which won't match Open Library's
  // native-script author names. Use `safeAuthor` in the queryKey so that
  // resolving an unusable author later doesn't force a redundant refetch
  // (and an extra "Looking up…" → "Not available" flicker).
  const safeAuthor = author && isAsciiSafe(author) ? author : "";
  return useQuery({
    queryKey: ["gutenberg-match", title, safeAuthor],
    queryFn: async (): Promise<GutenbergMatch | null> => {
      if (!title) return null;
      const queries = [
        `search=${encodeURIComponent(title)}&languages=en`,
        `search=${encodeURIComponent(`${title} ${safeAuthor}`.trim())}&languages=en`,
        `search=${encodeURIComponent(title)}`,
        `search=${encodeURIComponent(`${title} ${safeAuthor}`.trim())}`,
      ];

      const seen = new Set<number>();
      const candidates: GutenbergBook[] = [];

      for (const q of queries) {
        const results = await searchGutendex(q);
        for (const r of results) {
          if (seen.has(r.id)) continue;
          seen.add(r.id);
          if (epubFor(r)) candidates.push(r);
        }
        if (candidates.length >= 8) break;
      }

      if (!candidates.length) return null;

      candidates.sort((a, b) => score(b, title, safeAuthor) - score(a, title, safeAuthor));
      const best = candidates[0];

      return {
        book: best,
        epubUrl: epubFor(best)!,
        coverUrl: coverFor(best),
      };
    },
    enabled: !!title,
    staleTime: 1000 * 60 * 60,
  });
}
