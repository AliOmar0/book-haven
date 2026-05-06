import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import ePub, { Book, Rendition, Location } from "epubjs";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeft, ChevronRight, Settings, List, 
  Moon, Sun, Coffee, ZoomIn, ZoomOut, X
} from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "sepia";

export default function Read() {
  const { workId } = useParams();
  const searchParams = new URLSearchParams(window.location.search);
  const epubUrl = searchParams.get("epub");

  const [book, setBook] = useState<Book | null>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [location, setLocation] = useState<string | number | null>(null);
  
  const [theme, setTheme] = useState<Theme>("light");
  const [fontSize, setFontSize] = useState(100);
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [toc, setToc] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const viewerRef = useRef<HTMLDivElement>(null);

  // Direction of page turn for animation
  const [direction, setDirection] = useState(1);
  const [pageKey, setPageKey] = useState(0);

  useEffect(() => {
    if (!epubUrl || !viewerRef.current) {
      setError(true);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    
    // Setup book
    const proxiedUrl = `https://corsproxy.io/?url=${encodeURIComponent(epubUrl)}`;
    const newBook = ePub(proxiedUrl);
    
    if (isMounted) setBook(newBook);

    newBook.ready.then(() => {
      if (!isMounted) return;
      
      const newRendition = newBook.renderTo(viewerRef.current!, {
        width: "100%",
        height: "100%",
        spread: "none",
        manager: "continuous",
        flow: "paginated",
      });

      setRendition(newRendition);

      newRendition.display().then(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

      newBook.loaded.navigation.then((nav) => {
        if (!isMounted) return;
        setToc(nav);
      });

      newRendition.on("relocated", (loc: Location) => {
        if (!isMounted) return;
        setLocation(loc.start);
      });
      
    }).catch((err) => {
      console.error(err);
      if (isMounted) {
        setError(true);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      newBook.destroy();
    };
  }, [epubUrl]);

  useEffect(() => {
    if (rendition) {
      // Register themes
      rendition.themes.register("light", {
        body: { background: "#fdfbf7", color: "#1a1a1a" },
        a: { color: "#166440" },
        "img": { "max-width": "100%" }
      });
      rendition.themes.register("dark", {
        body: { background: "#141414", color: "#fdfbf7" },
        a: { color: "#40a070" },
        "img": { "max-width": "100%" }
      });
      rendition.themes.register("sepia", {
        body: { background: "#f4ecd8", color: "#433422" },
        a: { color: "#9a434b" },
        "img": { "max-width": "100%" }
      });

      rendition.themes.select(theme);
    }
  }, [rendition, theme]);

  useEffect(() => {
    if (rendition) {
      rendition.themes.fontSize(`${fontSize}%`);
    }
  }, [rendition, fontSize]);

  const nextPage = () => {
    if (rendition) {
      setDirection(1);
      setPageKey(prev => prev + 1);
      rendition.next();
    }
  };

  const prevPage = () => {
    if (rendition) {
      setDirection(-1);
      setPageKey(prev => prev + 1);
      rendition.prev();
    }
  };

  const goTo = (href: string) => {
    if (rendition) {
      rendition.display(href);
      setShowToc(false);
    }
  };

  if (!epubUrl) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <p className="text-xl font-serif text-muted-foreground">No book selected.</p>
        </div>
      </Layout>
    );
  }

  return (
    <div className={cn(
      "fixed inset-0 z-50 flex flex-col transition-colors duration-500",
      theme === "light" && "bg-[#fdfbf7] text-[#1a1a1a]",
      theme === "dark" && "bg-[#141414] text-[#fdfbf7]",
      theme === "sepia" && "bg-[#f4ecd8] text-[#433422]"
    )}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-16 border-b border-black/5 dark:border-white/5 shrink-0 z-10 relative">
        <button onClick={() => window.history.back()} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowToc(!showToc)} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors">
            <List className="w-5 h-5" />
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Settings Dropdown */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-16 right-4 p-4 rounded-lg shadow-xl border border-black/5 dark:border-white/5 z-20 flex flex-col gap-6"
            style={{ 
              backgroundColor: theme === 'dark' ? '#1f1f1f' : theme === 'sepia' ? '#eae0c8' : '#ffffff'
            }}
          >
            <div className="space-y-3">
              <span className="text-sm font-semibold uppercase tracking-wider opacity-60">Theme</span>
              <div className="flex gap-2">
                <button onClick={() => setTheme("light")} className={cn("p-3 rounded-md border flex flex-col items-center gap-2", theme === "light" ? "border-primary" : "border-transparent opacity-60")}>
                  <Sun className="w-5 h-5" />
                </button>
                <button onClick={() => setTheme("sepia")} className={cn("p-3 rounded-md border flex flex-col items-center gap-2", theme === "sepia" ? "border-primary" : "border-transparent opacity-60")}>
                  <Coffee className="w-5 h-5" />
                </button>
                <button onClick={() => setTheme("dark")} className={cn("p-3 rounded-md border flex flex-col items-center gap-2", theme === "dark" ? "border-primary" : "border-transparent opacity-60")}>
                  <Moon className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="space-y-3">
              <span className="text-sm font-semibold uppercase tracking-wider opacity-60">Text Size</span>
              <div className="flex items-center gap-4">
                <button onClick={() => setFontSize(s => Math.max(50, s - 10))} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full">
                  <ZoomOut className="w-5 h-5" />
                </button>
                <span className="font-medium w-12 text-center">{fontSize}%</span>
                <button onClick={() => setFontSize(s => Math.min(200, s + 10))} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full">
                  <ZoomIn className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOC Sidebar */}
      <AnimatePresence>
        {showToc && (
          <motion.div 
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute top-16 bottom-0 left-0 w-80 max-w-full shadow-2xl border-r border-black/5 dark:border-white/5 z-20 overflow-y-auto"
            style={{ 
              backgroundColor: theme === 'dark' ? '#1f1f1f' : theme === 'sepia' ? '#eae0c8' : '#ffffff'
            }}
          >
            <div className="p-6">
              <h3 className="font-serif text-2xl font-bold mb-6">Contents</h3>
              <div className="space-y-2">
                {toc.map((item, i) => (
                  <button 
                    key={i} 
                    onClick={() => goTo(item.href)}
                    className="block w-full text-left p-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-sm md:text-base opacity-80 hover:opacity-100 transition-opacity"
                  >
                    {item.label}
                  </button>
                ))}
                {toc.length === 0 && <p className="opacity-50 italic">No table of contents available.</p>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Viewer Area */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="animate-pulse font-serif text-xl opacity-60">Opening volume...</div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10 px-6 text-center">
            <div className="font-serif text-xl opacity-60">This volume could not be opened.</div>
          </div>
        )}
        
        {/* Navigation Areas */}
        <div className="absolute inset-y-0 left-0 w-1/4 z-10 cursor-pointer" onClick={prevPage} />
        <div className="absolute inset-y-0 right-0 w-1/4 z-10 cursor-pointer" onClick={nextPage} />
        
        {/* The actual epub viewer */}
        <AnimatePresence mode="popLayout" custom={direction}>
          <motion.div
            key={pageKey}
            custom={direction}
            initial={{ 
              rotateY: direction > 0 ? 45 : -45, 
              opacity: 0,
              transformPerspective: 1000,
              originX: direction > 0 ? 1 : 0
            }}
            animate={{ 
              rotateY: 0, 
              opacity: 1,
              originX: direction > 0 ? 1 : 0
            }}
            exit={{ 
              rotateY: direction > 0 ? -45 : 45, 
              opacity: 0,
              originX: direction > 0 ? 0 : 1
            }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="absolute inset-0 max-w-3xl mx-auto py-8 px-6 md:px-12 pointer-events-none"
          >
            <div 
              ref={viewerRef} 
              className="w-full h-full [&>div]:!h-full pointer-events-auto" 
            />
          </motion.div>
        </AnimatePresence>
      </div>
      
      {/* Footer Nav */}
      <div className="h-12 flex items-center justify-center gap-12 shrink-0 border-t border-black/5 dark:border-white/5 relative z-10">
        <button onClick={prevPage} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-serif text-sm opacity-60">
          Book Haven
        </span>
        <button onClick={nextPage} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
