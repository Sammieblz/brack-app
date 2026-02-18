import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useReviews } from "@/hooks/useReviews";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Heart, ChatBubble, Star, Eye, EyeClosed, Menu, Trash, EditPencil, ShareIos } from "iconoir-react";
import { shareService } from "@/services/shareService";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sanitizeText } from "@/utils/sanitize";

interface ReviewCardProps {
  review: {
    id: string;
    user_id: string;
    book_id: string;
    rating: number;
    title: string | null;
    content: string;
    is_spoiler: boolean;
    likes_count: number;
    comments_count: number;
    created_at: string;
    profiles: {
      display_name: string | null;
      avatar_url: string | null;
    };
  };
  showBookInfo?: boolean;
  onEdit?: () => void;
}

export const ReviewCard = ({ review, showBookInfo = false, onEdit }: ReviewCardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { likeReview, unlikeReview, checkUserLiked, deleteReview } = useReviews();
  const [showSpoiler, setShowSpoiler] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

  const isOwnReview = user?.id === review.user_id;

  useEffect(() => {
    const checkLiked = async () => {
      const liked = await checkUserLiked(review.id);
      setIsLiked(liked);
    };
    checkLiked();
  }, [review.id]);

  const handleLike = async () => {
    if (isLiked) {
      await unlikeReview(review.id);
      setIsLiked(false);
    } else {
      await likeReview(review.id);
      setIsLiked(true);
    }
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this review?")) {
      await deleteReview(review.id);
    }
  };

  const handleShare = async () => {
    try {
      // Fetch book info if not available
      const { data: book } = await supabase
        .from('books')
        .select('title, author')
        .eq('id', review.book_id)
        .single();

      await shareService.shareBookReview({
        title: review.title || undefined,
        content: review.content,
        rating: review.rating,
        bookTitle: book?.title || 'Unknown Book',
        bookAuthor: book?.author || undefined,
      });
    } catch (error: unknown) {
      console.error('Error sharing review:', error);
      if (error instanceof Error && !error.message?.includes('cancelled')) {
        toast.error('Failed to share review');
      }
    }
  };

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
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar
              className="cursor-pointer"
              onClick={() => navigate(`/users/${review.user_id}`)}
            >
              <AvatarImage
                src={review.profiles.avatar_url || undefined}
                alt={review.profiles.display_name || "User"}
              />
              <AvatarFallback>{getInitials(review.profiles.display_name)}</AvatarFallback>
            </Avatar>
            <div>
              <p
                className="font-sans font-semibold cursor-pointer hover:underline"
                onClick={() => navigate(`/users/${review.user_id}`)}
              >
                {review.profiles.display_name || "Anonymous User"}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < review.rating
                          ? "fill-primary text-primary"
                          : "text-muted-foreground"
                      }`}
                    />
                  ))}
                </div>
                <span className="font-sans text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>

          {isOwnReview && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <EditPencil className="mr-2 h-4 w-4" />
                    Edit Review
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <Trash className="mr-2 h-4 w-4" />
                  Delete Review
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {review.title && <h3 className="font-serif font-semibold text-lg">{sanitizeText(review.title)}</h3>}

        {review.is_spoiler && !showSpoiler ? (
          <div className="bg-muted p-4 rounded-lg text-center">
            <p className="font-sans text-sm font-medium mb-2">⚠️ This review contains spoilers</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSpoiler(true)}
            >
              <Eye className="mr-2 h-4 w-4" />
              Show Spoiler
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="font-serif text-foreground whitespace-pre-wrap">{sanitizeText(review.content)}</p>
            {review.is_spoiler && showSpoiler && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSpoiler(false)}
              >
                <EyeClosed className="mr-2 h-4 w-4" />
                Hide Spoiler
              </Button>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            className={isLiked ? "text-primary" : ""}
          >
            <Heart className={`mr-2 h-4 w-4 ${isLiked ? "fill-primary" : ""}`} />
            {review.likes_count}
          </Button>
          <Button variant="ghost" size="sm">
            <ChatBubble className="mr-2 h-4 w-4" />
            {review.comments_count}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            title="Share review"
          >
            <ShareIos className="mr-2 h-4 w-4" />
            Share
          </Button>
          {review.is_spoiler && (
            <Badge variant="secondary" className="ml-auto">
              Spoiler
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
