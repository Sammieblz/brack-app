import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useFollowing } from "@/hooks/useFollowing";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LoadingSpinner from "@/components/LoadingSpinner";
import { FollowButton } from "@/components/social/FollowButton";
import { PostCard } from "@/components/social/PostCard";
import { supabase } from "@/integrations/supabase/client";
import {
  BookOpen,
  BookMarked,
  Award,
  Flame,
  Calendar,
  Users,
  Settings,
  ArrowLeft,
  MessageCircle,
  BookUser,
} from "lucide-react";
import { format } from "date-fns";

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { profile, stats, loading, error } = useUserProfile(userId || null);
  const { followersCount, followingCount } = useFollowing(userId || null);
  const [userBooks, setUserBooks] = useState<any[]>([]);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [userClubs, setUserClubs] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const isOwnProfile = currentUser?.id === userId;

  useEffect(() => {
    const fetchUserData = async () => {
      if (!userId) return;

      try {
        setDataLoading(true);

        // Fetch user's books
        const { data: books } = await supabase
          .from("books")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(10);

        setUserBooks(books || []);

        // Fetch user's posts
        const { data: posts } = await supabase
          .from("posts")
          .select(`
            *,
            profiles:user_id (
              id,
              display_name,
              avatar_url
            ),
            books:book_id (
              id,
              title,
              author,
              cover_url
            )
          `)
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(10);

        setUserPosts(posts || []);

        // Fetch user's book clubs
        const { data: clubs } = await supabase
          .from("book_club_members")
          .select(`
            book_clubs (
              id,
              name,
              description,
              cover_image_url,
              is_private
            )
          `)
          .eq("user_id", userId);

        setUserClubs(clubs?.map(c => c.book_clubs).filter(Boolean) || []);
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setDataLoading(false);
      }
    };

    fetchUserData();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="User Profile" />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="User Profile" />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <h2 className="text-2xl font-bold mb-2">Profile Not Found</h2>
              <p className="text-muted-foreground mb-4">
                {error || "This profile doesn't exist or is private"}
              </p>
              <Button onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title={profile.display_name || "User Profile"} />
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {/* Profile Header */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <Avatar className="h-32 w-32">
                <AvatarImage
                  src={profile.avatar_url || undefined}
                  alt={profile.display_name || "User"}
                />
                <AvatarFallback className="text-3xl">
                  {getInitials(profile.display_name)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-4">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <h1 className="text-3xl font-bold mb-2">
                      {profile.display_name || "Anonymous User"}
                    </h1>
                    {profile.bio && (
                      <p className="text-muted-foreground">{profile.bio}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {isOwnProfile ? (
                      <Button onClick={() => navigate("/profile")}>
                        <Settings className="mr-2 h-4 w-4" />
                        Edit Profile
                      </Button>
                    ) : (
                      <>
                        <FollowButton userId={userId!} />
                        <Button
                          variant="outline"
                          onClick={() => navigate("/messages", { state: { startConversationWith: userId } })}
                        >
                          <MessageCircle className="mr-2 h-4 w-4" />
                          Message
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>
                      <strong>{followersCount}</strong> Followers
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>
                      <strong>{followingCount}</strong> Following
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Joined {format(new Date(profile.created_at), "MMMM yyyy")}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Badge variant="secondary">
                    {profile.profile_visibility === "public"
                      ? "Public Profile"
                      : profile.profile_visibility === "followers"
                      ? "Followers Only"
                      : "Private"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                Total Books
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBooks}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookMarked className="h-4 w-4 text-primary" />
                Books Read
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.booksRead}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Flame className="h-4 w-4 text-primary" />
                Current Streak
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{profile.current_streak} days</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" />
                Badges Earned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.badges}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for detailed content */}
        <Tabs defaultValue="books" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="books">
              <BookOpen className="h-4 w-4 mr-2" />
              Books ({userBooks.length})
            </TabsTrigger>
            <TabsTrigger value="posts">
              <MessageCircle className="h-4 w-4 mr-2" />
              Posts ({userPosts.length})
            </TabsTrigger>
            <TabsTrigger value="clubs">
              <BookUser className="h-4 w-4 mr-2" />
              Book Clubs ({userClubs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="books" className="space-y-4 mt-6">
            {dataLoading ? (
              <LoadingSpinner />
            ) : userBooks.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No books yet
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {userBooks.map((book) => (
                  <Card
                    key={book.id}
                    className="cursor-pointer hover-scale"
                    onClick={() => navigate(`/book/${book.id}`)}
                  >
                    <CardContent className="p-3">
                      {book.cover_url && (
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="w-full h-48 object-cover rounded-md mb-2"
                        />
                      )}
                      <p className="font-semibold text-sm truncate">{book.title}</p>
                      {book.author && (
                        <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                      )}
                      <Badge variant="secondary" className="mt-2 text-xs">
                        {book.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="posts" className="space-y-4 mt-6">
            {dataLoading ? (
              <LoadingSpinner />
            ) : userPosts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No posts yet
                </CardContent>
              </Card>
            ) : (
              userPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={{
                    ...post,
                    user: post.profiles ? {
                      id: post.profiles.id,
                      display_name: post.profiles.display_name,
                      avatar_url: post.profiles.avatar_url,
                    } : undefined,
                    book: post.books ? {
                      id: post.books.id,
                      title: post.books.title,
                      author: post.books.author,
                      cover_url: post.books.cover_url,
                    } : undefined,
                    user_has_liked: false,
                  }}
                  onLike={() => {}}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="clubs" className="space-y-4 mt-6">
            {dataLoading ? (
              <LoadingSpinner />
            ) : userClubs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Not a member of any book clubs yet
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userClubs.map((club: any) => (
                  <Card
                    key={club.id}
                    className="cursor-pointer hover-scale"
                    onClick={() => navigate(`/book-clubs/${club.id}`)}
                  >
                    <CardContent className="p-4">
                      {club.cover_image_url && (
                        <img
                          src={club.cover_image_url}
                          alt={club.name}
                          className="w-full h-32 object-cover rounded-md mb-3"
                        />
                      )}
                      <h3 className="font-bold text-lg mb-2">{club.name}</h3>
                      {club.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {club.description}
                        </p>
                      )}
                      <div className="flex gap-2 mt-3">
                        <Badge variant={club.is_private ? "secondary" : "default"}>
                          {club.is_private ? "Private" : "Public"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default UserProfile;
