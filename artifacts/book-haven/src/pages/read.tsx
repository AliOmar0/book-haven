import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams } from "wouter";
import ePub, { Book, Rendition, NavItem, Contents } from "epubjs";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Settings, List,
  Moon, Sun, Coffee, ZoomIn, ZoomOut, X, Loader2,
  Bookmark, BookmarkCheck, Highlighter, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEpubData } from "@/hooks/use-epub-data";
import {
  useReaderState,
  newId,
  type Bookmark as BookmarkT,
  type Highlight as HighlightT,
} from "@/hooks/use-reader-state";

type Theme = "light" | "dark" | "sepia";
type SidebarTab = "contents" | "bookmarks" | "highlights";

const THEME_BG: Record<Theme, string> = {
  light: "#fdfbf7",
  dark: "#141414",
  sepia: "#f4ecd8",
};
const THEME_FG: Record<Theme, string> = {
  light: "#1a1a1a",
  dark: "#fdfbf7",
  sepia: "#433422",
};

const HIGHLIGHT_COLORS: { id: string; label: string; hex: string }[] = [
  { id: "yellow", label: "Yellow", hex: "#fde047" },
  { id: "pink",   label: "Pink",   hex: "#f9a8d4" },
  { id: "blue",   label: "Blue",   hex: "#93c5fd" },
  { id: "green",  label: "Green",  hex: "#86efac" },
];
const COLOR_BY_ID = Object.fromEntries(HIGHLIGHT_COLORS.map((c) => [c.id, c.hex]));

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

interface PendingSelection {
  cfiRange: string;
  text: string;
}

export default function Read() {
  const { workId } = useParams<{ workId: string }>();
  const safeWorkId = workId || "unknown";
  const epubUrl = new URLSearchParams(window.location.search).get("epub");

  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const lastSavedCfi = useRef<string | null>(null);

  const [theme, setTheme] = useState<Theme>("sepia");
  const [fontSize, setFontSize] = useState(110);
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("contents");
  const [toc, setToc] = useState<NavItem[]>([]);
  const [renderReady, setRenderReady] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const [bookTitle, setBookTitle] = useState("");
  const [progress, setProgress] = useState(0);
  const [currentCfi, setCurrentCfi] = useState<string | null>(null);

  const [pendingSel, setPendingSel] = useState<PendingSelection | null>(null);

  const [downloadProgress, setDownloadProgress] = useState<{ loaded: number; total: number } | null>(null);

  const flipControls = useAnimationControls();
  const [sweep, setSweep] = useState<{ key: number; dir: 1 | -1 } | null>(null);
  const sweepTimerRef = useRef<number | null>(null);

  const [readerState, updateReaderState] = useReaderState(safeWorkId);
  const readerStateRef = useRef(readerState);
  readerStateRef.current = readerState;

  const onProgress = useCallback((loaded: number, total: number) => {
    setDownloadProgress({ loaded, total });
  }, []);

  const {
    data: epubData,
    isLoading: isDownloading,
    error: downloadError,
    isFetching,
  } = useEpubData(epubUrl, onProgress);

  // Mount epubjs once we have the ArrayBuffer
  useEffect(() => {
    if (!epubData || !viewerRef.current) return;

    let cancelled = false;
    setRenderReady(false);
    setRenderError(false);

    const buffer = epubData.slice(0);
    const book = ePub(buffer);
    bookRef.current = book;

    const rendition = book.renderTo(viewerRef.current, {
      width: "100%",
      height: "100%",
      spread: "none",
      flow: "paginated",
      allowScriptedContent: false,
    });
    renditionRef.current = rendition;

    rendition.themes.register("light", {
      body: { background: THEME_BG.light, color: THEME_FG.light, "font-family": "Georgia, serif" },
      a: { color: "#166440" },
      img: { "max-width": "100%" },
      p: { "line-height": "1.7" },
    });
    rendition.themes.register("dark", {
      body: { background: THEME_BG.dark, color: THEME_FG.dark, "font-family": "Georgia, serif" },
      a: { color: "#9ec6a8" },
      img: { "max-width": "100%", filter: "brightness(.85)" },
      p: { "line-height": "1.7" },
    });
    rendition.themes.register("sepia", {
      body: { background: THEME_BG.sepia, color: THEME_FG.sepia, "font-family": "Georgia, serif" },
      a: { color: "#8b3a3a" },
      img: { "max-width": "100%" },
      p: { "line-height": "1.7" },
    });
    rendition.themes.select(theme);
    rendition.themes.fontSize(`${fontSize}%`);

    const rehydrateHighlights = () => {
      for (const h of readerStateRef.current.highlights) {
        try {
          rendition.annotations.add(
            "highlight",
            h.cfiRange,
            { id: h.id },
            undefined,
            `bh-hl-${h.color}`,
            { fill: COLOR_BY_ID[h.color] || "#fde047", "fill-opacity": "0.4", "mix-blend-mode": "multiply" },
          );
        } catch {
          // CFI may be invalid for this edition — skip
        }
      }
    };

    const startCfi = readerStateRef.current.lastCfi;
    rendition.display(startCfi)
      .catch((err) => {
        // Stored CFI may be invalid for this edition (e.g. user opened a different
        // Gutenberg match). Forget it and start from the beginning instead of
        // bricking the reader.
        console.warn("auto-resume failed, starting from beginning:", err);
        if (!cancelled && startCfi) {
          updateReaderState((s) => ({ ...s, lastCfi: undefined }));
        }
        return rendition.display();
      })
      .then(() => {
        if (!cancelled) {
          setRenderReady(true);
          rehydrateHighlights();
        }
      })
      .catch((err) => {
        console.error("epub display error", err);
        if (!cancelled) setRenderError(true);
      });

    book.loaded.navigation.then((nav) => {
      if (!cancelled) setToc(nav.toc);
    });
    book.loaded.metadata.then((meta) => {
      if (!cancelled) setBookTitle(meta.title || "");
    });

    book.ready.then(() => book.locations.generate(1024)).catch(() => {});

    rendition.on("relocated", (loc: { start: { cfi?: string; percentage?: number } }) => {
      if (cancelled) return;
      if (typeof loc.start?.percentage === "number") setProgress(loc.start.percentage);
      if (loc.start?.cfi) {
        setCurrentCfi(loc.start.cfi);
        // Persist last-read position (skip duplicate writes)
        if (loc.start.cfi !== lastSavedCfi.current) {
          lastSavedCfi.current = loc.start.cfi;
          updateReaderState((s) => ({ ...s, lastCfi: loc.start.cfi }));
        }
      }
    });

    rendition.on("selected", (cfiRange: string, contents: Contents) => {
      // Defer to allow selection to settle
      setTimeout(() => {
        const text = contents?.window?.getSelection()?.toString().trim() || "";
        if (text.length > 0) setPendingSel({ cfiRange, text });
      }, 0);
    });

    rendition.on("markClicked", (cfiRange: string) => {
      const existing = readerStateRef.current.highlights.find((h) => h.cfiRange === cfiRange);
      if (!existing) return;
      try { rendition.annotations.remove(cfiRange, "highlight"); } catch {}
      updateReaderState((s) => ({
        ...s,
        highlights: s.highlights.filter((h) => h.id !== existing.id),
      }));
    });

    return () => {
      cancelled = true;
      try { rendition.destroy(); } catch {}
      try { book.destroy(); } catch {}
      bookRef.current = null;
      renditionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epubData, safeWorkId]);

  useEffect(() => { renditionRef.current?.themes.select(theme); }, [theme]);
  useEffect(() => { renditionRef.current?.themes.fontSize(`${fontSize}%`); }, [fontSize]);

  const triggerFlip = useCallback((dir: 1 | -1) => {
    setSweep({ key: Date.now(), dir });
    flipControls.start({
      opacity: [1, 0.78, 1],
      x: [0, dir > 0 ? -10 : 10, 0],
      transition: { duration: 0.32, times: [0, 0.5, 1], ease: [0.4, 0, 0.2, 1] },
    });
    // Cancel any pending sweep clear so rapid turns don't blank the new sweep.
    if (sweepTimerRef.current !== null) {
      window.clearTimeout(sweepTimerRef.current);
    }
    sweepTimerRef.current = window.setTimeout(() => {
      setSweep(null);
      sweepTimerRef.current = null;
    }, 360);
  }, [flipControls]);

  useEffect(() => () => {
    if (sweepTimerRef.current !== null) window.clearTimeout(sweepTimerRef.current);
  }, []);

  const nextPage = useCallback(() => {
    if (!renderReady) return;
    triggerFlip(1);
    renditionRef.current?.next();
  }, [renderReady, triggerFlip]);

  const prevPage = useCallback(() => {
    if (!renderReady) return;
    triggerFlip(-1);
    renditionRef.current?.prev();
  }, [renderReady, triggerFlip]);

  // ---------- Bookmarks ----------
  const isCurrentBookmarked = useMemo(() => {
    if (!currentCfi) return false;
    return readerState.bookmarks.some((b) => b.cfi === currentCfi);
  }, [currentCfi, readerState.bookmarks]);

  const toggleBookmark = useCallback(() => {
    if (!currentCfi || !renditionRef.current) return;
    const existing = readerState.bookmarks.find((b) => b.cfi === currentCfi);
    if (existing) {
      updateReaderState((s) => ({ ...s, bookmarks: s.bookmarks.filter((b) => b.id !== existing.id) }));
      return;
    }
    // Try to derive a label from current chapter
    let label = `${Math.round(progress * 100)}%`;
    try {
      const loc = renditionRef.current.currentLocation() as { start?: { href?: string } };
      const href = loc?.start?.href;
      if (href) {
        const match = toc.find((t) => href.includes(t.href.split("#")[0]));
        if (match?.label?.trim()) label = match.label.trim();
      }
    } catch {}
    updateReaderState((s) => ({
      ...s,
      bookmarks: [
        ...s.bookmarks,
        { id: newId(), cfi: currentCfi, label, createdAt: Date.now() },
      ],
    }));
  }, [currentCfi, readerState.bookmarks, updateReaderState, progress, toc]);

  const removeBookmark = (id: string) => {
    updateReaderState((s) => ({ ...s, bookmarks: s.bookmarks.filter((b) => b.id !== id) }));
  };

  const goTo = (target: string) => {
    renditionRef.current?.display(target);
    setShowSidebar(false);
  };

  // ---------- Highlights ----------
  const addHighlight = useCallback((color: string) => {
    if (!pendingSel || !renditionRef.current) return;
    const h: HighlightT = {
      id: newId(),
      cfiRange: pendingSel.cfiRange,
      color,
      text: pendingSel.text,
      createdAt: Date.now(),
    };
    try {
      renditionRef.current.annotations.add(
        "highlight",
        h.cfiRange,
        { id: h.id },
        undefined,
        `bh-hl-${color}`,
        { fill: COLOR_BY_ID[color] || "#fde047", "fill-opacity": "0.4", "mix-blend-mode": "multiply" },
      );
    } catch (e) {
      console.warn("Failed to add highlight", e);
    }
    updateReaderState((s) => ({ ...s, highlights: [...s.highlights, h] }));
    setPendingSel(null);
  }, [pendingSel, updateReaderState]);

  const removeHighlight = (h: HighlightT) => {
    try { renditionRef.current?.annotations.remove(h.cfiRange, "highlight"); } catch {}
    updateReaderState((s) => ({ ...s, highlights: s.highlights.filter((x) => x.id !== h.id) }));
  };

  // ---------- Keyboard shortcuts ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") nextPage();
      else if (e.key === "ArrowLeft") prevPage();
      else if (e.key === "b" || e.key === "B") toggleBookmark();
      else if (e.key === "Escape") {
        setPendingSel(null);
        setShowSettings(false);
        setShowSidebar(false);
      }
    };
    window.addEventListener("keyup", onKey);
    return () => window.removeEventListener("keyup", onKey);
  }, [nextPage, prevPage, toggleBookmark]);

  // ---------- Touch swipe ----------
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 60) {
      if (dx < 0) nextPage(); else prevPage();
    }
  };

  if (!epubUrl) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center px-6">
          <p className="font-serif text-2xl mb-3">No book selected</p>
          <button onClick={() => window.history.back()} className="text-primary hover:underline">
            Go back
          </button>
        </div>
      </div>
    );
  }

  const showLoading = isDownloading || isFetching || (!renderReady && !renderError && !!epubData);
  const showError = !!downloadError || renderError;
  const dlPct = downloadProgress && downloadProgress.total > 0
    ? Math.round((downloadProgress.loaded / downloadProgress.total) * 100)
    : null;

  const panelBg = theme === "dark" ? "#1f1f1f" : theme === "sepia" ? "#eae0c8" : "#ffffff";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col transition-colors duration-500"
      style={{ background: THEME_BG[theme], color: THEME_FG[theme] }}
    >
      <header className="flex items-center justify-between px-3 sm:px-4 h-14 border-b border-black/5 dark:border-white/10 shrink-0 z-30 relative">
        <button onClick={() => window.history.back()} className="p-2 hover:bg-black/5 rounded-full transition-colors" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
        <div className="text-sm font-serif italic opacity-60 truncate max-w-[55%] text-center">
          {bookTitle}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleBookmark}
            disabled={!renderReady}
            className={cn(
              "p-2 hover:bg-black/5 rounded-full transition-colors disabled:opacity-40",
              isCurrentBookmarked && "text-primary",
            )}
            aria-label={isCurrentBookmarked ? "Remove bookmark" : "Bookmark page"}
            title={isCurrentBookmarked ? "Remove bookmark (B)" : "Bookmark page (B)"}
          >
            {isCurrentBookmarked ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
          </button>
          <button
            onClick={() => { setShowSidebar((v) => !v); setShowSettings(false); }}
            disabled={!renderReady}
            className="p-2 hover:bg-black/5 rounded-full transition-colors disabled:opacity-40"
            aria-label="Library"
            title="Contents, bookmarks, highlights"
          >
            <List className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setShowSettings((v) => !v); setShowSidebar(false); }}
            disabled={!renderReady}
            className="p-2 hover:bg-black/5 rounded-full transition-colors disabled:opacity-40"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Highlight color picker (appears when text is selected) */}
      <AnimatePresence>
        {pendingSel && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className="absolute top-14 left-1/2 -translate-x-1/2 z-40 mt-3 px-4 py-3 rounded-xl shadow-xl border border-black/10 flex items-center gap-3"
            style={{ backgroundColor: panelBg, color: THEME_FG[theme] }}
          >
            <Highlighter className="w-4 h-4 opacity-60" />
            <span className="text-xs font-medium uppercase tracking-wider opacity-60">Highlight</span>
            <div className="flex items-center gap-2">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => addHighlight(c.id)}
                  className="w-7 h-7 rounded-full border-2 border-white shadow hover:scale-110 transition-transform"
                  style={{ background: c.hex }}
                  aria-label={`Highlight ${c.label}`}
                  title={c.label}
                />
              ))}
            </div>
            <button
              onClick={() => setPendingSel(null)}
              className="p-1 ml-1 hover:bg-black/5 rounded-full"
              aria-label="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings popover */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-14 right-3 sm:right-4 p-5 rounded-xl shadow-2xl border border-black/10 z-40 flex flex-col gap-5 w-72"
            style={{ backgroundColor: panelBg, color: THEME_FG[theme] }}
          >
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider opacity-60">Theme</span>
              <div className="flex gap-2">
                {([["light", Sun], ["sepia", Coffee], ["dark", Moon]] as const).map(([t, Icon]) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={cn(
                      "flex-1 p-3 rounded-md border-2 flex flex-col items-center gap-1 capitalize transition",
                      theme === t ? "border-current opacity-100" : "border-transparent opacity-50 hover:opacity-80",
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs">{t}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider opacity-60">Text Size</span>
              <div className="flex items-center gap-3 justify-between">
                <button onClick={() => setFontSize((s) => Math.max(70, s - 10))} className="p-2 hover:bg-black/5 rounded-full">
                  <ZoomOut className="w-5 h-5" />
                </button>
                <span className="font-medium tabular-nums">{fontSize}%</span>
                <button onClick={() => setFontSize((s) => Math.min(220, s + 10))} className="p-2 hover:bg-black/5 rounded-full">
                  <ZoomIn className="w-5 h-5" />
                </button>
              </div>
            </div>
            <p className="text-[11px] opacity-50 leading-snug">
              Tip: arrow keys turn pages, B toggles a bookmark, Esc closes panels.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar (TOC / bookmarks / highlights) */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="absolute top-14 bottom-0 left-0 w-80 max-w-[85vw] shadow-2xl border-r border-black/10 z-40 overflow-y-auto"
            style={{ backgroundColor: panelBg, color: THEME_FG[theme] }}
          >
            <div className="sticky top-0 flex border-b border-black/10 backdrop-blur" style={{ backgroundColor: panelBg }}>
              {(["contents", "bookmarks", "highlights"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  className={cn(
                    "flex-1 py-3 text-xs uppercase tracking-wider font-medium transition-opacity capitalize",
                    sidebarTab === tab ? "opacity-100 border-b-2 border-current" : "opacity-50 hover:opacity-80",
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="p-5">
              {sidebarTab === "contents" && (
                <div className="space-y-1">
                  {toc.length === 0 && <p className="opacity-50 italic">No table of contents.</p>}
                  {toc.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => goTo(item.href)}
                      className="block w-full text-left px-3 py-2 rounded-md hover:bg-black/5 text-sm md:text-base opacity-80 hover:opacity-100 transition-opacity"
                    >
                      {item.label?.trim()}
                    </button>
                  ))}
                </div>
              )}

              {sidebarTab === "bookmarks" && (
                <BookmarksList
                  bookmarks={readerState.bookmarks}
                  onJump={goTo}
                  onRemove={removeBookmark}
                />
              )}

              {sidebarTab === "highlights" && (
                <HighlightsList
                  highlights={readerState.highlights}
                  onJump={goTo}
                  onRemove={removeHighlight}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="flex-1 relative overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {showLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none gap-3">
            <Loader2 className="w-8 h-8 animate-spin opacity-60" />
            <div className="font-serif text-lg opacity-70">
              {isDownloading || isFetching ? "Downloading volume…" : "Opening volume…"}
            </div>
            {dlPct !== null && (isDownloading || isFetching) && (
              <div className="w-56 max-w-[60vw] flex flex-col items-center gap-1.5">
                <div className="w-full h-1 bg-black/10 rounded-full overflow-hidden">
                  <div className="h-full bg-current opacity-50 transition-all" style={{ width: `${dlPct}%` }} />
                </div>
                <span className="text-xs tabular-nums opacity-50">
                  {dlPct}% · {formatBytes(downloadProgress!.loaded)} / {formatBytes(downloadProgress!.total)}
                </span>
              </div>
            )}
            <p className="text-xs opacity-40 max-w-xs text-center px-6">
              First open downloads the book; subsequent opens are instant.
            </p>
          </div>
        )}

        {showError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 px-6 text-center gap-3">
            <div className="font-serif text-xl opacity-80">This volume could not be opened.</div>
            <p className="text-sm opacity-50 max-w-md">
              The book may be unavailable or the connection timed out. Please try again later.
            </p>
            <button onClick={() => window.location.reload()} className="mt-2 underline opacity-80">
              Retry
            </button>
          </div>
        )}

        {/* Tap zones for paging */}
        <div className="absolute inset-y-0 left-0 w-1/4 z-20 cursor-w-resize" onClick={prevPage} aria-label="Previous page" />
        <div className="absolute inset-y-0 right-0 w-1/4 z-20 cursor-e-resize" onClick={nextPage} aria-label="Next page" />

        {/* Animated viewer wrapper — slight slide+fade on page turn */}
        <motion.div
          animate={flipControls}
          className="absolute inset-0 mx-auto max-w-3xl py-6 px-4 md:px-10"
        >
          <div ref={viewerRef} className="w-full h-full [&_iframe]:!w-full [&_iframe]:!h-full" />
        </motion.div>

        {/* Soft gradient sweep across the page on flip */}
        <AnimatePresence>
          {sweep && (
            <motion.div
              key={sweep.key}
              initial={{ x: sweep.dir > 0 ? "110%" : "-110%" }}
              animate={{ x: sweep.dir > 0 ? "-110%" : "110%" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-y-0 left-0 right-0 z-30 pointer-events-none"
              style={{
                background: `linear-gradient(${sweep.dir > 0 ? "90deg" : "270deg"}, transparent 35%, rgba(0,0,0,0.10) 50%, transparent 65%)`,
              }}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="h-1 shrink-0 bg-black/5 relative z-10">
        <div
          className="h-full transition-all"
          style={{ width: `${Math.round(progress * 100)}%`, background: THEME_FG[theme], opacity: 0.4 }}
        />
      </div>

      <div className="h-12 flex items-center justify-between px-6 shrink-0 border-t border-black/5 relative z-10">
        <button onClick={prevPage} disabled={!renderReady} className="p-2 hover:bg-black/5 rounded-full transition-colors disabled:opacity-30" aria-label="Previous page">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-serif text-xs opacity-50 tabular-nums">
          {Math.round(progress * 100)}%
        </span>
        <button onClick={nextPage} disabled={!renderReady} className="p-2 hover:bg-black/5 rounded-full transition-colors disabled:opacity-30" aria-label="Next page">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// -------------------- Sidebar list components --------------------

function BookmarksList({
  bookmarks, onJump, onRemove,
}: {
  bookmarks: BookmarkT[];
  onJump: (cfi: string) => void;
  onRemove: (id: string) => void;
}) {
  if (bookmarks.length === 0) {
    return (
      <p className="opacity-50 italic text-sm">
        No bookmarks yet. Tap the bookmark icon (or press B) to save your place.
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {bookmarks.map((b) => (
        <li key={b.id} className="group flex items-center gap-2">
          <button
            onClick={() => onJump(b.cfi)}
            className="flex-1 text-left px-3 py-2 rounded-md hover:bg-black/5 text-sm opacity-80 hover:opacity-100 transition-opacity"
          >
            <div className="line-clamp-1 font-medium">{b.label}</div>
            <div className="text-[10px] uppercase opacity-50 mt-0.5">
              {new Date(b.createdAt).toLocaleDateString()}
            </div>
          </button>
          <button
            onClick={() => onRemove(b.id)}
            className="p-2 opacity-50 hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            aria-label="Remove bookmark"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function HighlightsList({
  highlights, onJump, onRemove,
}: {
  highlights: HighlightT[];
  onJump: (cfi: string) => void;
  onRemove: (h: HighlightT) => void;
}) {
  if (highlights.length === 0) {
    return (
      <p className="opacity-50 italic text-sm">
        No highlights yet. Select text in the book and pick a colour to save it.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {highlights.map((h) => (
        <li key={h.id} className="group flex items-start gap-2 px-3 py-2 rounded-md hover:bg-black/5">
          <span
            className="w-1 self-stretch rounded-sm mt-1 shrink-0"
            style={{ background: COLOR_BY_ID[h.color] || "#fde047" }}
          />
          <button onClick={() => onJump(h.cfiRange)} className="flex-1 text-left text-sm opacity-80 hover:opacity-100">
            <div className="line-clamp-3 italic">&ldquo;{h.text}&rdquo;</div>
            <div className="text-[10px] uppercase opacity-50 mt-1">
              {new Date(h.createdAt).toLocaleDateString()}
            </div>
          </button>
          <button
            onClick={() => onRemove(h)}
            className="p-1 opacity-50 hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            aria-label="Remove highlight"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
