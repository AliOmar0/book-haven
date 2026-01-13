import { Link } from 'react-router-dom';
import { Star, Clock, BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Book } from '@/types/book';

interface BookCardProps {
  book: Book;
  showAddButton?: boolean;
  onAddToLibrary?: (book: Book) => void;
  className?: string;
}

export function BookCard({ book, showAddButton = true, onAddToLibrary, className }: BookCardProps) {
  // Estimate reading time (average 250 words per minute)
  const readingTime = book.word_count 
    ? Math.ceil(book.word_count / 250 / 60) 
    : null;

  return (
    <Card className={cn(
      "group overflow-hidden border-border/50 bg-card hover:shadow-book-hover transition-all duration-300",
      "hover:-translate-y-1",
      className
    )}>
      <Link to={`/book/${book.id}`} className="block">
        {/* Cover Image */}
        <div className="relative aspect-[2/3] overflow-hidden bg-muted">
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={`Cover of ${book.title}`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
              <BookOpen className="h-12 w-12 text-primary/40" />
            </div>
          )}
          
          {/* Source Badge */}
          <Badge 
            variant="secondary" 
            className="absolute top-2 right-2 text-xs bg-background/90 backdrop-blur-sm"
          >
            {book.source === 'gutenberg' ? 'Gutenberg' : 'Standard Ebooks'}
          </Badge>
        </div>
      </Link>

      <CardContent className="p-4 space-y-3">
        <Link to={`/book/${book.id}`} className="block space-y-1">
          <h3 className="font-serif font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {book.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-1">
            {book.author}
          </p>
        </Link>

        {/* Meta Info */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {/* Rating */}
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-gold text-gold" />
            <span className="font-medium">
              {book.average_rating > 0 ? book.average_rating.toFixed(1) : 'N/A'}
            </span>
            {book.rating_count > 0 && (
              <span className="text-muted-foreground/60">
                ({book.rating_count})
              </span>
            )}
          </div>

          {/* Reading Time */}
          {readingTime && (
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{readingTime}h</span>
            </div>
          )}
        </div>

        {/* Add to Library Button */}
        {showAddButton && onAddToLibrary && (
          <Button
            variant="secondary"
            size="sm"
            className="w-full mt-2"
            onClick={(e) => {
              e.preventDefault();
              onAddToLibrary(book);
            }}
          >
            Add to Library
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
