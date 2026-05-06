import { useFavorites } from "@/hooks/use-local-library";
import { Layout } from "@/components/layout";
import { BookCard, BookCardSkeleton } from "@/components/book-card";
import { Library, BookHeart } from "lucide-react";

export default function MyShelf() {
  const { favorites, isLoading } = useFavorites();

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-12 md:py-20 min-h-[calc(100vh-80px)]">
        <div className="flex items-center gap-4 mb-12">
          <Library className="w-10 h-10 text-primary" />
          <h1 className="font-serif text-4xl md:text-5xl font-bold">My Shelf</h1>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 gap-y-10">
            {Array.from({ length: 5 }).map((_, i) => <BookCardSkeleton key={i} />)}
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-32 flex flex-col items-center bg-card rounded-xl border border-border">
            <BookHeart className="w-16 h-16 text-muted-foreground/30 mb-6" />
            <h3 className="font-serif text-2xl font-bold mb-2">Your shelf is bare</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Books you save will appear here. Go explore the library to find something to read.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 gap-y-10">
            {favorites.map((book) => (
              <BookCard
                key={book.workId}
                workId={book.workId}
                title={book.title}
                author={book.author ?? undefined}
                coverUrl={book.coverUrl ?? undefined}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
