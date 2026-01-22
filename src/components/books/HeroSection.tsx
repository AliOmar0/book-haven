import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Book } from '@/types/book';

interface HeroSectionProps {
  featuredBooks?: Book[];
  loading?: boolean;
}

export function HeroSection({ featuredBooks = [], loading }: HeroSectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);

  useEffect(() => {
    if (featuredBooks.length <= 1) return;

    const interval = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % featuredBooks.length);
        setFadeIn(true);
      }, 500); // Wait for fade out
    }, 8000);

    return () => clearInterval(interval);
  }, [featuredBooks.length]);

  const currentBook = featuredBooks[currentIndex];

  if (loading) {
    return (
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-card to-secondary/20 border border-border/30">
        <div className="container py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-6 animate-pulse">
              <div className="h-8 w-32 bg-muted rounded" />
              <div className="h-12 w-3/4 bg-muted rounded" />
              <div className="h-20 w-full bg-muted rounded" />
              <div className="h-12 w-48 bg-muted rounded" />
            </div>
            <div className="hidden md:block">
              <div className="w-48 h-72 bg-muted rounded-lg mx-auto" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-card to-secondary/20 border border-border/30 min-h-[500px] flex items-center">
      {/* Decorative elements */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgwLDAsMCwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />

      <div className={`container relative py-16 md:py-24 transition-opacity duration-500 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Text Content */}
          <div className="space-y-6">
            <Badge variant="secondary" className="bg-gold/10 text-gold border-gold/20">
              <Star className="h-3 w-3 mr-1 fill-gold" />
              Featured Book
            </Badge>

            {currentBook ? (
              <>
                <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
                  {currentBook.title}
                </h1>
                <p className="text-lg text-muted-foreground">
                  by <span className="text-foreground font-medium">{currentBook.author}</span>
                </p>
                {currentBook.description && (
                  <p className="text-muted-foreground line-clamp-3 max-w-lg">
                    {currentBook.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  <Button asChild size="lg" className="group">
                    <Link to={`/book/${currentBook.id}`}>
                      Start Reading
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="lg" asChild>
                    <Link to={`/book/${currentBook.id}`}>
                      View Details
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
                  Discover Classic Literature
                </h1>
                <p className="text-lg text-muted-foreground max-w-lg">
                  Explore thousands of free ebooks from Project Gutenberg and Standard Ebooks.
                  Build your personal library and read anywhere.
                </p>
                <Button size="lg" className="group">
                  Start Exploring
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </>
            )}
          </div>

          {/* Featured Book Cover */}
          <div className="hidden md:flex justify-center">
            {currentBook?.cover_url ? (
              <Link
                to={`/book/${currentBook.id}`}
                className="group relative"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-gold/20 to-transparent rounded-lg transform rotate-3 scale-105" />
                <img
                  src={currentBook.cover_url}
                  alt={`Cover of ${currentBook.title}`}
                  className="relative w-48 lg:w-56 h-auto rounded-lg shadow-book group-hover:shadow-book-hover transition-all duration-300 group-hover:-translate-y-2"
                />
              </Link>
            ) : (
              <div className="w-48 lg:w-56 aspect-[2/3] rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-book">
                <BookOpen className="h-16 w-16 text-primary/40" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Carousel Indicators */}
      {featuredBooks.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {featuredBooks.map((_, idx) => (
            <button
              key={idx}
              className={`h-2 rounded-full transition-all ${idx === currentIndex ? 'w-6 bg-primary' : 'w-2 bg-primary/30 hover:bg-primary/50'
                }`}
              onClick={() => {
                setFadeIn(false);
                setTimeout(() => {
                  setCurrentIndex(idx);
                  setFadeIn(true);
                }, 300);
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
