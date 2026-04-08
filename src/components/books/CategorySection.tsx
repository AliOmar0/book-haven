import { useEffect, useRef, useState } from 'react';
import { BookCarousel } from './BookCarousel';
import { useBooksBySubject } from '@/hooks/useBooks';
import type { Book } from '@/types/book';

interface CategorySectionProps {
  title: string;
  subject: string;
  onAddToLibrary?: (book: Book) => void;
}

export function CategorySection({ title, subject, onAddToLibrary }: CategorySectionProps) {
  const [isInView, setIsInView] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Lazy load - only fetch when section is in view
  useEffect(() => {
    if (!sectionRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '200px', // Start loading 200px before entering viewport
        threshold: 0.01,
      }
    );

    observer.observe(sectionRef.current);

    return () => observer.disconnect();
  }, []);

  const { data: books = [], isLoading } = useBooksBySubject(
    isInView ? subject : '',
    60
  );

  return (
    <div ref={sectionRef}>
      {isLoading ? (
        <section className="space-y-4">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="aspect-[2/3] bg-muted rounded-lg animate-pulse" />
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </section>
      ) : books.length > 0 ? (
        <BookCarousel
          title={title}
          books={books}
          onAddToLibrary={onAddToLibrary}
        />
      ) : isInView ? (
        // Placeholder when no books found but section was requested
        <section className="space-y-4 opacity-0" aria-hidden="true" />
      ) : (
        // Initial placeholder before intersection
        <section className="space-y-4">
          <div className="h-8 w-48 bg-muted/50 rounded" />
          <div className="h-64" />
        </section>
      )}
    </div>
  );
}
