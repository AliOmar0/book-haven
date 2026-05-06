import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "wouter";
import ePub, { Book, Rendition, NavItem } from "epubjs";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Settings, List,
  Moon, Sun, Coffee, ZoomIn, ZoomOut, X, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEpubData } from "@/hooks/use-epub-data";

type Theme = "light" | "dark" | "sepia";

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

export default function Read() {
  useParams();
  const epubUrl = new URLSearchParams(window.location.search).get("epub");

  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);

  const [theme, setTheme] = useState<Theme>("sepia");
  const [fontSize, setFontSize] = useState(110);
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [toc, setToc] = useState<NavItem[]>([]);
  const [renderReady, setRenderReady] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const [bookTitle, setBookTitle] = useState("");
  const [progress, setProgress] = useState(0);

  const [flipDir, setFlipDir] = useState<1 | -1 | 0>(0);
  const [flipKey, setFlipKey] = useState(0);

  const {
    data: epubData,
    isLoading: isDownloading,
    error: downloadError,
    isFetching,
  } = useEpubData(epubUrl);

  // Mount epubjs once we have the ArrayBuffer
  useEffect(() => {
    if (!epubData || !viewerRef.current) return;

    let cancelled = false;
    setRenderReady(false);
    setRenderError(false);

    // epubjs mutates the buffer's ownership; clone to be safe across remounts.
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

    rendition.display().then(() => {
      if (!cancelled) setRenderReady(true);
    }).catch((err) => {
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

    rendition.on("relocated", (loc: { start: { percentage?: number } }) => {
      if (cancelled) return;
      if (typeof loc.start?.percentage === "number") {
        setProgress(loc.start.percentage);
      }
    });

    return () => {
      cancelled = true;
      try { rendition.destroy(); } catch {}
      try { book.destroy(); } catch {}
      bookRef.current = null;
      renditionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epubData]);

  // Apply theme/fontSize when changed (without remounting)
  useEffect(() => { renditionRef.current?.themes.select(theme); }, [theme]);
  useEffect(() => { renditionRef.current?.themes.fontSize(`${fontSize}%`); }, [fontSize]);

  const nextPage = useCallback(() => {
    if (!renderReady) return;
    setFlipDir(1);
    setFlipKey((k) => k + 1);
    renditionRef.current?.next();
  }, [renderReady]);

  const prevPage = useCallback(() => {
    if (!renderReady) return;
    setFlipDir(-1);
    setFlipKey((k) => k + 1);
    renditionRef.current?.prev();
  }, [renderReady]);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") nextPage();
      if (e.key === "ArrowLeft") prevPage();
    };
    window.addEventListener("keyup", onKey);
    return () => window.removeEventListener("keyup", onKey);
  }, [nextPage, prevPage]);

  const goTo = (href: string) => {
    renditionRef.current?.display(href);
    setShowToc(false);
  };

  // Touch swipe
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

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col transition-colors duration-500"
      style={{ background: THEME_BG[theme], color: THEME_FG[theme] }}
    >
      <header className="flex items-center justify-between px-4 h-14 border-b border-black/5 dark:border-white/10 shrink-0 z-30 relative">
        <button onClick={() => window.history.back()} className="p-2 hover:bg-black/5 rounded-full transition-colors" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
        <div className="text-sm font-serif italic opacity-60 truncate max-w-[60%] text-center">
          {bookTitle}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setShowToc((v) => !v); setShowSettings(false); }}
            disabled={!renderReady}
            className="p-2 hover:bg-black/5 rounded-full transition-colors disabled:opacity-40"
            aria-label="Contents"
          >
            <List className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setShowSettings((v) => !v); setShowToc(false); }}
            disabled={!renderReady}
            className="p-2 hover:bg-black/5 rounded-full transition-colors disabled:opacity-40"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-14 right-4 p-5 rounded-xl shadow-2xl border border-black/10 z-40 flex flex-col gap-5 w-72"
            style={{ backgroundColor: theme === "dark" ? "#1f1f1f" : theme === "sepia" ? "#eae0c8" : "#ffffff", color: THEME_FG[theme] }}
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
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showToc && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="absolute top-14 bottom-0 left-0 w-80 max-w-[85vw] shadow-2xl border-r border-black/10 z-40 overflow-y-auto"
            style={{ backgroundColor: theme === "dark" ? "#1f1f1f" : theme === "sepia" ? "#eae0c8" : "#ffffff", color: THEME_FG[theme] }}
          >
            <div className="p-6">
              <h3 className="font-serif text-2xl font-bold mb-6">Contents</h3>
              <div className="space-y-1">
                {toc.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(item.href)}
                    className="block w-full text-left px-3 py-2 rounded-md hover:bg-black/5 text-sm md:text-base opacity-80 hover:opacity-100 transition-opacity"
                  >
                    {item.label?.trim()}
                  </button>
                ))}
                {toc.length === 0 && <p className="opacity-50 italic">No table of contents.</p>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="flex-1 relative overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{ perspective: 2200 }}
      >
        {showLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none gap-3">
            <Loader2 className="w-8 h-8 animate-spin opacity-60" />
            <div className="font-serif text-lg opacity-60">
              {isDownloading || isFetching ? "Downloading volume…" : "Opening volume…"}
            </div>
            <p className="text-xs opacity-40 max-w-xs text-center px-6">
              First open may take a few seconds. The book is cached so future page turns are instant.
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

        <div className="absolute inset-y-0 left-0 w-1/4 z-20 cursor-w-resize" onClick={prevPage} aria-label="Previous page" />
        <div className="absolute inset-y-0 right-0 w-1/4 z-20 cursor-e-resize" onClick={nextPage} aria-label="Next page" />

        <div className="absolute inset-0 mx-auto max-w-3xl py-6 px-4 md:px-10">
          <div ref={viewerRef} className="w-full h-full [&_iframe]:!w-full [&_iframe]:!h-full" />
        </div>

        <AnimatePresence>
          {flipDir !== 0 && (
            <motion.div
              key={flipKey}
              initial={{ rotateY: flipDir > 0 ? 0 : -160, opacity: 0.9 }}
              animate={{ rotateY: flipDir > 0 ? -160 : 0, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: [0.6, 0.05, 0.3, 1] }}
              className="absolute top-0 bottom-0 z-30 pointer-events-none"
              style={{
                transformStyle: "preserve-3d",
                transformOrigin: flipDir > 0 ? "left center" : "right center",
                left: flipDir > 0 ? "50%" : 0,
                right: flipDir > 0 ? 0 : "50%",
                background: `linear-gradient(${flipDir > 0 ? "to left" : "to right"}, ${THEME_BG[theme]} 0%, ${THEME_BG[theme]} 70%, rgba(0,0,0,.18) 100%)`,
                boxShadow: flipDir > 0
                  ? "-12px 0 24px -12px rgba(0,0,0,.35)"
                  : "12px 0 24px -12px rgba(0,0,0,.35)",
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
