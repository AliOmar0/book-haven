import { useState, useRef, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LazyBookImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  placeholderClassName?: string;
}

export function LazyBookImage({ 
  src, 
  alt, 
  className,
  placeholderClassName 
}: LazyBookImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '100px', // Start loading 100px before entering viewport
        threshold: 0.01,
      }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, []);

  if (!src || hasError) {
    return (
      <div 
        ref={imgRef}
        className={cn(
          "flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5",
          placeholderClassName || className
        )}
      >
        <BookOpen className="h-12 w-12 text-primary/40" />
      </div>
    );
  }

  return (
    <div ref={imgRef} className={cn("relative overflow-hidden", className)}>
      {/* Skeleton placeholder */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      
      {/* Actual image - only load when in view */}
      {isInView && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}
    </div>
  );
}
