import { useQuery } from "@tanstack/react-query";

const PROXIES = [
  // Same-origin first-party proxy is most reliable.
  (url: string) => `/api/proxy/epub?url=${encodeURIComponent(url)}`,
  // Public CORS proxies as last-ditch fallbacks.
  (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
];

export function useEpubData(epubUrl: string | null | undefined) {
  return useQuery({
    queryKey: ["epub-data", epubUrl],
    queryFn: async (): Promise<ArrayBuffer> => {
      if (!epubUrl) throw new Error("No EPUB URL");
      let lastErr: unknown = null;
      for (const proxy of PROXIES) {
        try {
          const res = await fetch(proxy(epubUrl));
          if (!res.ok) {
            lastErr = new Error(`HTTP ${res.status}`);
            continue;
          }
          return await res.arrayBuffer();
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr instanceof Error ? lastErr : new Error("Failed to download EPUB");
    },
    enabled: !!epubUrl,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    retry: 1,
  });
}
