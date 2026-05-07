import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";

// When the API is hosted on a different origin (e.g. frontend on GitHub
// Pages, API on Railway), VITE_API_URL points at the API origin and we
// prefix every proxy request with it. Otherwise we use a same-origin
// relative URL so the workspace reverse-proxy can route it.
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

const PROXIES = [
  // First-party proxy is most reliable. Despite the path name "epub", the
  // route streams whatever upstream returns (PDFs, EPUBs, etc.) and forwards
  // the upstream Content-Type.
  (url: string) => `${API_BASE}/api/proxy/epub?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
];

export type ProgressCallback = (loaded: number, total: number) => void;

export const bookFileQueryKey = (url: string | null | undefined) =>
  ["book-file", url] as const;

// Backwards-compat alias used by the EPUB reader
export const epubDataQueryKey = bookFileQueryKey;

async function fetchWithProgress(
  url: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  // credentials: "include" so the device cookie is sent in cross-origin
  // deployments (it's harmless on same-origin).
  const res = await fetch(url, { signal, credentials: "include" });
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

export async function fetchBookFile(
  url: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  let lastErr: unknown = null;
  for (const proxy of PROXIES) {
    try {
      return await fetchWithProgress(proxy(url), onProgress, signal);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Failed to download book file");
}

export const fetchEpubData = fetchBookFile;

function useBookFileImpl(
  url: string | null | undefined,
  onProgress?: ProgressCallback,
) {
  const progressRef = useRef<ProgressCallback | undefined>(onProgress);
  progressRef.current = onProgress;

  return useQuery({
    queryKey: bookFileQueryKey(url),
    queryFn: ({ signal }) =>
      fetchBookFile(
        url!,
        (loaded, total) => progressRef.current?.(loaded, total),
        signal,
      ),
    enabled: !!url,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    retry: 1,
  });
}

export const useBookFile = useBookFileImpl;
export const useEpubData = useBookFileImpl;

/** Prefetch a book file (EPUB or PDF) so opening the reader is instant. */
export function usePrefetchBookFile() {
  const qc = useQueryClient();
  return useCallback(
    (url: string | null | undefined) => {
      if (!url) return;
      qc.prefetchQuery({
        queryKey: bookFileQueryKey(url),
        queryFn: ({ signal }) => fetchBookFile(url, undefined, signal),
        staleTime: Infinity,
      });
    },
    [qc],
  );
}

export const usePrefetchEpub = usePrefetchBookFile;
