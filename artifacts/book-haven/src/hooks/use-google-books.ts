import { useQuery } from "@tanstack/react-query";

interface GoogleVolume {
  id: string;
  volumeInfo: {
    title?: string;
    authors?: string[];
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

export function useGoogleBooksCover(title?: string, author?: string) {
  return useQuery({
    queryKey: ["google-books-cover", title, author],
    queryFn: async (): Promise<string | null> => {
      if (!title) return null;
      const parts = [`intitle:${JSON.stringify(title)}`];
      if (author) parts.push(`inauthor:${JSON.stringify(author)}`);
      const q = parts.join("+");
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5&printType=books`,
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { items?: GoogleVolume[] };
      const items = data.items || [];
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
