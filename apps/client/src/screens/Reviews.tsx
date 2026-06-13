import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "iconoir-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MobileHeader } from "@/components/MobileHeader";
import { MobileLayout } from "@/components/MobileLayout";
import { NativeHeader } from "@/components/NativeHeader";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { ReviewCard } from "@/components/social/ReviewCard";
import { ReviewForm } from "@/components/social/ReviewForm";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useBooks } from "@/hooks/useBooks";
import { useIsMobile } from "@/hooks/use-mobile";
import { useReviewsFeed } from "@/hooks/useReviewsFeed";
import type { Book } from "@/types";
import type { RatingFilter, ReviewScope, ReviewSort } from "@/services/api";

const scopeOptions: Array<{ value: ReviewScope; label: string; description: string }> = [
  { value: "for_you", label: "For You", description: "Network, taste, and community picks" },
  { value: "following", label: "Following", description: "Readers you follow" },
  { value: "recent", label: "Recent", description: "Latest public reviews" },
  { value: "popular", label: "Popular", description: "Most liked recent reviews" },
  { value: "mine", label: "Mine", description: "Your public and private reviews" },
];

const ratingFilters: RatingFilter[] = ["all", "5", "4", "3", "2", "1"];

const Reviews = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [scope, setScope] = useState<ReviewScope>("for_you");
  const [rating, setRating] = useState<RatingFilter>("all");
  const [query, setQuery] = useState("");
  const [writePickerOpen, setWritePickerOpen] = useState(false);
  const [reviewBookId, setReviewBookId] = useState<string | null>(null);

  const sort: ReviewSort = scope === "popular" ? "popular" : scope === "recent" ? "recent" : "personalized";
  const {
    reviews,
    summary,
    loading,
    loadingMore,
    hasMore,
    caughtUp,
    refetch,
    loadMore,
    toggleLike,
    deleteReview,
    shareReview,
  } = useReviewsFeed({ query, rating, scope, sort });

  const action = (
    <Button onClick={() => setWritePickerOpen(true)} size={isMobile ? "sm" : "default"}>
      Write Review
    </Button>
  );

  const activeScope = scopeOptions.find((option) => option.value === scope) ?? scopeOptions[0];

  return (
    <MobileLayout>
      {isMobile ? (
        <MobileHeader title="Reviews" action={action} />
      ) : (
        <NativeHeader
          title="Reviews"
          subtitle="Book-first reactions from readers and your network"
          action={action}
          showUtilityActions
        />
      )}

      <main className="app-page">
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge variant="outline" className="mb-3 w-fit">
                {activeScope.label}
              </Badge>
              <h1 className="font-display text-2xl font-semibold sm:text-3xl">
                Reviews with book context
              </h1>
              <p className="mt-1 max-w-2xl font-sans text-sm text-muted-foreground">
                {activeScope.description}. Every card starts with the book, then the reader's take.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-80">
              <SummaryPill label="Loaded" value={reviews.length.toString()} />
              <SummaryPill
                label="Avg"
                value={averageRating(reviews.map((review) => review.rating))}
              />
              <SummaryPill
                label="Books"
                value={new Set(reviews.map((review) => review.book_id)).size.toString()}
              />
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="min-w-0 space-y-4">
            <div className="sticky top-0 z-20 rounded-lg border border-border bg-card/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:top-3">
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search reviews, books, authors, readers"
                    className="rounded-full pl-9"
                  />
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <Tabs value={scope} onValueChange={(value) => setScope(value as ReviewScope)}>
                    <TabsList className="w-full overflow-x-auto sm:w-auto">
                      {scopeOptions.map((option) => (
                        <TabsTrigger key={option.value} value={option.value} className="min-w-max">
                          {option.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>

                  <Tabs value={rating} onValueChange={(value) => setRating(value as RatingFilter)}>
                    <TabsList className="w-full overflow-x-auto sm:w-auto">
                      {ratingFilters.map((value) => (
                        <TabsTrigger key={value} value={value} className="min-w-10">
                          {value === "all" ? "All" : value}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </div>

            {loading ? (
              <ReviewFeedSkeleton />
            ) : reviews.length === 0 ? (
              <PremiumEmptyState
                asset={query || rating !== "all" ? "noResults" : "emptyReviews"}
                title={query || rating !== "all" ? "No matching reviews" : "No reviews here yet"}
                description={
                  query || rating !== "all"
                    ? "Try a broader search, clear the rating filter, or switch review scopes."
                    : "Follow more readers, review a finished book, or check back as the community grows."
                }
                action={
                  user ? (
                    <Button onClick={() => setWritePickerOpen(true)}>Write a review</Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    compact
                    onLike={toggleLike}
                    onDelete={deleteReview}
                    onShare={shareReview}
                  />
                ))}
              </div>
            )}

            {!loading && reviews.length > 0 && (
              <div className="flex justify-center py-4">
                {hasMore ? (
                  <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? "Loading..." : "Load more reviews"}
                  </Button>
                ) : caughtUp ? (
                  <PremiumEmptyState
                    asset="syncReviewClear"
                    title="You're caught up"
                    description="No more reviews in this view right now."
                    size="compact"
                    variant="plain"
                  />
                ) : null}
              </div>
            )}
          </section>

          <aside className="hidden space-y-4 xl:block">
            <RatingMixCard ratingMix={summary.rating_mix} />
            <TrendingBooksCard books={summary.trending_books} />
            <ReviewOpportunitiesCard
              books={summary.review_opportunities}
              onPick={(bookId) => setReviewBookId(bookId)}
            />
          </aside>
        </div>
      </main>

      <ReviewBookPickerDialog
        open={writePickerOpen}
        onOpenChange={setWritePickerOpen}
        onPick={(bookId) => {
          setWritePickerOpen(false);
          setReviewBookId(bookId);
        }}
      />

      {reviewBookId && (
        <ReviewForm
          bookId={reviewBookId}
          open={Boolean(reviewBookId)}
          onOpenChange={(open) => {
            if (!open) {
              setReviewBookId(null);
              refetch();
            }
          }}
        />
      )}
    </MobileLayout>
  );
};

const averageRating = (ratings: number[]) => {
  if (ratings.length === 0) return "-";
  return (ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1);
};

const SummaryPill = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-border/70 px-3 py-2">
    <p className="font-sans text-lg font-semibold leading-none">{value}</p>
    <p className="mt-1 font-sans text-xs text-muted-foreground">{label}</p>
  </div>
);

const ReviewFeedSkeleton = () => (
  <div className="space-y-4">
    {Array.from({ length: 3 }).map((_, index) => (
      <Card key={index}>
        <CardContent className="space-y-4 p-4">
          <div className="flex gap-3">
            <Skeleton className="h-24 w-16 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    ))}
  </div>
);

const RatingMixCard = ({ ratingMix }: { ratingMix: Array<{ rating: number; count: number }> }) => {
  const max = Math.max(...ratingMix.map((item) => item.count), 1);

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Rating mix</h2>
          <p className="font-sans text-sm text-muted-foreground">
            Distribution in the current review view.
          </p>
        </div>
        <div className="space-y-3">
          {ratingMix.map((item) => (
            <div key={item.rating} className="grid grid-cols-[2rem_1fr_2rem] items-center gap-3">
              <span className="font-sans text-sm font-medium">{item.rating}</span>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(item.count / max) * 100}%` }}
                />
              </div>
              <span className="text-right font-sans text-sm text-muted-foreground">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const TrendingBooksCard = ({
  books,
}: {
  books: Array<{
    id: string;
    title: string;
    author: string | null;
    cover_url: string | null;
    review_count: number;
    average_rating: number | null;
  }>;
}) => {
  const navigate = useNavigate();

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Trending reviewed books</h2>
          <p className="font-sans text-sm text-muted-foreground">
            Books appearing in this review stream.
          </p>
        </div>
        {books.length === 0 ? (
          <p className="font-sans text-sm text-muted-foreground">No book patterns yet.</p>
        ) : (
          <div className="space-y-3">
            {books.map((book) => (
              <button
                key={book.id}
                type="button"
                onClick={() => navigate(`/add-book?query=${encodeURIComponent(`${book.title} ${book.author || ""}`)}`)}
                className="flex w-full gap-3 rounded-md border border-border/70 p-2 text-left transition-colors hover:bg-muted/40"
              >
                <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-muted">
                  {book.cover_url && <img src={book.cover_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-1 font-sans text-sm font-semibold">{book.title}</p>
                  <p className="line-clamp-1 font-sans text-xs text-muted-foreground">
                    {book.review_count} reviews
                    {book.average_rating ? ` · ${book.average_rating} avg` : ""}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const ReviewOpportunitiesCard = ({
  books,
  onPick,
}: {
  books: Array<{ id: string; title: string; author: string | null; cover_url: string | null }>;
  onPick: (bookId: string) => void;
}) => (
  <Card>
    <CardContent className="space-y-4 p-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Ready to review</h2>
        <p className="font-sans text-sm text-muted-foreground">
          Finished books from your library without reviews.
        </p>
      </div>
      {books.length === 0 ? (
        <p className="font-sans text-sm text-muted-foreground">
          Completed books that need reviews will appear here.
        </p>
      ) : (
        <div className="space-y-2">
          {books.map((book) => (
            <button
              key={book.id}
              type="button"
              onClick={() => onPick(book.id)}
              className="flex w-full items-center gap-3 rounded-md border border-border/70 p-2 text-left transition-colors hover:bg-muted/40"
            >
              <div className="h-12 w-8 shrink-0 overflow-hidden rounded bg-muted">
                {book.cover_url && <img src={book.cover_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0">
                <p className="line-clamp-1 font-sans text-sm font-semibold">{book.title}</p>
                <p className="line-clamp-1 font-sans text-xs text-muted-foreground">{book.author}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

const ReviewBookPickerDialog = ({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (bookId: string) => void;
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { books, loading } = useBooks(user?.id);
  const [query, setQuery] = useState("");

  const candidates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const ranked = [...books].sort((a, b) => {
      const statusScore = (book: Book) =>
        book.status === "completed" ? 0 : book.status === "reading" ? 1 : 2;
      return statusScore(a) - statusScore(b);
    });

    if (!normalized) return ranked.slice(0, 20);
    return ranked
      .filter((book) =>
        [book.title, book.author, book.genre]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalized)
      )
      .slice(0, 20);
  }, [books, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a book to review</DialogTitle>
          <DialogDescription>
            Reviews stay attached to a specific book so readers know exactly what you are reacting to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-hidden">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your library"
          />
          <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : candidates.length === 0 ? (
              <PremiumEmptyState
                asset="noResults"
                title="No matching library books"
                description="Search the catalog or add a book first, then come back to write the review."
                size="compact"
                action={
                  <Button
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/add-book?query=${encodeURIComponent(query)}`);
                    }}
                  >
                    Find or add book
                  </Button>
                }
              />
            ) : (
              candidates.map((book) => (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => onPick(book.id)}
                  className="flex w-full gap-3 rounded-md border border-border/70 p-3 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="h-16 w-11 shrink-0 overflow-hidden rounded bg-muted">
                    {book.cover_url && (
                      <img src={book.cover_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 font-sans font-semibold">{book.title}</p>
                    <p className="line-clamp-1 font-serif text-sm text-muted-foreground">
                      {book.author || "Unknown author"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary">{book.status.replace("_", " ")}</Badge>
                      {book.genre && <Badge variant="outline">{book.genre}</Badge>}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Reviews;
