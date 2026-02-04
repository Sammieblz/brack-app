import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserSearch, type UserSearchResult } from "@/hooks/useUserSearch";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Search, BookOpen, Flame, MapPin, Users, Sparkles, TrendingUp, BookMarked } from "lucide-react";
import { FollowButton } from "@/components/social/FollowButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBookClubs } from "@/hooks/useBookClubs";
import { BookClubCard } from "@/components/clubs/BookClubCard";
import { CreateClubDialog } from "@/components/clubs/CreateClubDialog";
import { useSwipeable } from "react-swipeable";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { PullToRefresh } from "@/components/PullToRefresh";

export default function Readers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("readers");
  const { results, loading } = useUserSearch(searchQuery);
  const { clubs, loading: clubsLoading, createClub, joinClub, leaveClub } = useBookClubs();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { triggerHaptic } = useHapticFeedback();

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (activeTab === "readers") {
        setActiveTab("clubs");
        triggerHaptic("selection");
      }
    },
    onSwipedRight: () => {
      if (activeTab === "clubs") {
        setActiveTab("readers");
        triggerHaptic("selection");
      }
    },
    trackMouse: false,
    preventScrollOnSwipe: false,
  });

  const myClubs = clubs.filter(club => club.user_role);
  const publicClubs = clubs.filter(club => !club.is_private && !club.user_role);

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const renderUserCard = (user: UserSearchResult) => (
    <Card
      key={user.id}
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => navigate(`/users/${user.id}`)}
    >
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start gap-3 md:gap-4">
          <Avatar className="h-12 w-12 md:h-16 md:w-16 flex-shrink-0">
            <AvatarImage src={user.avatar_url || ""} />
            <AvatarFallback>{getInitials(user.display_name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 md:gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-sm md:text-lg truncate">
                    {user.display_name || "Anonymous Reader"}
                  </h3>
                  {user.recommendation_reason && (
                    <Badge variant="secondary" className="text-xs">
                      {user.recommendation_reason}
                    </Badge>
                  )}
                </div>
                {user.bio && (
                  <p className="text-xs md:text-sm text-muted-foreground line-clamp-2 mt-1">
                    {user.bio}
                  </p>
                )}
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <FollowButton userId={user.id} size="sm" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 md:gap-3 mt-2 md:mt-3 text-xs md:text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <BookOpen className="h-3 w-3 md:h-4 md:w-4" />
                <span>{user.books_read_count} books</span>
              </div>
              {user.current_streak > 0 && (
                <div className="flex items-center gap-1">
                  <Flame className="h-3 w-3 md:h-4 md:w-4 text-orange-500" />
                  <span>{user.current_streak} day streak</span>
                </div>
              )}
              {user.distance_km !== undefined && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 md:h-4 md:w-4" />
                  <span>{Math.round(user.distance_km)}km away</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const handleRefresh = async () => {
    // Trigger refetch - the useUserSearch hook will refetch on searchQuery change
    // For now, we'll just trigger a re-render by updating search query
    const currentQuery = searchQuery;
    setSearchQuery('');
    setTimeout(() => setSearchQuery(currentQuery), 100);
  };

  return (
    <MobileLayout>
      {isMobile && <MobileHeader title="Discover" />}
      
      <PullToRefresh onRefresh={handleRefresh}>
      <main className="container mx-auto px-4 py-4 md:py-8 max-w-6xl">
        {!isMobile && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Discover</h1>
            <p className="text-muted-foreground">
              Connect with book lovers and join reading communities
            </p>
          </div>
        )}

        {/* Main Tabs: Readers vs Book Clubs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-4">
          <TabsList className="grid w-full max-w-md grid-cols-2" onClick={() => triggerHaptic("selection")}>
            <TabsTrigger value="readers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Readers
            </TabsTrigger>
            <TabsTrigger value="clubs" className="flex items-center gap-2">
              <BookMarked className="h-4 w-4" />
              Book Clubs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="readers" className="space-y-4 mt-4" {...swipeHandlers}>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search readers by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {loading ? (
              <LoadingSpinner />
            ) : (
              <Tabs defaultValue="all" className="w-full">
            <TabsList className={`grid w-full ${isMobile ? 'grid-cols-3' : 'grid-cols-5'}`}>
              <TabsTrigger value="all" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                <Sparkles className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">All</span>
              </TabsTrigger>
              <TabsTrigger value="nearby" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                <MapPin className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Nearby</span>
              </TabsTrigger>
              {!isMobile && (
                <>
                  <TabsTrigger value="social" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Connections
                  </TabsTrigger>
                  <TabsTrigger value="taste" className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Similar Taste
                  </TabsTrigger>
                </>
              )}
              <TabsTrigger value="active" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                <TrendingUp className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Active</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-3 md:space-y-4 mt-4 md:mt-6">
              {results.all.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    {searchQuery
                      ? "No readers found matching your search"
                      : "No readers to display"}
                  </CardContent>
                </Card>
              ) : (
                results.all.map(renderUserCard)
              )}
            </TabsContent>

            <TabsContent value="nearby" className="space-y-3 md:space-y-4 mt-4 md:mt-6">
              {results.nearby.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No nearby readers found</p>
                    <p className="text-xs md:text-sm mt-1">
                      Add your location in profile settings to see readers near you
                    </p>
                  </CardContent>
                </Card>
              ) : (
                results.nearby.map(renderUserCard)
              )}
            </TabsContent>

            {!isMobile && (
              <>
                <TabsContent value="social" className="space-y-4 mt-6">
                  {results.socialConnections.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No mutual connections found</p>
                        <p className="text-sm mt-1">
                          Follow more readers to discover mutual connections
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    results.socialConnections.map(renderUserCard)
                  )}
                </TabsContent>

                <TabsContent value="taste" className="space-y-4 mt-6">
                  {results.similarTaste.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No readers with similar taste found</p>
                        <p className="text-sm mt-1">
                          Add more books to get better recommendations
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    results.similarTaste.map(renderUserCard)
                  )}
                </TabsContent>
              </>
            )}

            <TabsContent value="active" className="space-y-3 md:space-y-4 mt-4 md:mt-6">
              {results.activeReaders.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No active readers found</p>
                  </CardContent>
                </Card>
              ) : (
                results.activeReaders.map(renderUserCard)
              )}
            </TabsContent>
              </Tabs>
            )}
          </TabsContent>

          <TabsContent value="clubs" className="space-y-4 mt-4" {...swipeHandlers}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {isMobile ? 'Join reading communities' : 'Join reading communities and discuss books together'}
              </p>
              <CreateClubDialog onCreateClub={createClub} />
            </div>

            {clubsLoading ? (
              <LoadingSpinner />
            ) : (
              <Tabs defaultValue="my-clubs" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="my-clubs" className="flex items-center gap-2 text-xs sm:text-sm">
                    <BookMarked className="h-3 w-3 sm:h-4 sm:w-4" />
                    My Clubs ({myClubs.length})
                  </TabsTrigger>
                  <TabsTrigger value="discover" className="flex items-center gap-2 text-xs sm:text-sm">
                    <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                    Discover ({publicClubs.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="my-clubs" className="space-y-3 sm:space-y-4 mt-4">
                  {myClubs.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <div className="p-4 rounded-full bg-primary/20 w-fit mx-auto mb-4">
                          <Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                        </div>
                        <h3 className="font-semibold mb-2">No clubs yet</h3>
                        <p className="text-sm text-muted-foreground">
                          Create your first book club or join existing ones!
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {myClubs.map((club) => (
                        <BookClubCard
                          key={club.id}
                          club={club}
                          onLeave={leaveClub}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="discover" className="space-y-3 sm:space-y-4 mt-4">
                  {publicClubs.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <div className="p-4 rounded-full bg-secondary/20 w-fit mx-auto mb-4">
                          <Users className="h-6 w-6 sm:h-8 sm:w-8 text-secondary" />
                        </div>
                        <h3 className="font-semibold mb-2">No public clubs</h3>
                        <p className="text-sm text-muted-foreground">
                          Be the first to create a public book club!
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {publicClubs.map((club) => (
                        <BookClubCard
                          key={club.id}
                          club={club}
                          onJoin={joinClub}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </TabsContent>
        </Tabs>
      </main>
      </PullToRefresh>
    </MobileLayout>
  );
}
