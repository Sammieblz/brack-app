import { CreatePostDialog } from "@/components/social/CreatePostDialog";
import { ActivityFeed } from "@/components/social/ActivityFeed";
import { PostCard } from "@/components/social/PostCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { TrendingUp, Users } from "lucide-react";
import { useSocialFeed } from "@/hooks/useSocialFeed";
import { usePosts } from "@/hooks/usePosts";
import { PostCardSkeleton } from "@/components/skeletons/PostCardSkeleton";
import { PullToRefresh } from "@/components/PullToRefresh";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";

const Feed = () => {
  const isMobile = useIsMobile();
  const { refetchFeed } = useSocialFeed();
  const { posts, loading: postsLoading, refetchPosts, toggleLike } = usePosts();

  const handleRefresh = async () => {
    await Promise.all([
      refetchFeed(),
      refetchPosts(),
    ]);
  };

  return (
    <MobileLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        {isMobile && (
          <MobileHeader 
            title="Social" 
            action={<CreatePostDialog onPostCreated={() => {
              refetchFeed();
              refetchPosts();
            }} />}
          />
        )}
        
        <main className="container max-w-4xl mx-auto px-4 py-4 md:py-8">
          {!isMobile && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-3xl font-bold">Activity Feed</h1>
                  <p className="text-muted-foreground flex items-center gap-2 mt-1">
                    <Users className="h-4 w-4" />
                    See what your reading community is up to
                  </p>
                </div>
                <CreatePostDialog onPostCreated={() => {
                  refetchFeed();
                  refetchPosts();
                }} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center gap-2 text-primary mb-1">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm font-semibold">Trending</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Most active readers today</p>
                </Card>
                <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center gap-2 text-secondary mb-1">
                    <Users className="h-4 w-4" />
                    <span className="text-sm font-semibold">Following</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Updates from your network</p>
                </Card>
              </div>
            </div>
          )}
          
          <Tabs defaultValue="posts" className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="posts">Posts</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="posts" className="space-y-4 mt-4 md:mt-6">
              {postsLoading ? (
                <>
                  <PostCardSkeleton />
                  <PostCardSkeleton />
                  <PostCardSkeleton />
                </>
              ) : posts.length === 0 ? (
                <Card className="p-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No posts yet. Be the first to share!</p>
                </Card>
              ) : (
                posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onLike={toggleLike}
                    onDelete={refetchPosts}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="activity" className="mt-4 md:mt-6">
              <ActivityFeed />
            </TabsContent>
          </Tabs>
        </main>
      </PullToRefresh>
    </MobileLayout>
  );
};

export default Feed;
