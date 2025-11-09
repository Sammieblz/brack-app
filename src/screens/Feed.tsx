import { Navbar } from "@/components/Navbar";
import { ActivityFeed } from "@/components/social/ActivityFeed";
import { CreatePostDialog } from "@/components/social/CreatePostDialog";
import { PostCard } from "@/components/social/PostCard";
import { useSocialFeed } from "@/hooks/useSocialFeed";
import { usePosts } from "@/hooks/usePosts";
import { Activity, TrendingUp, Users, BookOpen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LoadingSpinner from "@/components/LoadingSpinner";
import { PostCardSkeleton } from "@/components/skeletons/PostCardSkeleton";
import { PullToRefresh } from "@/components/PullToRefresh";

const Feed = () => {
  const { refetchFeed } = useSocialFeed();
  const { posts, loading: postsLoading, refetchPosts, toggleLike } = usePosts();

  const handleRefresh = async () => {
    await Promise.all([
      refetchFeed(),
      refetchPosts(),
    ]);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <PullToRefresh onRefresh={handleRefresh}>
        <main className="container max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                <Activity className="h-5 w-5 sm:h-7 sm:w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-xl sm:text-3xl font-bold text-foreground bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  Activity Feed
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 flex items-center gap-2">
                  <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                  See what your reading community is up to
                </p>
              </div>
            </div>
            <CreatePostDialog onPostCreated={() => {
              refetchFeed();
              refetchPosts();
            }} />
          </div>
          
          <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-4 sm:mt-6">
            <div className="p-3 sm:p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 hover-scale">
              <div className="flex items-center gap-1.5 sm:gap-2 text-primary mb-0.5 sm:mb-1">
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-semibold">Trending</span>
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Most active readers today</p>
            </div>
            <div className="p-3 sm:p-4 rounded-lg bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/20 hover-scale">
              <div className="flex items-center gap-1.5 sm:gap-2 text-secondary mb-0.5 sm:mb-1">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-semibold">Following</span>
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Updates from your network</p>
            </div>
          </div>
        </div>
        
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="w-full grid grid-cols-2 h-11">
            <TabsTrigger value="posts" className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base touch-manipulation">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Posts</span>
              <span className="sm:hidden">Posts</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base touch-manipulation">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Activity</span>
              <span className="sm:hidden">Activity</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="space-y-3 sm:space-y-4 mt-4 sm:mt-6">
            {postsLoading ? (
              <>
                <PostCardSkeleton />
                <PostCardSkeleton />
                <PostCardSkeleton />
                <PostCardSkeleton />
              </>
            ) : posts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No posts yet. Be the first to share!</p>
              </div>
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

          <TabsContent value="activity" className="mt-4 sm:mt-6">
            <ActivityFeed />
          </TabsContent>
        </Tabs>
        </main>
      </PullToRefresh>
    </div>
  );
};

export default Feed;
