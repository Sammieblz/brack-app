import { Navbar } from "@/components/Navbar";
import { ActivityFeed } from "@/components/social/ActivityFeed";
import { CreatePostDialog } from "@/components/social/CreatePostDialog";
import { useSocialFeed } from "@/hooks/useSocialFeed";
import { Activity, TrendingUp, Users } from "lucide-react";

const Feed = () => {
  const { refetchFeed } = useSocialFeed();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                <Activity className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  Activity Feed
                </h1>
                <p className="text-muted-foreground mt-1 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  See what your reading community is up to
                </p>
              </div>
            </div>
            <CreatePostDialog onPostCreated={refetchFeed} />
          </div>
          
          <div className="flex gap-3 mt-6">
            <div className="flex-1 p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 hover-scale">
              <div className="flex items-center gap-2 text-primary mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-semibold">Trending</span>
              </div>
              <p className="text-xs text-muted-foreground">Most active readers today</p>
            </div>
            <div className="flex-1 p-4 rounded-lg bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/20 hover-scale">
              <div className="flex items-center gap-2 text-secondary mb-1">
                <Users className="h-4 w-4" />
                <span className="text-sm font-semibold">Following</span>
              </div>
              <p className="text-xs text-muted-foreground">Updates from your network</p>
            </div>
          </div>
        </div>
        
        <ActivityFeed />
      </main>
    </div>
  );
};

export default Feed;
