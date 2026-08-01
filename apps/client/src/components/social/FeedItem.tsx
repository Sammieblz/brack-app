import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Book, Star, UserPlus, List, Trophy } from "iconoir-react";
import { FeedActivity } from "@/hooks/useSocialFeed";
import { useNavigate } from "react-router-dom";

interface FeedItemProps {
  activity: FeedActivity;
  formatTimeAgo: (timestamp: string) => string;
}

export const FeedItem = ({ activity, formatTimeAgo }: FeedItemProps) => {
  const navigate = useNavigate();
  const metadataText = (key: string) => {
    const value = activity.metadata?.[key];
    return typeof value === "string" ? value : null;
  };
  const rawRating = activity.metadata?.rating;
  const rating =
    typeof rawRating === "number" || typeof rawRating === "string"
      ? String(rawRating)
      : null;
  const followedUserName = metadataText("followed_user_name");
  const listName = metadataText("list_name");
  const badgeTitle = metadataText("badge_title");
  const postContent = metadataText("content");

  const getActivityIcon = () => {
    switch (activity.activity_type) {
      case 'book_started':
        return <Book className="h-5 w-5 text-primary" />;
      case 'book_completed':
        return <Book className="h-5 w-5 text-success" />;
      case 'book_reviewed':
        return <Star className="h-5 w-5 text-warning" />;
      case 'followed_user':
        return <UserPlus className="h-5 w-5 text-info" />;
      case 'created_list':
        return <List className="h-5 w-5 text-secondary" />;
      case 'earned_badge':
        return <Trophy className="h-5 w-5 text-accent" />;
      case 'post':
        return <Book className="h-5 w-5 text-primary" />;
      default:
        return <Book className="h-5 w-5" />;
    }
  };

  const getActivityMessage = () => {
    const userName = activity.user?.display_name || 'Someone';
    
    switch (activity.activity_type) {
      case 'book_started':
        return (
          <>
            <span className="font-sans font-semibold">{userName}</span> started reading{' '}
            {activity.book && (
              <span 
                className="font-serif font-semibold text-primary cursor-pointer hover:underline"
                onClick={() => navigate(`/book/${activity.book_id}`)}
              >
                {activity.book.title}
              </span>
            )}
          </>
        );
      case 'book_completed':
        return (
          <>
            <span className="font-sans font-semibold">{userName}</span> finished reading{' '}
            {activity.book && (
              <span 
                className="font-serif font-semibold text-primary cursor-pointer hover:underline"
                onClick={() => navigate(`/book/${activity.book_id}`)}
              >
                {activity.book.title}
              </span>
            )}
          </>
        );
      case 'book_reviewed':
        return (
          <>
            <span className="font-sans font-semibold">{userName}</span> reviewed{' '}
            {activity.book && (
              <span 
                className="font-serif font-semibold text-primary cursor-pointer hover:underline"
                onClick={() => navigate(`/book/${activity.book_id}`)}
              >
                {activity.book.title}
              </span>
            )}
            {rating && (
              <Badge variant="secondary" className="ml-2">
                {rating} ★
              </Badge>
            )}
          </>
        );
      case 'followed_user':
        return (
          <>
            <span className="font-sans font-semibold">{userName}</span> started following{' '}
            <span className="font-sans font-semibold">{followedUserName || 'someone'}</span>
          </>
        );
      case 'created_list':
        return (
          <>
            <span className="font-sans font-semibold">{userName}</span> created a new list:{' '}
            <span className="font-sans font-semibold">{listName || 'Untitled list'}</span>
          </>
        );
      case 'earned_badge':
        return (
          <>
            <span className="font-sans font-semibold">{userName}</span> earned the badge:{' '}
            <span className="font-sans font-semibold">{badgeTitle || 'New badge'}</span>
          </>
        );
      case 'post':
        return (
          <>
            <span className="font-sans font-semibold">{userName}</span> shared an update
          </>
        );
      default:
        return <span className="font-sans font-semibold">{userName}</span>;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/30 bg-gradient-to-br from-card to-card/50 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <div className="relative">
              <Avatar 
                className="cursor-pointer hover:scale-110 transition-all duration-300 border-2 border-primary/20 group-hover:border-primary/40"
                onClick={() => navigate(`/users/${activity.user_id}`)}
              >
                <AvatarImage src={activity.user?.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10">
                  {activity.user?.display_name ? getInitials(activity.user.display_name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 p-1 bg-background rounded-full border border-border/50">
                {getActivityIcon()}
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-2">
              <div className="font-sans text-sm text-foreground flex-1 leading-relaxed">
                {getActivityMessage()}
              </div>
            </div>

            {activity.activity_type === 'post' && postContent && (
              <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                <p className="font-serif text-sm">{postContent}</p>
              </div>
            )}

            {activity.book?.cover_url && (
              <div 
                className="mt-4 cursor-pointer group/book hover-scale inline-block"
                onClick={() => navigate(`/book/${activity.book_id}`)}
              >
                <div className="relative overflow-hidden rounded-lg shadow-md group-hover/book:shadow-xl transition-all duration-300">
                  <img
                    src={activity.book.cover_url}
                    alt={activity.book.title}
                    className="w-24 h-32 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/book:opacity-100 transition-opacity duration-300" />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mt-3">
              <div className="h-1 w-1 rounded-full bg-muted-foreground/40" />
              <p className="font-sans text-xs text-muted-foreground">
                {formatTimeAgo(activity.created_at)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
