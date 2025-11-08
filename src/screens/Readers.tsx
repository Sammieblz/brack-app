import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserSearch, type UserSearchResult } from "@/hooks/useUserSearch";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Search, BookOpen, Flame, MapPin, Users, Sparkles, TrendingUp } from "lucide-react";
import { FollowButton } from "@/components/social/FollowButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function Readers() {
  const [searchQuery, setSearchQuery] = useState("");
  const { results, loading } = useUserSearch(searchQuery);
  const navigate = useNavigate();

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
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user.avatar_url || ""} />
            <AvatarFallback>{getInitials(user.display_name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-lg truncate">
                    {user.display_name || "Anonymous Reader"}
                  </h3>
                  {user.recommendation_reason && (
                    <Badge variant="secondary" className="text-xs">
                      {user.recommendation_reason}
                    </Badge>
                  )}
                </div>
                {user.bio && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {user.bio}
                  </p>
                )}
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <FollowButton userId={user.id} size="sm" />
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mt-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                <span>{user.books_read_count} books</span>
              </div>
              {user.current_streak > 0 && (
                <div className="flex items-center gap-1">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <span>{user.current_streak} day streak</span>
                </div>
              )}
              {user.distance_km !== undefined && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{Math.round(user.distance_km)}km away</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Discover Readers</h1>
          <p className="text-muted-foreground">
            Connect with book lovers based on location, reading taste, and social connections
          </p>
        </div>

        <div className="relative mb-6">
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
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                All
              </TabsTrigger>
              <TabsTrigger value="nearby" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Nearby
              </TabsTrigger>
              <TabsTrigger value="social" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Connections
              </TabsTrigger>
              <TabsTrigger value="taste" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Similar Taste
              </TabsTrigger>
              <TabsTrigger value="active" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Active
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4 mt-6">
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

            <TabsContent value="nearby" className="space-y-4 mt-6">
              {results.nearby.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No nearby readers found</p>
                    <p className="text-sm mt-1">
                      Add your location in profile settings to see readers near you
                    </p>
                  </CardContent>
                </Card>
              ) : (
                results.nearby.map(renderUserCard)
              )}
            </TabsContent>

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

            <TabsContent value="active" className="space-y-4 mt-6">
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
      </main>
    </div>
  );
}
