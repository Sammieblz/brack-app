import { useState } from "react";
import { Header } from "@/components/Header";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReviewCard } from "@/components/social/ReviewCard";
import { useReviews } from "@/hooks/useReviews";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Star } from "iconoir-react";
import { useIsMobile } from "@/hooks/use-mobile";

const Reviews = () => {
  const { reviews, loading } = useReviews();
  const [filter, setFilter] = useState<"all" | "5" | "4" | "3" | "2" | "1">("all");
  const isMobile = useIsMobile();

  const filteredReviews =
    filter === "all"
      ? reviews
      : reviews.filter((r) => r.rating === parseInt(filter));

  if (loading) {
    return (
      <MobileLayout>
        {isMobile && <MobileHeader title="Reviews" />}
        <div className="flex h-[calc(var(--app-viewport-height,100dvh)-80px)] items-center justify-center">
          <LoadingSpinner />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      {isMobile && <MobileHeader title="Reviews" />}
      <div className="app-page-narrow">
        {!isMobile && (
          <Header
            title="Reviews"
            subtitle="Browse recent community feedback across books"
          />
        )}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Community Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={filter} onValueChange={(v: string) => setFilter(v as typeof filter)}>
              <div className="overflow-x-auto">
                <TabsList className="grid min-w-[520px] grid-cols-6 w-full sm:min-w-0">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="5">
                    <Star className="h-4 w-4 fill-primary text-primary" />5
                  </TabsTrigger>
                  <TabsTrigger value="4">
                    <Star className="h-4 w-4 fill-primary text-primary" />4
                  </TabsTrigger>
                  <TabsTrigger value="3">
                    <Star className="h-4 w-4 fill-primary text-primary" />3
                  </TabsTrigger>
                  <TabsTrigger value="2">
                    <Star className="h-4 w-4 fill-primary text-primary" />2
                  </TabsTrigger>
                  <TabsTrigger value="1">
                    <Star className="h-4 w-4 fill-primary text-primary" />1
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="all" className="mt-6">
                <div className="space-y-4">
                  {reviews.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <p className="font-sans text-muted-foreground">No reviews found</p>
                      </CardContent>
                    </Card>
                  ) : (
                    reviews.map((review) => (
                      <ReviewCard key={review.id} review={review} showBookInfo />
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="5" className="mt-6">
                <div className="space-y-4">
                  {reviews.filter((r) => r.rating === 5).length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <p className="font-sans text-muted-foreground">No 5-star reviews found</p>
                      </CardContent>
                    </Card>
                  ) : (
                    reviews.filter((r) => r.rating === 5).map((review) => (
                      <ReviewCard key={review.id} review={review} showBookInfo />
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="4" className="mt-6">
                <div className="space-y-4">
                  {reviews.filter((r) => r.rating === 4).length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <p className="font-sans text-muted-foreground">No 4-star reviews found</p>
                      </CardContent>
                    </Card>
                  ) : (
                    reviews.filter((r) => r.rating === 4).map((review) => (
                      <ReviewCard key={review.id} review={review} showBookInfo />
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="3" className="mt-6">
                <div className="space-y-4">
                  {reviews.filter((r) => r.rating === 3).length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <p className="font-sans text-muted-foreground">No 3-star reviews found</p>
                      </CardContent>
                    </Card>
                  ) : (
                    reviews.filter((r) => r.rating === 3).map((review) => (
                      <ReviewCard key={review.id} review={review} showBookInfo />
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="2" className="mt-6">
                <div className="space-y-4">
                  {reviews.filter((r) => r.rating === 2).length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <p className="font-sans text-muted-foreground">No 2-star reviews found</p>
                      </CardContent>
                    </Card>
                  ) : (
                    reviews.filter((r) => r.rating === 2).map((review) => (
                      <ReviewCard key={review.id} review={review} showBookInfo />
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="1" className="mt-6">
                <div className="space-y-4">
                  {reviews.filter((r) => r.rating === 1).length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <p className="font-sans text-muted-foreground">No 1-star reviews found</p>
                      </CardContent>
                    </Card>
                  ) : (
                    reviews.filter((r) => r.rating === 1).map((review) => (
                      <ReviewCard key={review.id} review={review} showBookInfo />
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
};

export default Reviews;
