import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { HeroSection } from '@/components/books/HeroSection';
import { SearchBar } from '@/components/books/SearchBar';
import { BookCarousel } from '@/components/books/BookCarousel';
import { BookCard } from '@/components/books/BookCard';
import { booksApi, libraryApi } from '@/lib/api/books';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Book } from '@/types/book';
import { Loader2 } from 'lucide-react';

export default function Index() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [featuredBooks, setFeaturedBooks] = useState<Book[]>([]);
  const [popularBooks, setPopularBooks] = useState<Book[]>([]);
  const [recentBooks, setRecentBooks] = useState<Book[]>([]);
  const [searchResults, setSearchResults] = useState<Book[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch initial books
  useEffect(() => {
    async function loadBooks() {
      try {
        setLoading(true);
        const featured = await booksApi.getFeaturedBooks();

        if (featured.length > 0) {
          setFeaturedBooks(featured.slice(0, 5));
          setPopularBooks(featured.slice(1, 11));
          setRecentBooks(featured.slice(5, 15));
        }
      } catch (error) {
        console.error('Error loading books:', error);
        toast({
          title: 'Error loading books',
          description: 'Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    loadBooks();
  }, [toast]);

  // Handle search
  const handleSearch = useCallback(async (query: string, filters: any) => {
    if (!query && filters.source === 'all' && !filters.subject) {
      setSearchResults(null);
      setSearchQuery('');
      return;
    }

    setSearchLoading(true);
    setSearchQuery(query);

    try {
      const result = await booksApi.fetchBooks({
        query,
        source: filters.source === 'all' ? undefined : filters.source,
        subject: filters.subject,
        limit: 40,
      });
      setSearchResults(result.books);
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: 'Search failed',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSearchLoading(false);
    }
  }, [toast]);

  // Handle adding to library
  const handleAddToLibrary = useCallback(async (book: Book) => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to add books to your library.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await libraryApi.addToLibrary(user.id, book.id);
      toast({
        title: 'Added to library',
        description: `"${book.title}" has been added to your library.`,
      });
    } catch (error) {
      console.error('Error adding to library:', error);
      toast({
        title: 'Failed to add book',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  }, [user, toast]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8 space-y-12">
        {/* Hero Section */}
        <HeroSection featuredBooks={featuredBooks} loading={loading} />

        {/* Search Bar */}
        <div className="max-w-3xl mx-auto">
          <SearchBar onSearch={handleSearch} />
        </div>

        {/* Content */}
        {searchLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : searchResults ? (
          // Search Results
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl font-semibold">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                {searchQuery && ` for "${searchQuery}"`}
              </h2>
              <button
                onClick={() => {
                  setSearchResults(null);
                  setSearchQuery('');
                }}
                className="text-sm text-primary hover:underline"
              >
                Clear search
              </button>
            </div>

            {searchResults.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                {searchResults.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onAddToLibrary={handleAddToLibrary}
                    showAddButton={!!user}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 text-muted-foreground">
                <p>No books found. Try adjusting your search.</p>
              </div>
            )}
          </section>
        ) : loading ? (
          <div className="space-y-8">
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-48 bg-muted rounded" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="aspect-[2/3] bg-muted rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Browse Sections
          <>
            <BookCarousel
              title="Popular Classics"
              books={popularBooks}
              onAddToLibrary={user ? handleAddToLibrary : undefined}
            />

            <BookCarousel
              title="Recently Added"
              books={recentBooks}
              onAddToLibrary={user ? handleAddToLibrary : undefined}
            />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-20">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          <p>
            Books sourced from{' '}
            <a href="https://gutenberg.org" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Project Gutenberg
            </a>{' '}
            and{' '}
            <a href="https://standardebooks.org" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Standard Ebooks
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
