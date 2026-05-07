import { useParams, Link } from "wouter";
import { useBookDetail, useBookRatings, getCoverUrl, useAuthorName } from "@/hooks/use-open-library";
import { useGutenbergMatch } from "@/hooks/use-gutenberg";
import { useArchiveMatch } from "@/hooks/use-archive";
import { useStandardEbooksMatch } from "@/hooks/use-standard-ebooks";
import { useGoogleBooksCover } from "@/hooks/use-google-books";
import { usePrefetchBookFile } from "@/hooks/use-epub-data";
import { useEnhancedDescription } from "@/hooks/use-enhanced-description";
import { useFavorites, useReviews } from "@/hooks/use-local-library";
import { Layout } from "@/components/layout";
import { CoverImage } from "@/components/cover-image";
import { StarRating } from "@/components/star-rating";
import { BookmarkPlus, BookmarkMinus, BookOpen, FileText, MessageSquareQuote, Calendar, Loader2 } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function BookDetail() {
  const { workId } = useParams();
  const safeWorkId = workId || "";

  const { data: book, isLoading, error } = useBookDetail(safeWorkId);
  const { data: ratings } = useBookRatings(safeWorkId);
  const { isFavorite, toggleFavorite } = useFavorites();
  const { reviews, addReview, isAdding } = useReviews(safeWorkId);

  const authorKey = book?.authors?.[0]?.author?.key;
  const { data: authorName } = useAuthorName(authorKey);

  const { data: gutenberg, isLoading: isGutenbergLoading } = useGutenbergMatch(book?.title, authorName ?? undefined);
  // Internet Archive is a deep fallback for books Gutenberg doesn't carry.
  // Only fire it once Gutenberg has resolved with no result, to avoid two
  // simultaneous network probes for popular titles where Gutenberg wins instantly.
  const gutenbergHasFile = !!(gutenberg && (gutenberg.epubUrl || gutenberg.pdfUrl));
  const archiveEnabled = !isGutenbergLoading && !gutenbergHasFile;
  const { data: archive, isLoading: isArchiveLoading } = useArchiveMatch(
    safeWorkId,
    book?.title,
    authorName ?? undefined,
    archiveEnabled,
  );
  // Standard Ebooks is a final fallback — small catalog (~1k titles) but
  // dramatically higher EPUB quality than auto-generated sources. Only fire
  // once both Gutenberg and Archive have resolved with no usable file, to
  // avoid an extra network probe for popular titles.
  const archiveHasFile = !!(archive && (archive.epubUrl || archive.pdfUrl));
  const standardEbooksEnabled =
    !isGutenbergLoading && !gutenbergHasFile &&
    archiveEnabled && !isArchiveLoading && !archiveHasFile;
  const { data: standardEbooks, isLoading: isStandardEbooksLoading } = useStandardEbooksMatch(
    book?.title,
    authorName ?? undefined,
    standardEbooksEnabled,
  );
  const { data: googleCover } = useGoogleBooksCover(book?.title, authorName ?? undefined);

  // Unified read-source cascade: Gutenberg → Internet Archive → Standard Ebooks.
  // For Gutenberg/SE, EPUB is the primary CTA (clean reflowable text).
  // For Internet Archive, PDF is the primary CTA — IA's PDFs are real scans
  // with OCR text, while their auto-generated EPUBs are frequently malformed
  // image-only files that crash epub.js.
  const readSource:
    | { epubUrl?: string; pdfUrl?: string; label: string; primary: "epub" | "pdf" }
    | null =
    gutenbergHasFile
      ? { epubUrl: gutenberg!.epubUrl, pdfUrl: gutenberg!.pdfUrl, label: "Project Gutenberg", primary: "epub" }
      : archiveHasFile
        ? { epubUrl: archive!.epubUrl, pdfUrl: archive!.pdfUrl, label: "Internet Archive", primary: "pdf" }
        : standardEbooks?.epubUrl
          ? { epubUrl: standardEbooks.epubUrl, pdfUrl: undefined, label: "Standard Ebooks", primary: "epub" }
          : null;
  const isLookingUp =
    isGutenbergLoading ||
    (archiveEnabled && isArchiveLoading) ||
    (standardEbooksEnabled && isStandardEbooksLoading);
  const prefetch = usePrefetchBookFile();
  const synopsis = useEnhancedDescription(book?.title, authorName ?? undefined, book?.description);

  const [reviewText, setReviewText] = useState("");
  const [reviewStars, setReviewStars] = useState(0);
  const [reviewName, setReviewName] = useState("");

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewText || !reviewStars) return;
    addReview({ name: reviewName.trim() || "Anonymous Reader", stars: reviewStars, text: reviewText.trim() });
    setReviewText("");
    setReviewStars(0);
    setReviewName("");
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto px-6 py-12 animate-pulse flex flex-col md:flex-row gap-10">
          <div className="w-full md:w-1/3 aspect-[2/3] bg-muted rounded-md" />
          <div className="flex-1 space-y-6 pt-4">
            <div className="h-10 bg-muted rounded w-3/4" />
            <div className="h-6 bg-muted rounded w-1/2" />
            <div className="space-y-3 pt-6">
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-4/5" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !book) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto text-center py-32 px-6">
          <h2 className="font-serif text-3xl font-bold mb-4">This volume is misplaced</h2>
          <p className="text-muted-foreground">We couldn't locate this book in our archives.</p>
        </div>
      </Layout>
    );
  }

  const olCover = getCoverUrl(book.covers?.[0], "L");
  const archiveCover = archive ? `https://archive.org/services/img/${archive.identifier}` : undefined;
  const coverFallbacks = [gutenberg?.coverUrl, archiveCover, googleCover ?? undefined];
  const coverUrl = olCover ?? coverFallbacks.find(Boolean);
  const isFav = isFavorite(safeWorkId);
  const description = synopsis.text;
  const hasGoodDescription = description.length >= 80;
  const sourceLabel =
    synopsis.source === "google" ? "Google Books" :
    synopsis.source === "openlibrary" ? "Open Library" : null;

  return (
    <Layout>
      <div className="bg-gradient-to-b from-primary/8 via-card to-background border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 py-12 md:py-20 flex flex-col md:flex-row gap-10 lg:gap-16">
          <div className="w-full max-w-sm mx-auto md:w-1/3 shrink-0">
            <div className="sticky top-24">
              <div className="rounded-lg shadow-2xl overflow-hidden mb-6 border border-border/40">
                <CoverImage src={olCover} fallbacks={coverFallbacks} alt={book.title} className="w-full" />
              </div>

              <div className="flex flex-col gap-3">
                {isLookingUp ? (
                  <div className="flex items-center justify-center gap-2 w-full h-12 bg-primary/30 text-primary-foreground/70 font-medium rounded-md shadow-md">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isGutenbergLoading ? "Looking up edition…" : "Searching Internet Archive…"}
                  </div>
                ) : readSource ? (
                  (() => {
                    const epubBtn = readSource.epubUrl ? (
                      <Link
                        key="epub"
                        href={`/read/${safeWorkId}?epub=${encodeURIComponent(readSource.epubUrl)}`}
                        onMouseEnter={() => prefetch(readSource.epubUrl)}
                        onFocus={() => prefetch(readSource.epubUrl)}
                        onTouchStart={() => prefetch(readSource.epubUrl)}
                        className={cn(
                          "flex items-center justify-center gap-2 w-full h-12 font-medium rounded-md transition-colors",
                          readSource.primary === "epub"
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                            : "border-2 border-primary/30 text-primary hover:bg-primary/5",
                        )}
                      >
                        <BookOpen className="w-5 h-5" />
                        Read EPUB
                      </Link>
                    ) : null;
                    const pdfBtn = readSource.pdfUrl ? (
                      <Link
                        key="pdf"
                        href={`/read-pdf/${safeWorkId}?pdf=${encodeURIComponent(readSource.pdfUrl)}`}
                        onMouseEnter={() => prefetch(readSource.pdfUrl)}
                        onFocus={() => prefetch(readSource.pdfUrl)}
                        onTouchStart={() => prefetch(readSource.pdfUrl)}
                        className={cn(
                          "flex items-center justify-center gap-2 w-full h-12 font-medium rounded-md transition-colors",
                          readSource.primary === "pdf"
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                            : "border-2 border-primary/30 text-primary hover:bg-primary/5",
                        )}
                      >
                        <FileText className="w-5 h-5" />
                        Read PDF
                      </Link>
                    ) : null;
                    const ordered = readSource.primary === "pdf"
                      ? [pdfBtn, epubBtn]
                      : [epubBtn, pdfBtn];
                    return (
                      <div className="flex flex-col gap-2">
                        {ordered}
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 text-center pt-1">
                          via {readSource.label}
                        </p>
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex items-center justify-center gap-2 w-full h-12 bg-muted/60 text-muted-foreground font-medium rounded-md text-sm border border-dashed border-border">
                    Not available to read
                  </div>
                )}

                <button
                  onClick={() => toggleFavorite({ workId: safeWorkId, title: book.title, author: authorName ?? undefined, coverUrl: coverUrl ?? undefined })}
                  className="flex items-center justify-center gap-2 w-full h-12 border-2 border-primary/20 text-primary font-medium rounded-md hover:bg-primary/5 transition-colors"
                >
                  {isFav ? <BookmarkMinus className="w-5 h-5" /> : <BookmarkPlus className="w-5 h-5" />}
                  {isFav ? "Remove from Shelf" : "Add to Shelf"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-8">
            <div>
              <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-foreground mb-3">
                {book.title}
              </h1>
              {authorName && (
                <p className="text-lg text-muted-foreground italic font-serif">by {authorName}</p>
              )}

              {ratings && ratings.summary.count > 0 && (
                <div className="flex items-center gap-4 mt-6 p-4 bg-card rounded-md border border-border shadow-sm inline-flex">
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground uppercase tracking-wider font-semibold mb-1">Community Rating</span>
                    <div className="flex items-center gap-3">
                      <StarRating value={ratings.summary.average || 0} readOnly />
                      <span className="font-medium text-lg">{ratings.summary.average?.toFixed(1) || "N/A"}</span>
                      <span className="text-muted-foreground text-sm">({ratings.summary.count.toLocaleString()} ratings)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="prose prose-stone dark:prose-invert max-w-none">
              <div className="flex items-baseline justify-between gap-3 mb-4">
                <h3 className="font-serif text-2xl font-semibold">Synopsis</h3>
                {sourceLabel && hasGoodDescription && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    via {sourceLabel}
                  </span>
                )}
              </div>
              {synopsis.loading && !hasGoodDescription ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-4 bg-muted/50 rounded w-full" />
                  <div className="h-4 bg-muted/50 rounded w-11/12" />
                  <div className="h-4 bg-muted/50 rounded w-4/5" />
                </div>
              ) : hasGoodDescription ? (
                <div className="space-y-4 text-lg leading-relaxed text-foreground/85 font-serif">
                  {description.split(/\n{2,}/).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              ) : (
                <p className="text-base text-muted-foreground italic font-serif">
                  No detailed synopsis is available for this volume. The story unfolds within its pages.
                </p>
              )}
            </div>

            {book.subjects && book.subjects.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Subjects</h3>
                <div className="flex flex-wrap gap-2">
                  {book.subjects.slice(0, 10).map(sub => (
                    <span key={sub} className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-sm font-medium">
                      {sub}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="flex items-center gap-3 mb-10">
          <MessageSquareQuote className="w-8 h-8 text-primary" />
          <h2 className="font-serif text-3xl font-bold">Reader's Notes</h2>
        </div>

        <div className="bg-card p-6 md:p-8 rounded-lg border border-border shadow-sm mb-12">
          <h3 className="font-semibold text-lg mb-4">Add your thoughts</h3>
          <form onSubmit={handleReviewSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Rating</label>
              <StarRating value={reviewStars} onChange={setReviewStars} />
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">Pen Name (Optional)</label>
              <input
                id="name"
                type="text"
                value={reviewName}
                onChange={e => setReviewName(e.target.value)}
                className="w-full md:w-1/2 h-10 px-3 rounded-md border border-input bg-background"
                placeholder="How shall we record you?"
              />
            </div>
            <div>
              <label htmlFor="review" className="block text-sm font-medium mb-2">Your Notes</label>
              <textarea
                id="review"
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
                className="w-full h-32 p-3 rounded-md border border-input bg-background resize-none"
                placeholder="What did you think of this volume?"
                required
              />
            </div>
            <button
              type="submit"
              disabled={!reviewText || !reviewStars || isAdding}
              className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {isAdding && <Loader2 className="w-4 h-4 animate-spin" />}
              Record Notes
            </button>
          </form>
        </div>

        <div className="space-y-6">
          {reviews.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-lg">
              <p className="text-muted-foreground italic">Be the first to record notes on this volume.</p>
            </div>
          ) : (
            reviews.map(review => (
              <div key={review.id} className="p-6 bg-background border border-border rounded-lg">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-semibold">{review.name}</h4>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(review.createdAt), "MMM d, yyyy")}
                    </div>
                  </div>
                  <StarRating value={review.stars} readOnly />
                </div>
                <p className="whitespace-pre-wrap text-foreground/90 leading-relaxed">{review.text}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
