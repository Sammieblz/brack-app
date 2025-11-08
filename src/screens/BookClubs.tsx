import { Navbar } from "@/components/Navbar";
import { useBookClubs } from "@/hooks/useBookClubs";
import { BookClubCard } from "@/components/clubs/BookClubCard";
import { CreateClubDialog } from "@/components/clubs/CreateClubDialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Users, BookMarked } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const BookClubs = () => {
  const { clubs, loading, createClub, joinClub, leaveClub } = useBookClubs();

  const myClubs = clubs.filter(club => club.user_role);
  const publicClubs = clubs.filter(club => !club.is_private && !club.user_role);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center items-center py-20">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                  <Users className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-3xl font-bold text-foreground bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  Book Clubs
                </h1>
              </div>
              <p className="text-muted-foreground">
                Join reading communities and discuss books together
              </p>
            </div>
            <CreateClubDialog onCreateClub={createClub} />
          </div>
        </div>

        <Tabs defaultValue="my-clubs" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="my-clubs" className="flex items-center gap-2">
              <BookMarked className="h-4 w-4" />
              My Clubs ({myClubs.length})
            </TabsTrigger>
            <TabsTrigger value="discover" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Discover ({publicClubs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-clubs" className="space-y-4">
            {myClubs.length === 0 ? (
              <div className="text-center py-16 animate-fade-in">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 max-w-md mx-auto">
                  <div className="p-4 rounded-full bg-primary/20 w-fit mx-auto mb-4">
                    <Users className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No clubs yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Create your first book club or join existing ones to start discussions!
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {myClubs.map((club, index) => (
                  <div
                    key={club.id}
                    className="animate-fade-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <BookClubCard
                      club={club}
                      onLeave={leaveClub}
                    />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="discover" className="space-y-4">
            {publicClubs.length === 0 ? (
              <div className="text-center py-16 animate-fade-in">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/20 max-w-md mx-auto">
                  <div className="p-4 rounded-full bg-secondary/20 w-fit mx-auto mb-4">
                    <Users className="h-8 w-8 text-secondary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No public clubs</h3>
                  <p className="text-muted-foreground">
                    Be the first to create a public book club!
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {publicClubs.map((club, index) => (
                  <div
                    key={club.id}
                    className="animate-fade-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <BookClubCard
                      club={club}
                      onJoin={joinClub}
                    />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default BookClubs;
