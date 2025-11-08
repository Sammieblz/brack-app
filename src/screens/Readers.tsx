import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserSearch } from "@/hooks/useUserSearch";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Search, BookOpen, Flame } from "lucide-react";
import { FollowButton } from "@/components/social/FollowButton";

export default function Readers() {
  const [searchQuery, setSearchQuery] = useState("");
  const { users, loading } = useUserSearch(searchQuery);
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Discover Readers</h1>
          <p className="text-muted-foreground">
            Connect with other book lovers in the community
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
          <div className="space-y-4">
            {users.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {searchQuery
                    ? "No readers found matching your search"
                    : "No readers to display"}
                </CardContent>
              </Card>
            ) : (
              users.map((user) => (
                <Card
                  key={user.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/profile/${user.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={user.avatar_url || ""} />
                        <AvatarFallback>
                          {getInitials(user.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg truncate">
                              {user.display_name || "Anonymous Reader"}
                            </h3>
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
                        <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <BookOpen className="h-4 w-4" />
                            <span>{user.books_read_count || 0} books read</span>
                          </div>
                          {user.current_streak > 0 && (
                            <div className="flex items-center gap-1">
                              <Flame className="h-4 w-4 text-orange-500" />
                              <span>{user.current_streak} day streak</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
