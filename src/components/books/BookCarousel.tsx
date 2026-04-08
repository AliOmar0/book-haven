import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { BookCard } from './BookCard';
import type { Book } from '@/types/book';

interface BookCarouselProps {
  title: string;
  books: Book[];
  onAddToLibrary?: (book: Book) => void;
  showViewAll?: boolean;
  onViewAll?: () => void;
}

export function BookCarousel({
  title,
  books,
  onAddToLibrary,
  showViewAll = false,
  onViewAll
}: BookCarouselProps) {
  if (books.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl font-semibold text-foreground">
          {title}
        </h2>
        {showViewAll && onViewAll && (
          <Button variant="ghost" onClick={onViewAll} className="text-primary">
            View All
          </Button>
        )}
      </div>

      <Carousel
        opts={{
          align: 'start',
          loop: true,
          dragFree: true,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {books.map((book) => (
            <CarouselItem
              key={book.id}
              className="pl-2 md:pl-4 basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5"
            >
              <BookCard
                book={book}
                onAddToLibrary={onAddToLibrary}
                showAddButton={!!onAddToLibrary}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden md:flex -left-4" />
        <CarouselNext className="hidden md:flex -right-4" />
      </Carousel>
    </section>
  );
}
