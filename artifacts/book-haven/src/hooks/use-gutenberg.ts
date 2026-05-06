import { useQuery } from "@tanstack/react-query";

const GUTENDEX_URL = "https://gutendex.com/books";

export interface GutenbergBook {
  id: number;
  title: string;
  authors: { name: string; birth_year: number; death_year: number }[];
  formats: Record<string, string>;
  download_count: number;
}

export function useGutenbergMatch(title?: string, author?: string) {
  return useQuery({
    queryKey: ["gutenberg-search", title, author],
    queryFn: async () => {
      if (!title) return null;
      
      // Try to find an exactish match
      const query = `${title} ${author || ""}`.trim();
      const res = await fetch(`${GUTENDEX_URL}?search=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Failed to fetch from Gutendex");
      const data = await res.json();
      
      const books = data.results as GutenbergBook[];
      if (!books.length) return null;
      
      // We look for a book that has an epub
      const book = books.find(b => b.formats["application/epub+zip"]);
      return book || null;
    },
    enabled: !!title,
  });
}
