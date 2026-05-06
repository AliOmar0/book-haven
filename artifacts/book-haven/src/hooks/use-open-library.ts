import { useQuery } from "@tanstack/react-query";

const OL_BASE_URL = "https://openlibrary.org";

export interface OLWork {
  key: string;
  title: string;
  author_name?: string[];
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

export function useSearchBooks(query: string) {
  return useQuery({
    queryKey: ["ol-search", query],
    queryFn: async () => {
      if (!query) return { docs: [] };
      const res = await fetch(
        `${OL_BASE_URL}/search.json?q=${encodeURIComponent(
          query
        )}&limit=24&fields=key,title,author_name,cover_i,first_publish_year,subject,ia,ebook_access,language,ratings_average,ratings_count`
      );
      if (!res.ok) throw new Error("Network response was not ok");
      const data = await res.json();
      return data as { docs: OLWork[] };
    },
    enabled: !!query,
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

// Format the image url
export function getCoverUrl(coverId?: number, size: "S" | "M" | "L" = "M") {
  if (!coverId) return undefined;
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}
