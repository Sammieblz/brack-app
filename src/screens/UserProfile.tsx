import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useFollowing } from "@/hooks/useFollowing";
import { useAuth } from "@/hooks/useAuth";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LoadingSpinner from "@/components/LoadingSpinner";
import { FollowButton } from "@/components/social/FollowButton";
import { PostCard } from "@/components/social/PostCard";
import { BookCardSkeleton } from "@/components/skeletons/BookCardSkeleton";
import { PostCardSkeleton } from "@/components/skeletons/PostCardSkeleton";
import { StatCardSkeleton } from "@/components/skeletons/StatCardSkeleton";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeable } from "react-swipeable";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import {
  BookOpen,
  BookMarked,
  Award,
  Flame,
  Calendar,
  Users,
  Settings,
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
  const [activeTab, setActiveTab] = useState("books");
  const isMobile = useIsMobile();
  const { triggerHaptic } = useHapticFeedback();

  const isOwnProfile = currentUser?.id === userId;

  // Swipe gestures for tab navigation
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (activeTab === "books") {
        setActiveTab("posts");
        triggerHaptic("selection");
      } else if (activeTab === "posts") {
        setActiveTab("clubs");
        triggerHaptic("selection");
      }
    },
    onSwipedRight: () => {
      if (activeTab === "clubs") {
        setActiveTab("posts");
        triggerHaptic("selection");
      } else if (activeTab === "posts") {
        setActiveTab("books");
        triggerHaptic("selection");
      }
    },
    trackMouse: false,
    preventScrollOnSwipe: false,
  });

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
      <MobileLayout>
        <MobileHeader title="Profile" showBack />
        <div className="container mx-auto px-4 py-6 space-y-6 animate-fade-in">
          {/* Avatar and Name Skeleton */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="h-32 w-32 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-4 w-full">
                  <div className="h-8 w-48 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-full bg-muted animate-pulse rounded" />
                  <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                  <div className="flex gap-4">
                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Stats Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (error || !profile) {
    return (
      <MobileLayout>
        <MobileHeader title="Profile" showBack />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <h2 className="text-2xl font-bold mb-2">Profile Not Found</h2>
              <p className="text-muted-foreground mb-4">
                {error || "This profile doesn't exist or is private"}
              </p>
              <Button onClick={() => navigate(-1)}>
                Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </MobileLayout>
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
    <MobileLayout>
      <MobileHeader 
        title={profile.display_name || "Profile"} 
        showBack 
      />
      <div className="container mx-auto px-4 py-6 max-w-5xl space-y-6 animate-fade-in">
        {/* Profile Header */}
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <Avatar className="h-24 w-24 sm:h-32 sm:w-32 shrink-0">
                <AvatarImage
                  src={profile.avatar_url || undefined}
                  alt={profile.display_name || "User"}
                />
                <AvatarFallback className="text-2xl sm:text-3xl">
                  {getInitials(profile.display_name)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-4 w-full">
                <div className="space-y-3">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                      {profile.display_name || "Anonymous User"}
                    </h1>
                    {profile.bio && (
                      <p className="text-muted-foreground text-sm sm:text-base">{profile.bio}</p>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {isOwnProfile ? (
                      <Button onClick={() => {
                        triggerHaptic("light");
                        navigate("/profile");
                      }}>
                        <Settings className="mr-2 h-4 w-4" />
                        Edit Profile
                      </Button>
                    ) : (
                      <>
                        <FollowButton userId={userId!} />
                        <Button
                          variant="outline"
                          onClick={() => {
                            triggerHaptic("light");
                            navigate("/messages", { state: { startConversationWith: userId } });
                          }}
                        >
                          <MessageCircle className="mr-2 h-4 w-4" />
                          {isMobile ? "" : "Message"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Stats Row */}
                <div className="flex flex-wrap gap-4 sm:gap-6 text-sm">
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
                  {!isMobile && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        Joined {format(new Date(profile.created_at), "MMM yyyy")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {profile.profile_visibility === "public"
                      ? "Public"
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="hover-scale cursor-pointer active:scale-95 transition-transform">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">Total Books</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{stats.totalBooks}</div>
            </CardContent>
          </Card>

          <Card className="hover-scale cursor-pointer active:scale-95 transition-transform">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
                <BookMarked className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">Books Read</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{stats.booksRead}</div>
            </CardContent>
          </Card>

          <Card className="hover-scale cursor-pointer active:scale-95 transition-transform">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
                <Flame className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">Streak</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{profile.current_streak}</div>
              <span className="text-xs text-muted-foreground">days</span>
            </CardContent>
          </Card>

          <Card className="hover-scale cursor-pointer active:scale-95 transition-transform">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
                <Award className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">Badges</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{stats.badges}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for detailed content */}
        <Tabs value={activeTab} onValueChange={(val) => {
          setActiveTab(val);
          triggerHaptic("selection");
        }} className="w-full">
          <TabsList className="grid w-full grid-cols-3 sticky top-0 z-10 bg-background">
            <TabsTrigger value="books" className="text-xs sm:text-sm">
              {isMobile ? <BookOpen className="h-4 w-4" /> : <><BookOpen className="h-4 w-4 mr-2" />Books</>}
            </TabsTrigger>
            <TabsTrigger value="posts" className="text-xs sm:text-sm">
              {isMobile ? <MessageCircle className="h-4 w-4" /> : <><MessageCircle className="h-4 w-4 mr-2" />Posts</>}
            </TabsTrigger>
            <TabsTrigger value="clubs" className="text-xs sm:text-sm">
              {isMobile ? <BookUser className="h-4 w-4" /> : <><BookUser className="h-4 w-4 mr-2" />Clubs</>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="books" className="space-y-4 mt-6 animate-fade-in" {...swipeHandlers}>
            {dataLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {[...Array(6)].map((_, i) => (
                  <BookCardSkeleton key={i} />
                ))}
              </div>
            ) : userBooks.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p>No books yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {userBooks.map((book) => (
                  <Card
                    key={book.id}
                    className="cursor-pointer hover-scale active:scale-95 transition-transform touch-manipulation"
                    onClick={() => {
                      triggerHaptic("light");
                      navigate(`/book/${book.id}`);
                    }}
                  >
                    <CardContent className="p-3">
                      {book.cover_url && (
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="w-full aspect-[2/3] object-cover rounded-md mb-2"
                          loading="lazy"
                        />
                      )}
                      <p className="font-semibold text-sm line-clamp-2">{book.title}</p>
                      {book.author && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{book.author}</p>
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

          <TabsContent value="posts" className="space-y-4 mt-6 animate-fade-in" {...swipeHandlers}>
            {dataLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <PostCardSkeleton key={i} />
                ))}
              </div>
            ) : userPosts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p>No posts yet</p>
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

          <TabsContent value="clubs" className="space-y-4 mt-6 animate-fade-in" {...swipeHandlers}>
            {dataLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : userClubs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <BookUser className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p>Not a member of any book clubs yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userClubs.map((club: any) => (
                  <Card
                    key={club.id}
                    className="cursor-pointer hover-scale active:scale-95 transition-transform touch-manipulation"
                    onClick={() => {
                      triggerHaptic("light");
                      navigate(`/book-clubs/${club.id}`);
                    }}
                  >
                    <CardContent className="p-4">
                      {club.cover_image_url && (
                        <img
                          src={club.cover_image_url}
                          alt={club.name}
                          className="w-full h-32 object-cover rounded-md mb-3"
                          loading="lazy"
                        />
                      )}
                      <h3 className="font-bold text-lg mb-2 line-clamp-1">{club.name}</h3>
                      {club.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {club.description}
                        </p>
                      )}
                      <div className="flex gap-2 mt-3">
                        <Badge variant={club.is_private ? "secondary" : "default"} className="text-xs">
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
    </MobileLayout>
  );
};

export default UserProfile;
