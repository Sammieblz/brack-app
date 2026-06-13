import { ActivityFeed } from "@/components/social/ActivityFeed";
import { CreatePostDialog } from "@/components/social/CreatePostDialog";
import { MobileHeader } from "@/components/MobileHeader";
import { MobileLayout } from "@/components/MobileLayout";
import { NativeHeader } from "@/components/NativeHeader";
import { PostCard } from "@/components/social/PostCard";
import { PostCardSkeleton } from "@/components/skeletons/PostCardSkeleton";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePosts } from "@/hooks/usePosts";
import { useSocialFeed } from "@/hooks/useSocialFeed";

const Feed = () => {
  const isMobile = useIsMobile();
  const { activities, loading: activityLoading, refetchFeed } = useSocialFeed();
  const {
    posts,
    loading: postsLoading,
    loadingMore: postsLoadingMore,
    hasMore: postsHasMore,
    caughtUp,
    feedMode,
    refetchPosts,
    loadMore,
    toggleLike,
  } = usePosts();

  const handleRefresh = async () => {
    await Promise.all([refetchFeed(), refetchPosts()]);
  };

  const createAction = (
    <CreatePostDialog
      compact={isMobile}
      onPostCreated={() => {
        refetchFeed();
        refetchPosts();
      }}
    />
  );

  return (
    <MobileLayout>
      {isMobile ? (
        <MobileHeader title="Activity" action={createAction} />
      ) : (
        <NativeHeader
          title="Activity Feed"
          subtitle="Posts and reading updates from your community"
          action={createAction}
          showUtilityActions
        />
      )}

      <PullToRefresh onRefresh={handleRefresh}>
        <main className="app-page">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section className="min-w-0 space-y-4">
              <Card>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="min-w-0">
                      <h2 className="font-display text-xl font-semibold">Community pulse</h2>
                      <p className="font-sans text-sm text-muted-foreground">
                        Share a quick update or catch up on recent reading activity.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="posts" className="w-full">
                <TabsList className="w-full sm:w-auto">
                  <TabsTrigger value="posts" className="gap-2">
                    Posts
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="gap-2">
                    Activity
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="posts" className="mt-4 space-y-3">
                  {postsLoading ? (
                    <>
                      <PostCardSkeleton />
                      <PostCardSkeleton />
                      <PostCardSkeleton />
                    </>
                  ) : posts.length === 0 ? (
                    <EmptyFeedState />
                  ) : (
                    posts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onLike={toggleLike}
                        onDelete={refetchPosts}
                        onBlocked={refetchPosts}
                      />
                    ))
                  )}

                  {!postsLoading && posts.length > 0 && (
                    <FeedPaginationState
                      hasMore={postsHasMore}
                      loading={postsLoadingMore}
                      caughtUp={caughtUp}
                      feedMode={feedMode}
                      onLoadMore={loadMore}
                    />
                  )}
                </TabsContent>

                <TabsContent value="activity" className="mt-4">
                  <ActivityFeed />
                </TabsContent>
              </Tabs>
            </section>

            <aside className="hidden space-y-4 lg:block">
              <Card>
                <CardContent className="space-y-4 p-4">
                  <div>
                    <Badge variant="outline">Today</Badge>
                    <h2 className="mt-3 font-display text-lg font-semibold">At a glance</h2>
                  </div>
                  <PulseMetric
                    label="Posts"
                    value={postsLoading ? "-" : posts.length.toString()}
                  />
                  <PulseMetric
                    label="Activity updates"
                    value={activityLoading ? "-" : activities.length.toString()}
                  />
                  <PulseMetric
                    label="Live surface"
                    value="Community"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 p-4">
                  <h2 className="font-display text-lg font-semibold">Good post ideas</h2>
                  <div className="space-y-2 font-sans text-sm text-muted-foreground">
                    <p>What you just finished.</p>
                    <p>A quote worth saving.</p>
                    <p>A question for readers with similar taste.</p>
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>
        </main>
      </PullToRefresh>
    </MobileLayout>
  );
};

const FeedPaginationState = ({
  hasMore,
  loading,
  caughtUp,
  feedMode,
  onLoadMore,
}: {
  hasMore: boolean;
  loading: boolean;
  caughtUp: boolean;
  feedMode: string;
  onLoadMore: () => void;
}) => {
  if (hasMore) {
    return (
      <div className="flex justify-center py-4">
        <Button variant="outline" onClick={onLoadMore} disabled={loading}>
          {loading ? "Loading..." : "Load more posts"}
        </Button>
      </div>
    );
  }

  if (!caughtUp) return null;

  return (
    <PremiumEmptyState
      asset="syncReviewClear"
      title="You're caught up"
      description={
        <>
          {feedMode === "discovery"
            ? "You've reached the end of current discovery posts. Follow more readers or start a new conversation."
            : "No more posts from your network right now. Brack will surface discovery posts when there is more to explore."}
        </>
      }
      size="compact"
      className="border-dashed"
    />
  );
};

const PulseMetric = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 p-3">
    <div className="flex items-center gap-2">
      <span className="font-sans text-sm text-muted-foreground">{label}</span>
    </div>
    <span className="font-sans text-sm font-semibold">{value}</span>
  </div>
);

const EmptyFeedState = () => (
  <PremiumEmptyState
    asset="emptyFeed"
    title="No posts yet"
    description="Start the community feed with a reading update, recommendation, or thought from your current book."
  />
);

export default Feed;
