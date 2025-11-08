import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookClub } from "@/hooks/useBookClubs";
import { Users, Lock, BookOpen, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BookClubCardProps {
  club: BookClub;
  onJoin?: (clubId: string) => void;
  onLeave?: (clubId: string) => void;
}

export const BookClubCard = ({ club, onJoin, onLeave }: BookClubCardProps) => {
  const navigate = useNavigate();

  const isMember = club.user_role !== null && club.user_role !== undefined;
  const isAdmin = club.user_role === 'admin';

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/30 bg-gradient-to-br from-card to-card/50 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 
                className="text-lg font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
                onClick={() => navigate(`/clubs/${club.id}`)}
              >
                {club.name}
              </h3>
              {club.is_private && (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
              {isAdmin && (
                <Badge variant="secondary" className="text-xs">
                  <Crown className="h-3 w-3 mr-1" />
                  Admin
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {club.description || 'No description'}
            </p>
          </div>
          {club.cover_image_url && (
            <img
              src={club.cover_image_url}
              alt={club.name}
              className="w-16 h-16 object-cover rounded-lg shadow-sm"
            />
          )}
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{club.member_count || 0} members</span>
          </div>
        </div>

        {club.current_book && (
          <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border/40">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground">
                Currently Reading
              </span>
            </div>
            <div className="flex gap-3 mt-2">
              {club.current_book.cover_url && (
                <img
                  src={club.current_book.cover_url}
                  alt={club.current_book.title}
                  className="w-12 h-16 object-cover rounded shadow-sm"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {club.current_book.title}
                </p>
                {club.current_book.author && (
                  <p className="text-xs text-muted-foreground truncate">
                    by {club.current_book.author}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-3 border-t border-border/50">
        <div className="flex gap-2 w-full">
          <Button
            variant="default"
            size="sm"
            className="flex-1 hover-scale"
            onClick={() => navigate(`/clubs/${club.id}`)}
          >
            View Club
          </Button>
          {!isMember && onJoin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onJoin(club.id)}
              className="hover-scale"
            >
              Join
            </Button>
          )}
          {isMember && !isAdmin && onLeave && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onLeave(club.id)}
              className="hover-scale text-destructive"
            >
              Leave
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};
