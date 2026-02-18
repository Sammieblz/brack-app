import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReviewCard } from "@/components/social/ReviewCard";
import { useReviews } from "@/hooks/useReviews";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Star } from "lucide-react";

const Reviews = () => {
  const { reviews, loading } = useReviews();
  const [filter, setFilter] = useState<"all" | "5" | "4" | "3" | "2" | "1">("all");

  const filteredReviews =
    filter === "all"
      ? reviews
      : reviews.filter((r) => r.rating === parseInt(filter));

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="Reviews" />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header title="Reviews" />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Community Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={filter} onValueChange={(v: string) => setFilter(v as typeof filter)}>
              <TabsList className="grid grid-cols-6 w-full">
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
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {filteredReviews.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="font-sans text-muted-foreground">No reviews found</p>
              </CardContent>
            </Card>
          ) : (
            filteredReviews.map((review) => (
              <ReviewCard key={review.id} review={review} showBookInfo />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Reviews;
