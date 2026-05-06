import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { cn } from "@/lib/utils";
import { BookOpen } from "lucide-react";

interface CoverImageProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  fallbacks?: (string | undefined | null)[];
  alt: string;
  aspectRatio?: "portrait" | "auto";
}

export function CoverImage({
  src,
  fallbacks,
  alt,
  aspectRatio = "portrait",
  className,
  ...props
}: CoverImageProps) {
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "200px" });

  // Build dedup'd list of candidate URLs in priority order.
  const candidates: string[] = [];
  for (const u of [src, ...(fallbacks ?? [])]) {
    if (u && !candidates.includes(u)) candidates.push(u);
  }

  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Reset when the candidate list changes (e.g. fallbacks resolved later).
  useEffect(() => {
    setIdx(0);
    setLoaded(false);
  }, [candidates.join("|")]);

  const current = candidates[idx];
  const exhausted = idx >= candidates.length;

  return (
    <div
      ref={ref}
      className={cn(
        "relative overflow-hidden bg-muted flex items-center justify-center border border-border/50",
        aspectRatio === "portrait" ? "aspect-[2/3]" : "h-full w-full",
        className,
      )}
      {...props}
    >
      {current && inView && !exhausted && (
        <img
          key={current}
          src={current}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setIdx((i) => i + 1);
          }}
          className={cn(
            "object-cover w-full h-full transition-opacity duration-700 ease-in-out",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      )}

      {(!current || exhausted || (!loaded && inView)) && (
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
