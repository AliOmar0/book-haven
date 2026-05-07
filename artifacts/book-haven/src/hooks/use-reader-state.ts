import { useState, useCallback, useEffect } from "react";

export interface Bookmark {
  id: string;
  cfi: string;
  label: string;
  createdAt: number;
}

export interface Highlight {
  id: string;
  cfiRange: string;
  color: string;
  text: string;
  createdAt: number;
}

export interface ReaderState {
  lastCfi?: string;
  bookmarks: Bookmark[];
  highlights: Highlight[];
}

const KEY = (workId: string) => `bh:reader:${workId}`;
const EMPTY: ReaderState = { bookmarks: [], highlights: [] };

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function load(workId: string): ReaderState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY(workId));
    if (!raw) return { bookmarks: [], highlights: [] };
    const parsed = JSON.parse(raw) as Partial<ReaderState>;
    return {
      lastCfi: parsed.lastCfi,
      bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
    };
  } catch {
    return { bookmarks: [], highlights: [] };
  }
}

function persist(workId: string, state: ReaderState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY(workId), JSON.stringify(state));
  } catch {
    // storage may be full or disabled — silently ignore
  }
}

export function useReaderState(workId: string) {
  const [state, setState] = useState<ReaderState>(() => load(workId));

  // Reload when switching books
  useEffect(() => {
    setState(load(workId));
  }, [workId]);

  const update = useCallback(
    (updater: (s: ReaderState) => ReaderState) => {
      setState((prev) => {
        const next = updater(prev);
        persist(workId, next);
        return next;
      });
    },
    [workId],
  );

  return [state, update] as const;
}
