import { useState } from "react";
import { Star, StarHalf } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  className?: string;
}

export function StarRating({ value, onChange, readOnly = false, className }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const displayValue = hoverValue !== null ? hoverValue : value;

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= displayValue;
        const half = !filled && star - 0.5 <= displayValue;

        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !readOnly && setHoverValue(star)}
            onMouseLeave={() => !readOnly && setHoverValue(null)}
            className={cn(
              "focus:outline-none transition-transform active:scale-90",
              readOnly ? "cursor-default" : "cursor-pointer"
            )}
          >
            {half ? (
              <StarHalf className="w-5 h-5 fill-accent text-accent" />
            ) : (
              <Star
                className={cn(
                  "w-5 h-5",
                  filled ? "fill-accent text-accent" : "fill-muted text-muted-foreground/30"
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
