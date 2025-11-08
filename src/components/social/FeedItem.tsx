import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Book, Star, UserPlus, List, Award, BookOpen } from "lucide-react";
import { FeedActivity } from "@/hooks/useSocialFeed";
import { useNavigate } from "react-router-dom";

interface FeedItemProps {
  activity: FeedActivity;
  formatTimeAgo: (timestamp: string) => string;
}

export const FeedItem = ({ activity, formatTimeAgo }: FeedItemProps) => {
  const navigate = useNavigate();

  const getActivityIcon = () => {
    switch (activity.activity_type) {
      case 'book_started':
        return <BookOpen className="h-5 w-5 text-primary" />;
      case 'book_completed':
        return <Book className="h-5 w-5 text-success" />;
      case 'book_reviewed':
        return <Star className="h-5 w-5 text-warning" />;
      case 'followed_user':
        return <UserPlus className="h-5 w-5 text-info" />;
      case 'created_list':
        return <List className="h-5 w-5 text-secondary" />;
      case 'earned_badge':
        return <Award className="h-5 w-5 text-accent" />;
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
            <span className="font-semibold">{userName}</span> started reading{' '}
            {activity.book && (
              <span 
                className="font-semibold text-primary cursor-pointer hover:underline"
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
            <span className="font-semibold">{userName}</span> finished reading{' '}
            {activity.book && (
              <span 
                className="font-semibold text-primary cursor-pointer hover:underline"
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
            <span className="font-semibold">{userName}</span> reviewed{' '}
            {activity.book && (
              <span 
                className="font-semibold text-primary cursor-pointer hover:underline"
                onClick={() => navigate(`/book/${activity.book_id}`)}
              >
                {activity.book.title}
              </span>
            )}
            {activity.metadata?.rating && (
              <Badge variant="secondary" className="ml-2">
                {activity.metadata.rating} ⭐
              </Badge>
            )}
          </>
        );
      case 'followed_user':
        return (
          <>
            <span className="font-semibold">{userName}</span> started following{' '}
            <span className="font-semibold">{activity.metadata?.followed_user_name || 'someone'}</span>
          </>
        );
      case 'created_list':
        return (
          <>
            <span className="font-semibold">{userName}</span> created a new list:{' '}
            <span className="font-semibold">{activity.metadata?.list_name}</span>
          </>
        );
      case 'earned_badge':
        return (
          <>
            <span className="font-semibold">{userName}</span> earned the badge:{' '}
            <span className="font-semibold">{activity.metadata?.badge_title}</span>
          </>
        );
      default:
        return <span className="font-semibold">{userName}</span>;
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
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <Avatar 
              className="cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate(`/profile/${activity.user_id}`)}
            >
              <AvatarImage src={activity.user?.avatar_url} />
              <AvatarFallback>
                {activity.user?.display_name ? getInitials(activity.user.display_name) : 'U'}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-2">
              {getActivityIcon()}
              <p className="text-sm text-foreground flex-1">
                {getActivityMessage()}
              </p>
            </div>

            {activity.book?.cover_url && (
              <div 
                className="mt-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate(`/book/${activity.book_id}`)}
              >
                <img
                  src={activity.book.cover_url}
                  alt={activity.book.title}
                  className="w-20 h-28 object-cover rounded shadow-sm"
                />
              </div>
            )}

            <p className="text-xs text-muted-foreground mt-2">
              {formatTimeAgo(activity.created_at)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
