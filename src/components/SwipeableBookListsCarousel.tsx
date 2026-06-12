import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { NavArrowLeft, NavArrowRight } from "iconoir-react";
import { useAuth } from "@/hooks/useAuth";
import { useBookLists } from "@/hooks/useBookLists";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { cn } from "@/lib/utils";
import { useSwipeable } from "react-swipeable";
import { APP_ICONS } from "@/config/iconography";

export const SwipeableBookListsCarousel = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { lists, loading } = useBookLists(user?.id);
  const { triggerHaptic } = useHapticFeedback();
  const [currentIndex, setCurrentIndex] = useState(0);

  const hasMultiple = lists.length > 1;
  const currentList = lists[currentIndex];
  const totalBooks = useMemo(
    () => lists.reduce((total, list) => total + (list.book_count || 0), 0),
    [lists]
  );

  useEffect(() => {
    if (currentIndex <= lists.length - 1) return;
    setCurrentIndex(Math.max(0, lists.length - 1));
  }, [currentIndex, lists.length]);

  const goToIndex = (index: number) => {
    if (index < 0 || index > lists.length - 1 || index === currentIndex) return;
    triggerHaptic("selection");
    setCurrentIndex(index);
  };

  const handlers = useSwipeable({
    onSwipedLeft: () => goToIndex(currentIndex + 1),
    onSwipedRight: () => goToIndex(currentIndex - 1),
    trackMouse: true,
    preventScrollOnSwipe: true,
  });

  if (loading) {
    return (
      <Card className="h-full overflow-hidden">
        <CardHeader className="border-b border-border/55 pb-4">
          <div className="h-10 w-44 animate-pulse rounded-lg bg-muted" />
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-12 animate-pulse rounded-lg bg-muted" />
            <div className="h-12 animate-pulse rounded-lg bg-muted" />
            <div className="h-12 animate-pulse rounded-lg bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (lists.length === 0) {
    return (
      <Card className="h-full overflow-hidden">
        <CardHeader className="border-b border-border/55 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <APP_ICONS.library.bookLists className="h-5 w-5" />
              </span>
              <div>
                <CardTitle className="font-display text-base md:text-lg">My Book Lists</CardTitle>
                <p className="font-sans text-sm text-muted-foreground">
                  Curate books by mood, season, or priority.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/lists")} className="rounded-full">
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <PremiumEmptyState
            asset="emptyLists"
            title="No lists yet"
            description="Create focused stacks for trips, study plans, clubs, or favorites."
            size="compact"
            className="border-dashed bg-background/45"
            action={
              <Button className="rounded-full" onClick={() => navigate("/lists")}>
                Manage lists
                <NavArrowRight className="ml-1 h-4 w-4" />
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="border-b border-border/55 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <APP_ICONS.library.bookLists className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <CardTitle className="font-display text-base md:text-lg">My Book Lists</CardTitle>
              <p className="font-sans text-sm text-muted-foreground">
                {lists.length} {lists.length === 1 ? "list" : "lists"} · {totalBooks} saved books
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/lists")} className="shrink-0 rounded-full">
            View All
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        <div className="relative" {...handlers}>
          <button
            type="button"
            onClick={() => navigate(`/lists/${currentList.id}`)}
            className="group w-full rounded-2xl border border-border/70 bg-background/55 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:-rotate-2 group-hover:scale-105">
                  <APP_ICONS.library.bookLists className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-display line-clamp-2 text-lg font-semibold leading-snug text-foreground group-hover:text-primary">
                    {currentList.name}
                  </h3>
                  <p className="font-sans mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {currentList.description || "A focused reading stack from your library."}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0 rounded-full">
                {currentList.book_count || 0} books
              </Badge>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="font-sans text-xs text-muted-foreground">
                {hasMultiple ? `List ${currentIndex + 1} of ${lists.length}` : "Open this list"}
              </span>
              <span className="inline-flex items-center rounded-full bg-primary px-3 py-1.5 font-sans text-xs font-semibold text-primary-foreground">
                Open
                <NavArrowRight className="ml-1 h-3.5 w-3.5" />
              </span>
            </div>
          </button>

          {hasMultiple && (
            <div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden items-center justify-between px-2 md:flex">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="pointer-events-auto h-9 w-9 rounded-full bg-background/90 backdrop-blur"
                onClick={(event) => {
                  event.stopPropagation();
                  goToIndex(currentIndex - 1);
                }}
                disabled={currentIndex === 0}
                aria-label="Previous list"
              >
                <NavArrowLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="pointer-events-auto h-9 w-9 rounded-full bg-background/90 backdrop-blur"
                onClick={(event) => {
                  event.stopPropagation();
                  goToIndex(currentIndex + 1);
                }}
                disabled={currentIndex === lists.length - 1}
                aria-label="Next list"
              >
                <NavArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {hasMultiple && (
          <div className="space-y-3">
            <div className="flex justify-center gap-1.5">
              {lists.map((list, index) => (
                <button
                  key={list.id}
                  type="button"
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    index === currentIndex ? "w-7 bg-primary" : "w-1.5 bg-muted-foreground/35"
                  )}
                  aria-label={`Show ${list.name}`}
                  onClick={() => goToIndex(index)}
                />
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {lists.slice(0, 3).map((list, index) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => goToIndex(index)}
                  className={cn(
                    "min-w-0 rounded-xl border px-3 py-2 text-left transition-colors",
                    index === currentIndex
                      ? "border-primary/50 bg-primary/10"
                      : "border-border/55 bg-background/35 hover:border-primary/35"
                  )}
                >
                  <span className="block truncate font-sans text-xs font-semibold text-foreground">
                    {list.name}
                  </span>
                  <span className="block font-sans text-[11px] text-muted-foreground">
                    {list.book_count || 0} books
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
