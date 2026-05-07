import { useQuery } from "@tanstack/react-query";

interface GoogleVolume {
  id: string;
  volumeInfo: {
    title?: string;
    authors?: string[];
    description?: string;
    publisher?: string;
    publishedDate?: string;
    imageLinks?: {
      smallThumbnail?: string;
      thumbnail?: string;
      small?: string;
      medium?: string;
      large?: string;
    };
  };
}

function upgradeCover(url: string): string {
  return url
    .replace(/^http:\/\//, "https://")
    .replace(/&edge=curl/, "")
    .replace(/&zoom=\d+/, "&zoom=1");
}

async function fetchVolumes(title: string, author?: string, max = 5): Promise<GoogleVolume[]> {
  const parts = [`intitle:${JSON.stringify(title)}`];
  if (author) parts.push(`inauthor:${JSON.stringify(author)}`);
  const q = parts.join("+");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=${max}&printType=books`,
      { signal: ctrl.signal },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: GoogleVolume[] };
    return data.items || [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export function useGoogleBooksCover(title?: string, author?: string) {
  return useQuery({
    queryKey: ["google-books-cover", title, author],
    queryFn: async (): Promise<string | null> => {
      if (!title) return null;
      const items = await fetchVolumes(title, author);
      for (const item of items) {
        const links = item.volumeInfo?.imageLinks;
        const url = links?.large || links?.medium || links?.small || links?.thumbnail;
        if (url) return upgradeCover(url);
      }
      return null;
    },
    enabled: !!title,
    staleTime: 1000 * 60 * 60 * 24,
    retry: false,
  });
}

export interface GoogleBookInfo {
  description?: string;
  publisher?: string;
  publishedDate?: string;
}

/**
 * Pulls a publisher-grade synopsis (and metadata) from Google Books, which
 * usually has cleaner, longer descriptions than Open Library.
 */
export function useGoogleBookInfo(title?: string, author?: string) {
  return useQuery({
    queryKey: ["google-books-info", title, author],
    queryFn: async (): Promise<GoogleBookInfo | null> => {
      if (!title) return null;
      const items = await fetchVolumes(title, author, 8);
      // Prefer the first item with a substantial description; otherwise fall
      // back to the first item with any description.
      let best: GoogleBookInfo | null = null;
      for (const item of items) {
        const v = item.volumeInfo;
        if (!v?.description) continue;
        const trimmed = v.description.trim();
        const info: GoogleBookInfo = {
          description: trimmed,
          publisher: v.publisher,
          publishedDate: v.publishedDate,
        };
        if (trimmed.length >= 200) return info;
        if (!best) best = info;
      }
      return best;
    },
    enabled: !!title,
    staleTime: 1000 * 60 * 60 * 24,
    retry: false,
  });
}
