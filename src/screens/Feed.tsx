import { Header } from "@/components/Header";
import { ActivityFeed } from "@/components/social/ActivityFeed";

const Feed = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header title="Activity Feed" />
      <main className="container max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Activity Feed
          </h1>
          <p className="text-muted-foreground">
            See what your friends are reading
          </p>
        </div>
        
        <ActivityFeed />
      </main>
    </div>
  );
};

export default Feed;
