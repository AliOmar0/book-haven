import { useState, useEffect } from 'react';
import { Star, ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { goodreadsApi } from '@/lib/api/goodreads';
import type { GoodreadsData, GoodreadsReview } from '@/types/goodreads';

interface GoodreadsRatingsProps {
  title: string;
  author?: string;
}

function StarDisplay({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' };
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClasses[size]} ${
            star <= fullStars
              ? 'fill-gold text-gold'
              : star === fullStars + 1 && hasHalfStar
              ? 'fill-gold/50 text-gold'
              : 'text-muted-foreground/30'
          }`}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: GoodreadsReview }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = review.text.length > 300;
  const displayText = expanded || !isLong ? review.text : review.text.slice(0, 300) + '...';

  return (
    <Card className="bg-muted/30">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {review.rating > 0 && <StarDisplay rating={review.rating} size="sm" />}
            <span className="text-sm font-medium">{review.author}</span>
          </div>
          {review.date && (
            <span className="text-xs text-muted-foreground">{review.date}</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
          {displayText}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-primary hover:underline"
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

export function GoodreadsRatings({ title, author }: GoodreadsRatingsProps) {
  const [data, setData] = useState<GoodreadsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(false);
      
      const result = await goodreadsApi.fetchBookData(title, author);
      
      if (result) {
        setData(result);
      } else {
        setError(true);
      }
      
      setLoading(false);
    }

    fetchData();
  }, [title, author]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading Goodreads data...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return null; // Silently fail if we can't get Goodreads data
  }

  const hasRating = data.rating !== null && data.rating > 0;
  const hasReviews = data.reviews && data.reviews.length > 0;

  if (!hasRating && !hasReviews) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="font-serif text-xl font-semibold">Goodreads</h2>
        <Badge variant="outline" className="text-xs bg-[#553B08]/10 text-[#553B08] border-[#553B08]/30">
          External
        </Badge>
      </div>

      {/* Rating Summary */}
      {hasRating && (
        <Card className="bg-gradient-to-r from-[#553B08]/5 to-transparent border-[#553B08]/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-bold text-foreground">
                    {data.rating!.toFixed(2)}
                  </span>
                  <StarDisplay rating={data.rating!} size="md" />
                </div>
                <Separator orientation="vertical" className="h-12" />
                <div className="space-y-0.5">
                  {data.ratingsCount && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {data.ratingsCount.toLocaleString()}
                      </span>{' '}
                      ratings
                    </p>
                  )}
                  {data.reviewsCount && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {data.reviewsCount.toLocaleString()}
                      </span>{' '}
                      reviews
                    </p>
                  )}
                </div>
              </div>

              {data.goodreadsUrl && (
                <a
                  href={data.goodreadsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  View on Goodreads
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reviews */}
      {hasReviews && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Top Reviews ({data.reviews.length})
          </h3>
          <div className="space-y-3">
            {data.reviews.slice(0, 5).map((review, index) => (
              <ReviewCard key={index} review={review} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
