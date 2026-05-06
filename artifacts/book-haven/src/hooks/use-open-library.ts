import { useQuery } from "@tanstack/react-query";

const OL_BASE_URL = "https://openlibrary.org";

export interface OLWork {
  key: string;
  title: string;
  author_name?: string[];
  author_key?: string[];
  cover_i?: number;
  first_publish_year?: number;
  subject?: string[];
  ia?: string[];
  ebook_access?: string;
  language?: string[];
  ratings_average?: number;
  ratings_count?: number;
}

export interface OLWorkDetail {
  key: string;
  title: string;
  description?: string | { value: string };
  covers?: number[];
  subjects?: string[];
  authors?: { author: { key: string } }[];
  first_publish_date?: string;
}

export interface OLSubjectResponse {
  key: string;
  name: string;
  works: {
    key: string;
    title: string;
    cover_id?: number;
    authors?: { name: string }[];
    first_publish_year?: number;
  }[];
}

export interface SearchOptions {
  subject?: string;
  language?: string;
  ebookOnly?: boolean;
}

export function useSearchBooks(query: string, opts: SearchOptions = {}) {
  return useQuery({
    queryKey: ["ol-search", query, opts],
    queryFn: async () => {
      if (!query) return { docs: [] };
      const parts: string[] = [`q=${encodeURIComponent(query)}`];
      if (opts.subject) parts.push(`subject=${encodeURIComponent(opts.subject)}`);
      if (opts.language) parts.push(`language=${encodeURIComponent(opts.language)}`);
      if (opts.ebookOnly) parts.push(`has_fulltext=true`);
      parts.push("limit=24");
      parts.push(
        "fields=key,title,author_name,author_key,cover_i,first_publish_year,subject,ia,ebook_access,language,ratings_average,ratings_count",
      );
      const res = await fetch(`${OL_BASE_URL}/search.json?${parts.join("&")}`);
      if (!res.ok) throw new Error("Network response was not ok");
      const data = await res.json();
      return data as { docs: OLWork[] };
    },
    enabled: !!query,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSubjectBooks(subject: string) {
  return useQuery({
    queryKey: ["ol-subject", subject],
    queryFn: async () => {
      const res = await fetch(`${OL_BASE_URL}/subjects/${encodeURIComponent(subject)}.json?limit=20&details=true`);
      if (!res.ok) throw new Error("Network response was not ok");
      const data = await res.json();
      return data as OLSubjectResponse;
    },
    staleTime: 1000 * 60 * 30,
  });
}

export function useBookDetail(workId: string) {
  return useQuery({
    queryKey: ["ol-work", workId],
    queryFn: async () => {
      const id = workId.startsWith("/works/") ? workId : `/works/${workId}`;
      const res = await fetch(`${OL_BASE_URL}${id}.json`);
      if (!res.ok) throw new Error("Network response was not ok");
      const data = await res.json();
      return data as OLWorkDetail;
    },
    enabled: !!workId,
  });
}

export function useBookRatings(workId: string) {
  return useQuery({
    queryKey: ["ol-ratings", workId],
    queryFn: async () => {
      const id = workId.startsWith("/works/") ? workId : `/works/${workId}`;
      const res = await fetch(`${OL_BASE_URL}${id}/ratings.json`);
      if (!res.ok) return null;
      const data = await res.json();
      return data as { summary: { average: number; count: number } };
    },
    enabled: !!workId,
    retry: false,
  });
}

export function useAuthorName(authorKey?: string) {
  return useQuery({
    queryKey: ["ol-author", authorKey],
    queryFn: async () => {
      if (!authorKey) return null;
      const key = authorKey.startsWith("/authors/") ? authorKey : `/authors/${authorKey}`;
      const res = await fetch(`${OL_BASE_URL}${key}.json`);
      if (!res.ok) return null;
      const data = await res.json();
      return (data?.name as string) || null;
    },
    enabled: !!authorKey,
    staleTime: 1000 * 60 * 60,
  });
}

export function getCoverUrl(coverId?: number, size: "S" | "M" | "L" = "M") {
  if (!coverId) return undefined;
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}
