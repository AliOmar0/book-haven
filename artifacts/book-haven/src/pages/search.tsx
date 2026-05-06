import { useState, useEffect, useMemo } from "react";
import { useSearchBooks } from "@/hooks/use-open-library";
import { BookCard, BookCardSkeleton } from "@/components/book-card";
import { Layout } from "@/components/layout";
import { Search as SearchIcon, BookX, Filter, X } from "lucide-react";
import { useLocation } from "wouter";

const SUBJECT_FILTERS = [
  "fiction", "fantasy", "mystery", "romance", "science_fiction",
  "poetry", "philosophy", "history", "biography", "classics",
];

const LANGUAGE_FILTERS = [
  { code: "", label: "Any language" },
  { code: "eng", label: "English" },
  { code: "fre", label: "French" },
  { code: "spa", label: "Spanish" },
  { code: "ger", label: "German" },
  { code: "ita", label: "Italian" },
];

export default function Search() {
  const [, setLocation] = useLocation();
  const initialQuery = useMemo(
    () => new URLSearchParams(window.location.search).get("q") || "",
    [],
  );

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [subject, setSubject] = useState<string>("");
  const [language, setLanguage] = useState<string>("");
  const [ebookOnly, setEbookOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
      const url = query ? `/search?q=${encodeURIComponent(query)}` : `/search`;
      setLocation(url, { replace: true });
    }, 400);
    return () => clearTimeout(handler);
  }, [query, setLocation]);

  const { data, isLoading, error } = useSearchBooks(debouncedQuery, {
    subject: subject || undefined,
    language: language || undefined,
    ebookOnly,
  });

  const activeFilterCount =
    (subject ? 1 : 0) + (language ? 1 : 0) + (ebookOnly ? 1 : 0);

  return (
    <Layout>
      <div className="px-6 md:px-12 py-10 max-w-7xl mx-auto min-h-[calc(100vh-80px)]">
        <div className="max-w-2xl mx-auto mb-8">
          <h1 className="font-serif text-4xl font-bold mb-6 text-center">
            Search the Library
          </h1>
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by title, author, or subject..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-14 pl-12 pr-32 rounded-full border border-border bg-card shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-lg transition-all"
            />
            <button
              onClick={() => setShowFilters((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-4 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center gap-2 hover:bg-primary/15 transition-colors"
            >
              <Filter className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="mt-6 p-6 bg-card rounded-2xl border border-border space-y-5 shadow-sm">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">
                  Genre
                </label>
                <div className="flex flex-wrap gap-2">
                  {SUBJECT_FILTERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSubject(subject === s ? "" : s)}
                      className={`px-3 py-1.5 rounded-full text-sm capitalize transition-colors border ${
                        subject === s
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:border-primary/40"
                      }`}
                    >
                      {s.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-6 items-center">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                    Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="h-10 px-3 rounded-md border border-border bg-background text-sm"
                  >
                    {LANGUAGE_FILTERS.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer mt-6">
                  <input
                    type="checkbox"
                    checked={ebookOnly}
                    onChange={(e) => setEbookOnly(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Readable ebooks only</span>
                </label>
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => {
                      setSubject("");
                      setLanguage("");
                      setEbookOnly(false);
                    }}
                    className="ml-auto mt-6 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <X className="w-4 h-4" /> Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {isLoading && debouncedQuery && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 gap-y-10">
            {Array.from({ length: 10 }).map((_, i) => (
              <BookCardSkeleton key={i} />
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-20">
            <p className="text-destructive font-medium">An error occurred while searching.</p>
          </div>
        )}

        {!isLoading && !error && data?.docs && data.docs.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 gap-y-10">
            {data.docs.map((book) => (
              <BookCard
                key={book.key}
                workId={book.key}
                title={book.title}
                author={book.author_name?.[0]}
                coverId={book.cover_i}
              />
            ))}
          </div>
        )}

        {!isLoading && !error && debouncedQuery && data?.docs?.length === 0 && (
          <div className="text-center py-32 flex flex-col items-center">
            <BookX className="w-16 h-16 text-muted-foreground/30 mb-6" />
            <h3 className="font-serif text-2xl font-bold mb-2">No volumes found</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              We couldn't find any books matching "{debouncedQuery}". Try different terms or adjust your filters.
            </p>
          </div>
        )}

        {!debouncedQuery && (
          <div className="text-center py-32 flex flex-col items-center opacity-50">
            <SearchIcon className="w-16 h-16 text-muted-foreground mb-6" />
            <p className="text-xl font-serif">What are you looking for?</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
