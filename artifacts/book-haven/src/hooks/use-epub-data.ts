import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";

const PROXIES = [
  // Same-origin first-party proxy is most reliable.
  (url: string) => `/api/proxy/epub?url=${encodeURIComponent(url)}`,
  // Public CORS proxy as last-ditch fallback.
  (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
];

export type ProgressCallback = (loaded: number, total: number) => void;

export const epubDataQueryKey = (url: string | null | undefined) =>
  ["epub-data", url] as const;

async function fetchWithProgress(
  url: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body?.getReader();
  if (!reader) return await res.arrayBuffer();

  const chunks: Uint8Array[] = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.length;
      onProgress?.(loaded, total);
    }
  }
  const merged = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged.buffer;
}

export async function fetchEpubData(
  epubUrl: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  let lastErr: unknown = null;
  for (const proxy of PROXIES) {
    try {
      return await fetchWithProgress(proxy(epubUrl), onProgress, signal);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Failed to download EPUB");
}

export function useEpubData(
  epubUrl: string | null | undefined,
  onProgress?: ProgressCallback,
) {
  // Stash the latest progress callback in a ref so it stays current without
  // forcing the query to refetch.
  const progressRef = useRef<ProgressCallback | undefined>(onProgress);
  progressRef.current = onProgress;

  return useQuery({
    queryKey: epubDataQueryKey(epubUrl),
    queryFn: ({ signal }) =>
      fetchEpubData(
        epubUrl!,
        (loaded, total) => progressRef.current?.(loaded, total),
        signal,
      ),
    enabled: !!epubUrl,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    retry: 1,
  });
}

/** Prefetch an EPUB so opening the reader is instant. */
export function usePrefetchEpub() {
  const qc = useQueryClient();
  return useCallback(
    (epubUrl: string | null | undefined) => {
      if (!epubUrl) return;
      qc.prefetchQuery({
        queryKey: epubDataQueryKey(epubUrl),
        queryFn: ({ signal }) => fetchEpubData(epubUrl, undefined, signal),
        staleTime: Infinity,
      });
    },
    [qc],
  );
}
