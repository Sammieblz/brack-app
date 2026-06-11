import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MobileHeader } from "@/components/MobileHeader";
import { MobileLayout } from "@/components/MobileLayout";
import { NativeHeader } from "@/components/NativeHeader";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { ReviewCard } from "@/components/social/ReviewCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LoadingSpinner from "@/components/LoadingSpinner";
import { APP_ICONS } from "@/config/iconography";
import { AppIcon } from "@/components/ui/app-icon";
import { useIsMobile } from "@/hooks/use-mobile";
import { useReviews } from "@/hooks/useReviews";

type RatingFilter = "all" | "5" | "4" | "3" | "2" | "1";

const ratingFilters: RatingFilter[] = ["all", "5", "4", "3", "2", "1"];

const Reviews = () => {
  const { reviews, loading, averageRating, refetch: refetchReviews } = useReviews(undefined, undefined, {
    community: true,
    limit: 80,
  });
  const [filter, setFilter] = useState<RatingFilter>("all");
  const [query, setQuery] = useState("");
  const isMobile = useIsMobile();

  const filteredReviews = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return reviews.filter((review) => {
      const ratingMatches = filter === "all" || review.rating === Number(filter);
      if (!ratingMatches) return false;
      if (!normalizedQuery) return true;

      const searchable = [
        review.title,
        review.content,
        review.profiles?.display_name,
        review.books?.title,
        review.books?.author,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [filter, query, reviews]);

  const booksReviewed = useMemo(
    () => new Set(reviews.map((review) => review.book_id)).size,
    [reviews]
  );

  const ratingBreakdown = useMemo(
    () =>
      [5, 4, 3, 2, 1].map((rating) => ({
        rating,
        count: reviews.filter((review) => review.rating === rating).length,
      })),
    [reviews]
  );

  const maxRatingCount = Math.max(...ratingBreakdown.map((item) => item.count), 1);

  return (
    <MobileLayout>
      {isMobile ? (
        <MobileHeader title="Reviews" />
      ) : (
        <NativeHeader
          title="Reviews"
          subtitle="Community notes, ratings, and book reactions"
          showUtilityActions
        />
      )}

      <main className="app-page">
        <section className="grid grid-cols-3 gap-2 sm:gap-3">
          <MetricCard
            label="Reviews"
            value={reviews.length.toString()}
          />
          <MetricCard
            label="Average rating"
            value={averageRating ? averageRating.toFixed(1) : "-"}
          />
          <MetricCard
            label="Books reviewed"
            value={booksReviewed.toString()}
          />
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="min-w-0 space-y-4">
            <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <AppIcon
                    icon={APP_ICONS.common.search}
                    variant="inline"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search reviews, books, authors"
                    className="rounded-full pl-9"
                  />
                </div>

                <div className="overflow-x-auto">
                  <Tabs value={filter} onValueChange={(value) => setFilter(value as RatingFilter)}>
                    <TabsList className="min-w-max shadow-none">
                      {ratingFilters.map((rating) => (
                        <TabsTrigger key={rating} value={rating} className="gap-1.5 px-3">
                          {rating === "all" ? "All" : rating}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </div>

            {loading ? (
              <Card>
                <CardContent className="flex min-h-[18rem] items-center justify-center">
                  <LoadingSpinner />
                </CardContent>
              </Card>
            ) : filteredReviews.length === 0 ? (
              <EmptyReviews query={query} filter={filter} />
            ) : (
              <div className="space-y-3">
                {filteredReviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    showBookInfo
                    onChanged={refetchReviews}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="hidden space-y-4 lg:block">
            <Card>
              <CardContent className="space-y-4 p-4">
                <div>
                  <h2 className="font-display text-lg font-semibold">Rating mix</h2>
                  <p className="font-sans text-sm text-muted-foreground">
                    How the latest public reviews are distributed.
                  </p>
                </div>
                <div className="space-y-3">
                  {ratingBreakdown.map((item) => (
                    <div key={item.rating} className="grid grid-cols-[2.5rem_1fr_2rem] items-center gap-3">
                      <div className="flex items-center gap-1 font-sans text-sm font-medium">
                        {item.rating}
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(item.count / maxRatingCount) * 100}%` }}
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

            <Card>
              <CardContent className="space-y-3 p-4">
                <Badge variant="outline" className="w-fit">
                  Community
                </Badge>
                <h2 className="font-display text-lg font-semibold">Write from the book page</h2>
                <p className="font-sans text-sm text-muted-foreground">
                  Reviews stay tied to books, so add or edit them from a book detail page.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </MobileLayout>
  );
};

const MetricCard = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <Card>
    <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
      <div className="min-w-0">
        <p className="font-sans text-lg font-semibold leading-none sm:text-2xl">{value}</p>
        <p className="mt-1 truncate font-sans text-[11px] text-muted-foreground sm:text-sm">{label}</p>
      </div>
    </CardContent>
  </Card>
);

const EmptyReviews = ({ query, filter }: { query: string; filter: RatingFilter }) => (
  <PremiumEmptyState
    asset={query || filter !== "all" ? "noResults" : "emptyReviews"}
    title={query || filter !== "all" ? "No matching reviews" : "No public reviews yet"}
    description={
      query || filter !== "all"
        ? "Try a different search or rating filter."
        : "Reviews will appear here once readers share public feedback from book pages."
    }
  />
);

export default Reviews;
