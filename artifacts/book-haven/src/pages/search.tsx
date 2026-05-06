import { useState } from "react";
import { useSearchBooks } from "@/hooks/use-open-library";
import { BookCard, BookCardSkeleton } from "@/components/book-card";
import { Layout } from "@/components/layout";
import { Search as SearchIcon, BookX } from "lucide-react";
import { useLocation } from "wouter";

export default function Search() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialQuery = searchParams.get("q") || "";
  
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  // Simple debounce
  useState(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
      if (query) {
        setLocation(`/search?q=${encodeURIComponent(query)}`, { replace: true });
      } else {
        setLocation(`/search`, { replace: true });
      }
    }, 500);
    return () => clearTimeout(handler);
  });

  const { data, isLoading, error } = useSearchBooks(debouncedQuery);

  return (
    <Layout>
      <div className="px-6 md:px-12 py-10 max-w-7xl mx-auto min-h-[calc(100vh-80px)]">
        <div className="max-w-2xl mx-auto mb-12">
          <h1 className="font-serif text-4xl font-bold mb-6 text-center">Search the Library</h1>
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by title, author, or subject..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-14 pl-12 pr-4 rounded-full border border-border bg-card shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-lg transition-all"
            />
          </div>
        </div>

        {isLoading && (
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
              We couldn't find any books matching "{debouncedQuery}". Try adjusting your search terms or browsing our shelves.
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
