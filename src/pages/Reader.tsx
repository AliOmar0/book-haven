import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, Menu, X, ChevronLeft, ChevronRight,
  Bookmark, BookmarkCheck, Highlighter, StickyNote, Settings,
  List, Search, Sun, Moon, Palette, Minus, Plus, Type, Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { booksApi, libraryApi, bookmarksApi, highlightsApi } from '@/lib/api/books';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Book, Bookmark as BookmarkType, Highlight, UserLibraryItem } from '@/types/book';
import { Loader2 } from 'lucide-react';
import ePub, { Book as EpubBook, Rendition, Contents, NavItem } from 'epubjs';

type Theme = 'light' | 'dark' | 'sepia';

interface ReaderSettings {
  theme: Theme;
  fontSize: number;
  fontFamily: 'serif' | 'sans-serif' | 'mono';
  lineSpacing: number;
}

const defaultSettings: ReaderSettings = {
  theme: 'light',
  fontSize: 16,
  fontFamily: 'serif',
  lineSpacing: 1.6,
};

const themeStyles: Record<Theme, { bg: string; text: string; class: string }> = {
  light: { bg: '#ffffff', text: '#1a1a1a', class: 'bg-white text-foreground' },
  dark: { bg: '#1a1a1a', text: '#e5e5e5', class: 'bg-gray-900 text-gray-100' },
  sepia: { bg: '#f4ecd8', text: '#5b4636', class: 'bg-amber-50 text-amber-900' },
};

const highlightColors = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff'];

export default function Reader() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // Book state
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [libraryItem, setLibraryItem] = useState<UserLibraryItem | null>(null);

  // EPUB state
  const viewerRef = useRef<HTMLDivElement>(null);
  const epubRef = useRef<EpubBook | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const [toc, setToc] = useState<NavItem[]>([]);
  const [currentLocation, setCurrentLocation] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [epubReady, setEpubReady] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [locationsReady, setLocationsReady] = useState(false);

  // Page flip animation state
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<'left' | 'right'>('right');

  // UI state
  const [settings, setSettings] = useState<ReaderSettings>(defaultSettings);
  const settingsRef = useRef<ReaderSettings>(defaultSettings);
  const [showSidebar, setShowSidebar] = useState(false);
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedText, setSelectedText] = useState<{ text: string; cfiRange: string } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [selectedColor, setSelectedColor] = useState(highlightColors[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Keep settings ref in sync without triggering EPUB re-init
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Load book data
  useEffect(() => {
    async function loadBook() {
      if (!id) return;

      try {
        setLoading(true);
        const bookData = await booksApi.getBook(id);
        if (!bookData || !bookData.epub_url) {
          toast({
            title: 'Book not available',
            description: 'This book cannot be read online.',
            variant: 'destructive',
          });
          navigate('/');
          return;
        }
        setBook(bookData);

        // Load user data
        if (user) {
          const [libItem, marks, hilights] = await Promise.all([
            libraryApi.isInLibrary(user.id, id),
            bookmarksApi.getBookmarks(user.id, id),
            highlightsApi.getHighlights(user.id, id),
          ]);
          setLibraryItem(libItem);
          setBookmarks(marks);
          setHighlights(hilights);
        }
      } catch (error) {
        console.error('Error loading book:', error);
        toast({
          title: 'Error loading book',
          description: 'Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    loadBook();
  }, [id, user, navigate, toast]);

  // Track container size
  useEffect(() => {
    if (!viewerRef.current) return;

    const updateSize = () => {
      if (viewerRef.current) {
        const rect = viewerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setContainerSize({ width: rect.width, height: rect.height });
        }
      }
    };

    // Initial size
    updateSize();

    // Observe resize
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(viewerRef.current);

    return () => resizeObserver.disconnect();
  }, [loading]);

  // Initialize EPUB reader - only depends on book URL and container, NOT settings
  useEffect(() => {
    if (!book?.epub_url || !viewerRef.current || containerSize.width === 0 || containerSize.height === 0) {
      return;
    }

    let mounted = true;

    const initEpub = async () => {
      try {
        // Clean up existing instance
        if (epubRef.current) {
          epubRef.current.destroy();
          epubRef.current = null;
        }
        setEpubReady(false);
        setLocationsReady(false);

        // Proxy the EPUB URL through our backend function to bypass CORS
        const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-epub?url=${encodeURIComponent(
          book.epub_url!
        )}`;

        const epub = ePub(proxyUrl, { openAs: 'epub' });
        epubRef.current = epub;

        // Wait until the book is ready before rendering
        await epub.ready;

        if (!mounted || !viewerRef.current) return;

        const rendition = epub.renderTo(viewerRef.current, {
          width: containerSize.width,
          height: containerSize.height,
          spread: 'none',
        });
        renditionRef.current = rendition;

        // Location change handler (progress + persistence)
        rendition.on('locationChanged', (location: any) => {
          if (!mounted) return;
          const locationCfi = location?.start?.cfi || '';
          setCurrentLocation(locationCfi);

          // Only compute progress once locations exist
          if (epub.locations.length() > 0 && locationCfi) {
            const progressPercent = epub.locations.percentageFromCfi(locationCfi) * 100;

            // Only update progress state if user is NOT dragging the slider
            if (!isDragging) {
              setProgress(progressPercent);
            }

            // Get page number (index in locations array)
            // location.start.location is often more reliable if available
            const pageIndex = location?.start?.location;
            if (typeof pageIndex === 'number') {
              setCurrentPage(pageIndex);
            } else {
              const locationNum = epub.locations.locationFromCfi(locationCfi);
              setCurrentPage(typeof locationNum === 'number' ? locationNum : 0);
            }

            if (user && libraryItem) {
              libraryApi.updateProgress(libraryItem.id, progressPercent, locationCfi).catch(console.error);
            }
          }
        });

        // Selection handler for highlights
        rendition.on('selected', (cfiRange: string, contents: Contents) => {
          const selection = contents.window.getSelection();
          if (selection && selection.toString().trim()) {
            setSelectedText({
              text: selection.toString().trim(),
              cfiRange,
            });
          }
        });

        // Display from saved location or start
        const startLocation = libraryItem?.current_location || undefined;
        await rendition.display(startLocation);

        if (!mounted) return;

        setEpubReady(true);
        // Apply current settings from ref (not state to avoid re-init)
        applySettings(settingsRef.current);

        // Load TOC + locations in background (used for page count / progress)
        epub.loaded.navigation
          .then((nav) => {
            if (mounted) setToc(nav.toc);
          })
          .catch(console.error);

        epub.locations
          .generate(1024)
          .then(() => {
            if (mounted) {
              setTotalPages(epub.locations.length());
              setLocationsReady(true);
            }
          })
          .catch(console.error);

        // Apply existing highlights
        highlights.forEach((h) => {
          rendition.annotations.highlight(h.cfi_range, {}, () => { }, 'highlight', {
            fill: h.color,
            'fill-opacity': '0.3',
          });
        });
      } catch (error) {
        console.error('Error initializing EPUB:', error);
        toast({
          title: 'Error loading book',
          description: 'Failed to load the EPUB file.',
          variant: 'destructive',
        });
      }
    };

    initEpub();

    return () => {
      mounted = false;
      if (epubRef.current) {
        epubRef.current.destroy();
        epubRef.current = null;
      }
    };
  }, [book?.epub_url, containerSize.width, containerSize.height, libraryItem?.current_location, highlights, user?.id, toast]);

  // Apply settings to rendition WITHOUT re-initializing EPUB
  const applySettings = useCallback((s: ReaderSettings) => {
    if (!renditionRef.current) return;

    const theme = themeStyles[s.theme];

    renditionRef.current.themes.default({
      body: {
        background: theme.bg,
        color: theme.text,
        'font-size': `${s.fontSize}px`,
        'font-family': s.fontFamily === 'serif'
          ? 'Georgia, serif'
          : s.fontFamily === 'mono'
            ? 'Courier, monospace'
            : 'Arial, sans-serif',
        'line-height': s.lineSpacing.toString(),
      },
    });
  }, []);

  // Update settings without re-init - just apply styles
  useEffect(() => {
    if (epubReady) {
      applySettings(settings);
    }
  }, [settings, applySettings, epubReady]);

  // Navigation with page flip animation
  const goNext = useCallback(() => {
    if (isFlipping) return;
    setFlipDirection('right');
    setIsFlipping(true);

    setTimeout(() => {
      renditionRef.current?.next();
    }, 150);

    setTimeout(() => {
      setIsFlipping(false);
    }, 500);
  }, [isFlipping]);

  const goPrev = useCallback(() => {
    if (isFlipping) return;
    setFlipDirection('left');
    setIsFlipping(true);

    setTimeout(() => {
      renditionRef.current?.prev();
    }, 150);

    setTimeout(() => {
      setIsFlipping(false);
    }, 500);
  }, [isFlipping]);

  const goToLocation = useCallback((cfi: string) => {
    renditionRef.current?.display(cfi);
    setShowSidebar(false);
  }, []);

  const goToPercentage = useCallback((percentage: number) => {
    if (!epubRef.current || !locationsReady) return;

    const cfi = epubRef.current.locations.cfiFromPercentage(percentage / 100);
    if (cfi) {
      renditionRef.current?.display(cfi);
    }
  }, [locationsReady]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev]);

  // Bookmarks
  const toggleBookmark = useCallback(async () => {
    if (!user || !book || !currentLocation) return;

    const existingBookmark = bookmarks.find((b) => b.location === currentLocation);

    try {
      if (existingBookmark) {
        await bookmarksApi.deleteBookmark(existingBookmark.id);
        setBookmarks((prev) => prev.filter((b) => b.id !== existingBookmark.id));
        toast({ title: 'Bookmark removed' });
      } else {
        const newBookmark = await bookmarksApi.addBookmark(
          user.id,
          book.id,
          currentLocation,
          `Page ${currentPage}`
        );
        setBookmarks((prev) => [newBookmark, ...prev]);
        toast({ title: 'Bookmark added' });
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      toast({
        title: 'Failed to update bookmark',
        variant: 'destructive',
      });
    }
  }, [user, book, currentLocation, currentPage, bookmarks, toast]);

  const isBookmarked = bookmarks.some((b) => b.location === currentLocation);

  // Highlights
  const addHighlight = useCallback(async () => {
    if (!user || !book || !selectedText) return;

    try {
      const newHighlight = await highlightsApi.addHighlight(
        user.id,
        book.id,
        selectedText.cfiRange,
        selectedText.text,
        selectedColor,
        noteText || undefined
      );

      setHighlights((prev) => [newHighlight, ...prev]);

      // Apply highlight to rendition
      renditionRef.current?.annotations.highlight(
        selectedText.cfiRange,
        {},
        () => { },
        'highlight',
        { fill: selectedColor, 'fill-opacity': '0.3' }
      );

      setSelectedText(null);
      setNoteText('');
      toast({ title: 'Highlight added' });
    } catch (error) {
      console.error('Error adding highlight:', error);
      toast({
        title: 'Failed to add highlight',
        variant: 'destructive',
      });
    }
  }, [user, book, selectedText, selectedColor, noteText, toast]);

  const deleteHighlight = useCallback(async (highlightId: string, cfiRange: string) => {
    try {
      await highlightsApi.deleteHighlight(highlightId);
      setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
      renditionRef.current?.annotations.remove(cfiRange, 'highlight');
      toast({ title: 'Highlight removed' });
    } catch (error) {
      console.error('Error deleting highlight:', error);
      toast({
        title: 'Failed to remove highlight',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Search
  const handleSearch = useCallback(async () => {
    if (!searchQuery || !epubRef.current) return;

    const results: any[] = [];
    const spine = epubRef.current.spine;

    // @ts-ignore - spine.each is valid
    spine.each(async (item: any) => {
      try {
        const doc = await item.load(epubRef.current!.load.bind(epubRef.current));
        const textContent = doc.body.textContent || '';
        const matches = textContent.toLowerCase().indexOf(searchQuery.toLowerCase());
        if (matches !== -1) {
          results.push({
            cfi: item.cfiFromElement(doc.body),
            excerpt: textContent.substring(Math.max(0, matches - 50), matches + 100),
          });
        }
      } catch (e) {
        // Ignore loading errors
      }
    });

    setSearchResults(results);
  }, [searchQuery]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!book) return null;

  const themeClass = themeStyles[settings.theme].class;

  return (
    <div className={`fixed inset-0 flex flex-col ${themeClass}`}>
      {/* Page flip animation overlay */}
      <style>{`
        @keyframes pageFlipRight {
          0% {
            transform: perspective(1200px) rotateY(0deg);
            transform-origin: left center;
          }
          100% {
            transform: perspective(1200px) rotateY(-180deg);
            transform-origin: left center;
          }
        }
        
        @keyframes pageFlipLeft {
          0% {
            transform: perspective(1200px) rotateY(0deg);
            transform-origin: right center;
          }
          100% {
            transform: perspective(1200px) rotateY(180deg);
            transform-origin: right center;
          }
        }
        
        @keyframes pageFlipInRight {
          0% {
            opacity: 0;
            transform: translateX(20px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes pageFlipInLeft {
          0% {
            opacity: 0;
            transform: translateX(-20px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .page-flip-container {
          position: relative;
          overflow: hidden;
        }
        
        .page-flip-container.flipping-right::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(to left, rgba(0,0,0,0.15), transparent 50%);
          animation: pageFlipRight 0.5s ease-in-out;
          pointer-events: none;
          z-index: 30;
        }
        
        .page-flip-container.flipping-left::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(to right, rgba(0,0,0,0.15), transparent 50%);
          animation: pageFlipLeft 0.5s ease-in-out;
          pointer-events: none;
          z-index: 30;
        }
        
        .page-flip-container.flipping-right > div:first-child {
          animation: pageFlipInRight 0.3s ease-out 0.2s both;
        }
        
        .page-flip-container.flipping-left > div:first-child {
          animation: pageFlipInLeft 0.3s ease-out 0.2s both;
        }
        
        .page-curl {
          position: absolute;
          bottom: 0;
          width: 100px;
          height: 100px;
          pointer-events: none;
          z-index: 25;
          opacity: 0;
          transition: opacity 0.2s;
        }
        
        .page-curl-right {
          right: 0;
          background: linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.1) 50%);
        }
        
        .page-curl-left {
          left: 0;
          background: linear-gradient(-135deg, transparent 50%, rgba(0,0,0,0.1) 50%);
        }
        
        .page-flip-container:hover .page-curl {
          opacity: 1;
        }
      `}</style>

      {/* Top Bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-inherit">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/book/${book.id}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="hidden sm:block">
            <p className="font-serif font-semibold text-sm line-clamp-1">{book.title}</p>
            <p className="text-xs text-muted-foreground">{book.author}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Book Tags */}
          {book.subjects && book.subjects.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Tag className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="end">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Book Tags</h4>
                  <div className="flex flex-wrap gap-1">
                    {book.subjects.slice(0, 10).map((subject, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {subject}
                      </Badge>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Bookmark */}
          {user && (
            <Button variant="ghost" size="icon" onClick={toggleBookmark}>
              {isBookmarked ? (
                <BookmarkCheck className="h-5 w-5 text-primary" />
              ) : (
                <Bookmark className="h-5 w-5" />
              )}
            </Button>
          )}

          {/* Search */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Search className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Search in Book</DialogTitle>
                <DialogDescription>Search for text within this book</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch}>Search</Button>
                </div>
                <ScrollArea className="h-60">
                  {searchResults.map((result, i) => (
                    <button
                      key={i}
                      className="w-full text-left p-2 hover:bg-muted rounded text-sm"
                      onClick={() => {
                        goToLocation(result.cfi);
                      }}
                    >
                      <p className="line-clamp-2">{result.excerpt}</p>
                    </button>
                  ))}
                </ScrollArea>
              </div>
            </DialogContent>
          </Dialog>

          {/* Settings */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <h4 className="font-semibold">Reading Settings</h4>

                {/* Theme */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Theme</label>
                  <div className="flex gap-2">
                    <Button
                      variant={settings.theme === 'light' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSettings((s) => ({ ...s, theme: 'light' }))}
                    >
                      <Sun className="h-4 w-4 mr-1" /> Light
                    </Button>
                    <Button
                      variant={settings.theme === 'dark' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSettings((s) => ({ ...s, theme: 'dark' }))}
                    >
                      <Moon className="h-4 w-4 mr-1" /> Dark
                    </Button>
                    <Button
                      variant={settings.theme === 'sepia' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSettings((s) => ({ ...s, theme: 'sepia' }))}
                    >
                      <Palette className="h-4 w-4 mr-1" /> Sepia
                    </Button>
                  </div>
                </div>

                {/* Font Size */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Font Size: {settings.fontSize}px</label>
                  <div className="flex items-center gap-2">
                    <Minus className="h-4 w-4" />
                    <Slider
                      value={[settings.fontSize]}
                      min={12}
                      max={28}
                      step={1}
                      onValueChange={([v]) => setSettings((s) => ({ ...s, fontSize: v }))}
                    />
                    <Plus className="h-4 w-4" />
                  </div>
                </div>

                {/* Font Family */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Font</label>
                  <div className="flex gap-2">
                    <Button
                      variant={settings.fontFamily === 'serif' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSettings((s) => ({ ...s, fontFamily: 'serif' }))}
                    >
                      Serif
                    </Button>
                    <Button
                      variant={settings.fontFamily === 'sans-serif' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSettings((s) => ({ ...s, fontFamily: 'sans-serif' }))}
                    >
                      Sans
                    </Button>
                    <Button
                      variant={settings.fontFamily === 'mono' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSettings((s) => ({ ...s, fontFamily: 'mono' }))}
                    >
                      Mono
                    </Button>
                  </div>
                </div>

                {/* Line Spacing */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Line Spacing: {settings.lineSpacing.toFixed(1)}</label>
                  <Slider
                    value={[settings.lineSpacing]}
                    min={1.2}
                    max={2.4}
                    step={0.1}
                    onValueChange={([v]) => setSettings((s) => ({ ...s, lineSpacing: v }))}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* TOC & Annotations Sidebar */}
          <Sheet open={showSidebar} onOpenChange={setShowSidebar}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <List className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle>Contents</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-6">
                {/* TOC */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Chapters</h4>
                  <ScrollArea className="h-48">
                    {toc.map((item, i) => (
                      <button
                        key={i}
                        className="w-full text-left py-2 px-2 text-sm hover:bg-muted rounded"
                        onClick={() => item.href && goToLocation(item.href)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </ScrollArea>
                </div>

                <Separator />

                {/* Bookmarks */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Bookmark className="h-4 w-4" /> Bookmarks ({bookmarks.length})
                  </h4>
                  <ScrollArea className="h-32">
                    {bookmarks.map((bm) => (
                      <button
                        key={bm.id}
                        className="w-full text-left py-2 px-2 text-sm hover:bg-muted rounded"
                        onClick={() => goToLocation(bm.location)}
                      >
                        {bm.label || 'Bookmark'}
                      </button>
                    ))}
                    {bookmarks.length === 0 && (
                      <p className="text-xs text-muted-foreground">No bookmarks yet</p>
                    )}
                  </ScrollArea>
                </div>

                <Separator />

                {/* Highlights */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Highlighter className="h-4 w-4" /> Highlights ({highlights.length})
                  </h4>
                  <ScrollArea className="h-48">
                    {highlights.map((hl) => (
                      <div
                        key={hl.id}
                        className="py-2 px-2 text-sm hover:bg-muted rounded cursor-pointer"
                        onClick={() => goToLocation(hl.cfi_range)}
                      >
                        <div
                          className="border-l-4 pl-2 mb-1"
                          style={{ borderColor: hl.color }}
                        >
                          <p className="line-clamp-2">{hl.text_content}</p>
                        </div>
                        {hl.note && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <StickyNote className="h-3 w-3" /> {hl.note}
                          </p>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive text-xs mt-1 h-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteHighlight(hl.id, hl.cfi_range);
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    {highlights.length === 0 && (
                      <p className="text-xs text-muted-foreground">No highlights yet</p>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Reader Content */}
      <div className={`flex-1 relative overflow-hidden page-flip-container ${isFlipping ? (flipDirection === 'right' ? 'flipping-right' : 'flipping-left') : ''}`}>
        {/* Navigation buttons */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 hidden md:flex"
          onClick={goPrev}
          disabled={isFlipping}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 hidden md:flex"
          onClick={goNext}
          disabled={isFlipping}
        >
          <ChevronRight className="h-6 w-6" />
        </Button>

        {/* Page curl indicators */}
        <div className="page-curl page-curl-left" />
        <div className="page-curl page-curl-right" />

        {/* Loading indicator while EPUB loads */}
        {!epubReady && book?.epub_url && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-20">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading book...</p>
            </div>
          </div>
        )}

        {/* EPUB Viewer - separate container for epubjs */}
        <div
          ref={viewerRef}
          className="h-full w-full"
          onClick={(e) => {
            if (isFlipping) return;
            const rect = viewerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const clickX = e.clientX - rect.left;
            if (clickX < rect.width / 3) {
              goPrev();
            } else if (clickX > (2 * rect.width) / 3) {
              goNext();
            }
          }}
        />

        {/* Selection Popup */}
        {selectedText && user && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-popover border border-border rounded-lg shadow-lg p-4 space-y-3 w-80">
            <p className="text-sm font-medium line-clamp-2">"{selectedText.text}"</p>

            {/* Color picker */}
            <div className="flex items-center gap-2">
              {highlightColors.map((color) => (
                <button
                  key={color}
                  className={`w-6 h-6 rounded-full border-2 ${selectedColor === color ? 'border-foreground' : 'border-transparent'
                    }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </div>

            {/* Note */}
            <Textarea
              placeholder="Add a note (optional)..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={2}
              className="text-sm"
            />

            <div className="flex gap-2">
              <Button size="sm" onClick={addHighlight}>
                <Highlighter className="h-4 w-4 mr-1" />
                Highlight
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedText(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <footer className="px-4 py-2 border-t border-border/30 bg-inherit">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="min-w-[80px]">
            {locationsReady ? `Page ${currentPage + 1} of ${totalPages}` : 'Loading...'}
          </span>
          <div className="flex-1 mx-4">
            <Slider
              value={[progress]}
              max={100}
              step={0.1}
              disabled={!locationsReady}
              onValueChange={([v]) => {
                setIsDragging(true);
                setProgress(v);
              }}
              onValueCommit={([v]) => {
                setIsDragging(false);
                goToPercentage(v);
              }}
            />
          </div>
          <span className="min-w-[40px] text-right">{Math.round(progress)}%</span>
        </div>
      </footer>
    </div>
  );
}
