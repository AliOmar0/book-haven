import { useState } from "react";
import { useInView } from "react-intersection-observer";
import { cn } from "@/lib/utils";
import { BookOpen } from "lucide-react";

interface CoverImageProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt: string;
  aspectRatio?: "portrait" | "auto";
}

export function CoverImage({ src, alt, aspectRatio = "portrait", className, ...props }: CoverImageProps) {
  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin: "200px",
  });

  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div
      ref={ref}
      className={cn(
        "relative overflow-hidden bg-muted flex items-center justify-center border border-border/50",
        aspectRatio === "portrait" ? "aspect-[2/3]" : "h-full w-full",
        className
      )}
      {...props}
    >
      {!error && src && inView ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={cn(
            "object-cover w-full h-full transition-opacity duration-700 ease-in-out",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
      ) : null}

      {(!src || error || (!loaded && inView)) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-card">
          <BookOpen className="w-8 h-8 text-muted-foreground/30 mb-2" />
          <span className="font-serif text-xs sm:text-sm text-muted-foreground/60 line-clamp-3">
            {alt}
          </span>
        </div>
      )}
    </div>
  );
}
