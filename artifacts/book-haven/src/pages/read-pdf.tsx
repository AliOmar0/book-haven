import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams } from "wouter";
import { Document, Page, pdfjs } from "react-pdf";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Settings, List,
  Moon, Sun, Coffee, ZoomIn, ZoomOut, X, Loader2,
  Bookmark, BookmarkCheck, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBookFile } from "@/hooks/use-epub-data";
import { useReaderState, newId, type Bookmark as BookmarkT } from "@/hooks/use-reader-state";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

type Theme = "light" | "dark" | "sepia";
type SidebarTab = "contents" | "bookmarks";

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
// PDFs render to canvas; we tint via mix-blend-mode for non-light themes.
const PAGE_BLEND: Record<Theme, string> = {
  light: "normal",
  sepia: "multiply",
  dark: "difference",
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

interface OutlineItem {
  title: string;
  pageIndex: number;
}

export default function ReadPdf() {
  const { workId } = useParams<{ workId: string }>();
  const safeWorkId = workId || "unknown";
  const pdfUrl = new URLSearchParams(window.location.search).get("pdf");

  const [theme, setTheme] = useState<Theme>("sepia");
  const [zoom, setZoom] = useState(1.1);
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("contents");
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [renderError, setRenderError] = useState(false);
  const [renderReady, setRenderReady] = useState(false);
  const [pdfTitle, setPdfTitle] = useState("");
  const [downloadProgress, setDownloadProgress] = useState<{ loaded: number; total: number } | null>(null);

  const flipControls = useAnimationControls();
  const [sweep, setSweep] = useState<{ key: number; dir: 1 | -1 } | null>(null);
  const sweepTimerRef = useRef<number | null>(null);

  // Namespace per-format so PDF page bookmarks/last-page don't collide with
  // EPUB CFIs for the same work.
  const [readerState, updateReaderState] = useReaderState(`${safeWorkId}:pdf`);
  const lastSavedPageRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-resume: parse stored "pdf:<page>" CFI on first load
  const hasResumedRef = useRef(false);

  const onProgress = useCallback((loaded: number, total: number) => {
    setDownloadProgress({ loaded, total });
  }, []);
  const { data: pdfBuffer, isLoading: isDownloading, error: downloadError, isFetching } =
    useBookFile(pdfUrl, onProgress);

  // react-pdf accepts a stable `{ data }` prop; memoise to avoid re-loading.
  const fileProp = useMemo(() => (pdfBuffer ? { data: new Uint8Array(pdfBuffer) } : null), [pdfBuffer]);

  // Reset all per-document state when the PDF source changes so a back-and-
  // forward to a different book doesn't inherit the previous doc's pages,
  // outline or "already resumed" flag.
  useEffect(() => {
    setNumPages(0);
    setOutline([]);
    setRenderReady(false);
    setRenderError(false);
    setPageNum(1);
    setPdfTitle("");
    setDownloadProgress(null);
    hasResumedRef.current = false;
    lastSavedPageRef.current = null;
  }, [pdfUrl]);

  // Auto-resume to last page after numPages is known
  useEffect(() => {
    if (hasResumedRef.current || numPages === 0) return;
    const stored = readerState.lastCfi;
    if (stored && stored.startsWith("pdf:")) {
      const p = parseInt(stored.slice(4), 10);
      if (Number.isFinite(p) && p >= 1 && p <= numPages) {
        setPageNum(p);
      }
    }
    hasResumedRef.current = true;
  }, [numPages, readerState.lastCfi]);

  // Persist current page (debounced via direct ref check)
  useEffect(() => {
    if (!renderReady) return;
    if (lastSavedPageRef.current === pageNum) return;
    lastSavedPageRef.current = pageNum;
    updateReaderState((s) => ({ ...s, lastCfi: `pdf:${pageNum}` }));
  }, [pageNum, renderReady, updateReaderState]);

  const onDocumentLoadSuccess = useCallback(async (doc: { numPages: number; getOutline: () => Promise<unknown>; getPageIndex: (ref: unknown) => Promise<number>; getMetadata: () => Promise<{ info?: { Title?: string } }> }) => {
    setNumPages(doc.numPages);
    setRenderReady(true);
    try {
      const meta = await doc.getMetadata();
      if (meta.info?.Title) setPdfTitle(meta.info.Title);
    } catch {}
    try {
      const raw = await doc.getOutline() as Array<{ title: string; dest: unknown }> | null;
      if (raw && Array.isArray(raw)) {
        const flat: OutlineItem[] = [];
        const walk = async (items: typeof raw) => {
          for (const item of items) {
            try {
              if (Array.isArray(item.dest)) {
                const idx = await doc.getPageIndex(item.dest[0]);
                flat.push({ title: item.title, pageIndex: idx });
              }
            } catch {}
            const children = (item as { items?: typeof raw }).items;
            if (children && Array.isArray(children)) await walk(children);
          }
        };
        await walk(raw);
        setOutline(flat);
      }
    } catch {}
  }, []);

  const onDocumentLoadError = useCallback(() => setRenderError(true), []);

  const triggerFlip = useCallback((dir: 1 | -1) => {
    setSweep({ key: Date.now(), dir });
    flipControls.start({
      opacity: [1, 0.78, 1],
      x: [0, dir > 0 ? -10 : 10, 0],
      transition: { duration: 0.32, times: [0, 0.5, 1], ease: [0.4, 0, 0.2, 1] },
    });
    if (sweepTimerRef.current !== null) window.clearTimeout(sweepTimerRef.current);
    sweepTimerRef.current = window.setTimeout(() => {
      setSweep(null);
      sweepTimerRef.current = null;
    }, 360);
  }, [flipControls]);

  useEffect(() => () => {
    if (sweepTimerRef.current !== null) window.clearTimeout(sweepTimerRef.current);
  }, []);

  const nextPage = useCallback(() => {
    if (!renderReady || pageNum >= numPages) return;
    triggerFlip(1);
    setPageNum((p) => Math.min(numPages, p + 1));
    containerRef.current?.scrollTo({ top: 0 });
  }, [renderReady, pageNum, numPages, triggerFlip]);

  const prevPage = useCallback(() => {
    if (!renderReady || pageNum <= 1) return;
    triggerFlip(-1);
    setPageNum((p) => Math.max(1, p - 1));
    containerRef.current?.scrollTo({ top: 0 });
  }, [renderReady, pageNum, triggerFlip]);

  const goToPage = (p: number) => {
    if (p < 1 || p > numPages) return;
    setPageNum(p);
    setShowSidebar(false);
    containerRef.current?.scrollTo({ top: 0 });
  };

  // Bookmarks (page-based, stored CFI = "pdf:<page>")
  const isCurrentBookmarked = useMemo(() => {
    return readerState.bookmarks.some((b) => b.cfi === `pdf:${pageNum}`);
  }, [pageNum, readerState.bookmarks]);

  const toggleBookmark = useCallback(() => {
    if (!renderReady) return;
    const cfi = `pdf:${pageNum}`;
    const existing = readerState.bookmarks.find((b) => b.cfi === cfi);
    if (existing) {
      updateReaderState((s) => ({ ...s, bookmarks: s.bookmarks.filter((b) => b.id !== existing.id) }));
      return;
    }
    let label = `Page ${pageNum}`;
    const matches = outline.filter((o) => o.pageIndex + 1 <= pageNum);
    const nearest = matches.length ? matches[matches.length - 1] : null;
    if (nearest?.title) label = `${nearest.title.trim()} · p.${pageNum}`;
    updateReaderState((s) => ({
      ...s,
      bookmarks: [...s.bookmarks, { id: newId(), cfi, label, createdAt: Date.now() }],
    }));
  }, [pageNum, readerState.bookmarks, updateReaderState, outline, renderReady]);

  const removeBookmark = (id: string) => {
    updateReaderState((s) => ({ ...s, bookmarks: s.bookmarks.filter((b) => b.id !== id) }));
  };

  const goToBookmark = (b: BookmarkT) => {
    if (!b.cfi.startsWith("pdf:")) return;
    const p = parseInt(b.cfi.slice(4), 10);
    if (Number.isFinite(p)) goToPage(p);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") nextPage();
      else if (e.key === "ArrowLeft") prevPage();
      else if (e.key === "b" || e.key === "B") toggleBookmark();
      else if (e.key === "Escape") { setShowSettings(false); setShowSidebar(false); }
    };
    window.addEventListener("keyup", onKey);
    return () => window.removeEventListener("keyup", onKey);
  }, [nextPage, prevPage, toggleBookmark]);

  // Touch swipe
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 60) (dx < 0 ? nextPage() : prevPage());
  };

  if (!pdfUrl) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center px-6">
          <p className="font-serif text-2xl mb-3">No book selected</p>
          <button onClick={() => window.history.back()} className="text-primary hover:underline">Go back</button>
        </div>
      </div>
    );
  }

  const showLoading = isDownloading || isFetching || (!renderReady && !renderError && !!pdfBuffer);
  const showError = !!downloadError || renderError;
  const dlPct = downloadProgress && downloadProgress.total > 0
    ? Math.round((downloadProgress.loaded / downloadProgress.total) * 100)
    : null;
  const panelBg = theme === "dark" ? "#1f1f1f" : theme === "sepia" ? "#eae0c8" : "#ffffff";
  const progress = numPages > 0 ? pageNum / numPages : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col transition-colors duration-500" style={{ background: THEME_BG[theme], color: THEME_FG[theme] }}>
      <header className="flex items-center justify-between px-3 sm:px-4 h-14 border-b border-black/5 dark:border-white/10 shrink-0 z-30 relative">
        <button onClick={() => window.history.back()} className="p-2 hover:bg-black/5 rounded-full transition-colors" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
        <div className="text-sm font-serif italic opacity-60 truncate max-w-[55%] text-center">
          {pdfTitle || (numPages > 0 ? "PDF" : "")}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleBookmark} disabled={!renderReady}
            className={cn(
              "p-2 hover:bg-black/5 rounded-full transition-colors disabled:opacity-40",
              isCurrentBookmarked && "text-primary",
            )}
            aria-label={isCurrentBookmarked ? "Remove bookmark" : "Bookmark page"}
            title={isCurrentBookmarked ? "Remove bookmark (B)" : "Bookmark page (B)"}
          >
            {isCurrentBookmarked ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
          </button>
          <button onClick={() => { setShowSidebar((v) => !v); setShowSettings(false); }} disabled={!renderReady}
            className="p-2 hover:bg-black/5 rounded-full transition-colors disabled:opacity-40" aria-label="Library">
            <List className="w-5 h-5" />
          </button>
          <button onClick={() => { setShowSettings((v) => !v); setShowSidebar(false); }} disabled={!renderReady}
            className="p-2 hover:bg-black/5 rounded-full transition-colors disabled:opacity-40" aria-label="Settings">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="absolute top-14 right-3 sm:right-4 p-5 rounded-xl shadow-2xl border border-black/10 z-40 flex flex-col gap-5 w-72"
            style={{ backgroundColor: panelBg, color: THEME_FG[theme] }}>
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider opacity-60">Theme</span>
              <div className="flex gap-2">
                {([["light", Sun], ["sepia", Coffee], ["dark", Moon]] as const).map(([t, Icon]) => (
                  <button key={t} onClick={() => setTheme(t)}
                    className={cn(
                      "flex-1 p-3 rounded-md border-2 flex flex-col items-center gap-1 capitalize transition",
                      theme === t ? "border-current opacity-100" : "border-transparent opacity-50 hover:opacity-80",
                    )}>
                    <Icon className="w-5 h-5" />
                    <span className="text-xs">{t}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider opacity-60">Zoom</span>
              <div className="flex items-center gap-3 justify-between">
                <button onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} className="p-2 hover:bg-black/5 rounded-full">
                  <ZoomOut className="w-5 h-5" />
                </button>
                <span className="font-medium tabular-nums">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(2)))} className="p-2 hover:bg-black/5 rounded-full">
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

      <AnimatePresence>
        {showSidebar && (
          <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="absolute top-14 bottom-0 left-0 w-80 max-w-[85vw] shadow-2xl border-r border-black/10 z-40 overflow-y-auto"
            style={{ backgroundColor: panelBg, color: THEME_FG[theme] }}>
            <div className="sticky top-0 flex border-b border-black/10 backdrop-blur" style={{ backgroundColor: panelBg }}>
              {(["contents", "bookmarks"] as const).map((tab) => (
                <button key={tab} onClick={() => setSidebarTab(tab)}
                  className={cn(
                    "flex-1 py-3 text-xs uppercase tracking-wider font-medium transition-opacity capitalize",
                    sidebarTab === tab ? "opacity-100 border-b-2 border-current" : "opacity-50 hover:opacity-80",
                  )}>
                  {tab}
                </button>
              ))}
            </div>
            <div className="p-5">
              {sidebarTab === "contents" && (
                <div className="space-y-1">
                  {outline.length === 0 && <p className="opacity-50 italic text-sm">No outline embedded in this PDF.</p>}
                  {outline.map((item, i) => (
                    <button key={i} onClick={() => goToPage(item.pageIndex + 1)}
                      className="block w-full text-left px-3 py-2 rounded-md hover:bg-black/5 text-sm md:text-base opacity-80 hover:opacity-100 transition-opacity">
                      <span className="line-clamp-2">{item.title?.trim()}</span>
                      <span className="text-[10px] opacity-50 uppercase">p.{item.pageIndex + 1}</span>
                    </button>
                  ))}
                </div>
              )}
              {sidebarTab === "bookmarks" && (
                <BookmarksList bookmarks={readerState.bookmarks.filter((b) => b.cfi.startsWith("pdf:"))}
                  onJump={goToBookmark} onRemove={removeBookmark} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={containerRef} className="flex-1 relative overflow-auto" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
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
          </div>
        )}

        {showError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 px-6 text-center gap-3">
            <div className="font-serif text-xl opacity-80">This volume could not be opened.</div>
            <p className="text-sm opacity-50 max-w-md">The PDF may be unavailable, malformed, or the connection timed out.</p>
            <button onClick={() => window.location.reload()} className="mt-2 underline opacity-80">Retry</button>
          </div>
        )}

        <div className="absolute inset-y-0 left-0 w-1/4 z-20 cursor-w-resize" onClick={prevPage} aria-label="Previous page" />
        <div className="absolute inset-y-0 right-0 w-1/4 z-20 cursor-e-resize" onClick={nextPage} aria-label="Next page" />

        <motion.div animate={flipControls} className="min-h-full flex items-start justify-center py-6 px-4 md:px-10">
          {fileProp && (
            <div className="shadow-2xl rounded overflow-hidden" style={{ mixBlendMode: PAGE_BLEND[theme] as React.CSSProperties["mixBlendMode"] }}>
              <Document
                file={fileProp}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={null}
                error={null}
              >
                {renderReady && (
                  <Page
                    pageNumber={pageNum}
                    scale={zoom}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                    loading={null}
                  />
                )}
              </Document>
            </div>
          )}
        </motion.div>

        <AnimatePresence>
          {sweep && (
            <motion.div key={sweep.key}
              initial={{ x: sweep.dir > 0 ? "110%" : "-110%" }}
              animate={{ x: sweep.dir > 0 ? "-110%" : "110%" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-y-0 left-0 right-0 z-30 pointer-events-none"
              style={{ background: `linear-gradient(${sweep.dir > 0 ? "90deg" : "270deg"}, transparent 35%, rgba(0,0,0,0.10) 50%, transparent 65%)` }}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="h-1 shrink-0 bg-black/5 relative z-10">
        <div className="h-full transition-all" style={{ width: `${Math.round(progress * 100)}%`, background: THEME_FG[theme], opacity: 0.4 }} />
      </div>

      <div className="h-12 flex items-center justify-between px-6 shrink-0 border-t border-black/5 relative z-10">
        <button onClick={prevPage} disabled={!renderReady || pageNum <= 1} className="p-2 hover:bg-black/5 rounded-full transition-colors disabled:opacity-30" aria-label="Previous page">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-serif text-xs opacity-60 tabular-nums">
          {numPages > 0 ? `Page ${pageNum} of ${numPages}` : ""}
        </span>
        <button onClick={nextPage} disabled={!renderReady || pageNum >= numPages} className="p-2 hover:bg-black/5 rounded-full transition-colors disabled:opacity-30" aria-label="Next page">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function BookmarksList({ bookmarks, onJump, onRemove }: {
  bookmarks: BookmarkT[];
  onJump: (b: BookmarkT) => void;
  onRemove: (id: string) => void;
}) {
  if (bookmarks.length === 0) {
    return <p className="opacity-50 italic text-sm">No bookmarks yet. Tap the bookmark icon (or press B) to save your place.</p>;
  }
  return (
    <ul className="space-y-1">
      {bookmarks.map((b) => (
        <li key={b.id} className="group flex items-center gap-2">
          <button onClick={() => onJump(b)} className="flex-1 text-left px-3 py-2 rounded-md hover:bg-black/5 text-sm opacity-80 hover:opacity-100 transition-opacity">
            <div className="line-clamp-1 font-medium">{b.label}</div>
            <div className="text-[10px] uppercase opacity-50 mt-0.5">{new Date(b.createdAt).toLocaleDateString()}</div>
          </button>
          <button onClick={() => onRemove(b.id)} className="p-2 opacity-50 hover:opacity-100 focus-visible:opacity-100 transition-opacity" aria-label="Remove bookmark">
            <Trash2 className="w-4 h-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
