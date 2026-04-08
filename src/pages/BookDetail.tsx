import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Clock, Calendar, Globe, Library, Play, Check, Heart, ExternalLink, Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { booksApi, libraryApi, ratingsApi } from '@/lib/api/books';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Book, UserLibraryItem, UserRating } from '@/types/book';
import { GoodreadsRatings } from '@/components/books/GoodreadsRatings';
import { LazyBookImage } from '@/components/books/LazyBookImage';
import { getGoodreadsRating } from '@/data/goodreads';

// Star rating component
function StarRating({ rating, onRate, readonly = false, size = 'md' }: {
  rating: number;
  onRate?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [hovered, setHovered] = useState(0);
  const sizeClasses = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          onClick={() => onRate?.(star)}
        >
          <Star
            className={`${sizeClasses[size]} ${star <= (hovered || rating)
              ? 'fill-gold text-gold'
              : 'text-muted-foreground/30'
              } transition-colors`}
          />
        </button>
      ))}
    </div>
  );
}

export default function BookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [libraryItem, setLibraryItem] = useState<UserLibraryItem | null>(null);
  const [userRating, setUserRating] = useState<UserRating | null>(null);
  const [allRatings, setAllRatings] = useState<UserRating[]>([]);
  const [newRating, setNewRating] = useState(0);
  const [newReview, setNewReview] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  // Fetch book data
  useEffect(() => {
    async function loadBook() {
      if (!id) return;

      try {
        setLoading(true);
        const bookData = await booksApi.getBook(id);
        if (!bookData) {
          toast({
            title: 'Book not found',
            description: 'The requested book could not be found.',
            variant: 'destructive',
          });
          navigate('/');
          return;
        }
        setBook(bookData);

        // Load ratings
        const ratings = await ratingsApi.getRatings(id);
        setAllRatings(ratings);

        // Load user-specific data
        if (user) {
          const [libItem, userRate] = await Promise.all([
            libraryApi.isInLibrary(user.id, id),
            ratingsApi.getUserRating(user.id, id),
          ]);
          setLibraryItem(libItem);
          if (userRate) {
            setUserRating(userRate);
            setNewRating(userRate.rating);
            setNewReview(userRate.review || '');
          }
        }
      } catch (error) {
        console.error('Error loading book:', error);
        toast({
          title: 'Error loading book',
          description: 'Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    loadBook();
  }, [id, user, navigate, toast]);

  // Add to library
  const handleAddToLibrary = useCallback(async (status: 'want_to_read' | 'reading') => {
    if (!user || !book) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to add books to your library.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await libraryApi.addToLibrary(user.id, book.id, status);
      const libItem = await libraryApi.isInLibrary(user.id, book.id);
      setLibraryItem(libItem);
      toast({
        title: 'Added to library',
        description: `"${book.title}" has been added to your library.`,
      });
    } catch (error) {
      console.error('Error adding to library:', error);
      toast({
        title: 'Failed to add book',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  }, [user, book, toast]);

  // Submit rating
  const handleSubmitRating = useCallback(async () => {
    if (!user || !book || newRating === 0) return;

    try {
      setSubmittingRating(true);
      await ratingsApi.rateBook(user.id, book.id, newRating, newReview || undefined);

      // Refresh ratings
      const [ratings, userRate, updatedBook] = await Promise.all([
        ratingsApi.getRatings(book.id),
        ratingsApi.getUserRating(user.id, book.id),
        booksApi.getBook(book.id),
      ]);

      setAllRatings(ratings);
      setUserRating(userRate);
      if (updatedBook) setBook(updatedBook);

      toast({
        title: 'Rating submitted',
        description: 'Thank you for your rating!',
      });
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast({
        title: 'Failed to submit rating',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingRating(false);
    }
  }, [user, book, newRating, newReview, toast]);

  // Estimate reading time
  const readingTime = book?.word_count
    ? Math.ceil(book.word_count / 250 / 60)
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!book) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Cover & Actions */}
          <div className="lg:col-span-1 space-y-6">
            {/* Cover */}
            <div className="relative aspect-[2/3] max-w-sm mx-auto rounded-lg overflow-hidden shadow-book">
              <LazyBookImage
                src={book.cover_url}
                alt={`Cover of ${book.title}`}
                className="w-full h-full"
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 max-w-sm mx-auto">
              {book.epub_url && (
                <Button asChild size="lg" className="w-full">
                  <Link to={`/read/${book.id}`}>
                    <Play className="h-4 w-4 mr-2" />
                    Start Reading
                  </Link>
                </Button>
              )}

              {libraryItem ? (
                <Button variant="secondary" size="lg" className="w-full" disabled>
                  <Check className="h-4 w-4 mr-2" />
                  In Your Library ({libraryItem.status.replace('_', ' ')})
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="lg"
                    className="flex-1"
                    onClick={() => handleAddToLibrary('want_to_read')}
                  >
                    <Heart className="h-4 w-4 mr-2" />
                    Want to Read
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="flex-1"
                    onClick={() => handleAddToLibrary('reading')}
                  >
                    <Library className="h-4 w-4 mr-2" />
                    Start Now
                  </Button>
                </div>
              )}
            </div>

            {/* Book Info Card */}
            <Card className="max-w-sm mx-auto">
              <CardContent className="p-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Source</span>
                  <Badge variant="secondary">
                    {book.source === 'gutenberg' ? 'Project Gutenberg' : 'Standard Ebooks'}
                  </Badge>
                </div>
                {book.language && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Language
                    </span>
                    <span className="font-medium">{book.language.toUpperCase()}</span>
                  </div>
                )}
                {book.publication_year && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Published
                    </span>
                    <span className="font-medium">{book.publication_year}</span>
                  </div>
                )}
                {readingTime && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Est. Reading Time
                    </span>
                    <span className="font-medium">{readingTime} hours</span>
                  </div>
                )}
                {book.epub_url && (
                  <div className="pt-2">
                    <a
                      href={book.epub_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-sm hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Download EPUB
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Details & Reviews */}
          <div className="lg:col-span-2 space-y-8">
            {/* Title & Author */}
            <div className="space-y-3">
              <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground">
                {book.title}
              </h1>
              <p className="text-lg text-muted-foreground">
                by <span className="text-foreground font-medium">{book.author}</span>
              </p>

              {/* Rating Summary */}
              {/* Rating Summary - Moved to Goodreads Ratings */}

              {/* Goodreads Rating Integration */}
              {(() => {
                const grData = getGoodreadsRating(book.title);
                if (!grData) return null;

                return (
                  <div className="flex items-center gap-2 mt-1 px-3 py-1.5 bg-[#F4F1EA] dark:bg-amber-950/30 rounded-md w-fit border border-[#E9E5D6] dark:border-amber-900/50">
                    <span className="font-serif font-bold text-[#382110] dark:text-amber-100 flex items-center gap-1">
                      g
                      <span className="text-xs font-sans font-normal text-muted-foreground ml-1">Goodreads:</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-foreground">{grData.rating}</span>
                      <span className="text-xs text-muted-foreground">({(grData.count / 1000000).toFixed(1)}M ratings)</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <Separator />

            {/* Description */}
            {book.description && (
              <div className="space-y-3">
                <h2 className="font-serif text-xl font-semibold">About this Book</h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                  {book.description}
                </p>
              </div>
            )}

            {/* Subjects/Tags */}
            {book.subjects && book.subjects.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-serif text-xl font-semibold">Subjects</h2>
                <div className="flex flex-wrap gap-2">
                  {book.subjects.slice(0, 10).map((subject, i) => (
                    <Badge key={i} variant="outline" className="text-sm">
                      {subject}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Goodreads Ratings & Reviews */}
            <GoodreadsRatings title={book.title} author={book.author} />

            <Separator />

            {/* Your Rating */}
            {user && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {userRating ? 'Your Rating' : 'Rate this Book'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <StarRating
                      rating={newRating}
                      onRate={setNewRating}
                      size="lg"
                    />
                    {newRating > 0 && (
                      <span className="text-lg font-medium">{newRating} / 5</span>
                    )}
                  </div>
                  <Textarea
                    placeholder="Write a review (optional)..."
                    value={newReview}
                    onChange={(e) => setNewReview(e.target.value)}
                    rows={3}
                  />
                  <Button
                    onClick={handleSubmitRating}
                    disabled={newRating === 0 || submittingRating}
                  >
                    {submittingRating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : userRating ? (
                      'Update Rating'
                    ) : (
                      'Submit Rating'
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Reviews from Others */}
            {allRatings.length > 0 && (
              <div className="space-y-4">
                <h2 className="font-serif text-xl font-semibold">
                  Community Reviews ({allRatings.length})
                </h2>
                <div className="space-y-4">
                  {allRatings
                    .filter((r) => r.review)
                    .slice(0, 5)
                    .map((rating) => (
                      <Card key={rating.id}>
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center gap-2">
                            <StarRating rating={rating.rating} readonly size="sm" />
                            <span className="text-sm text-muted-foreground">
                              {new Date(rating.created_at || '').toLocaleDateString()}
                            </span>
                          </div>
                          {rating.review && (
                            <p className="text-muted-foreground">{rating.review}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main >
    </div >
  );
}
