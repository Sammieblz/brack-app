import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FollowButton } from "./FollowButton";
import { useNavigate } from "react-router-dom";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { Book, Trophy, FireFlame } from "iconoir-react";

interface UserCardProps {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  booksRead?: number;
  currentStreak?: number;
  badges?: number;
}

export const UserCard = ({
  userId,
  displayName,
  avatarUrl,
  bio,
  booksRead = 0,
  currentStreak = 0,
  badges = 0,
}: UserCardProps) => {
  const navigate = useNavigate();
  const { triggerHaptic } = useHapticFeedback();

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleNavigate = () => {
    triggerHaptic("light");
    navigate(`/users/${userId}`);
  };

  return (
    <Card className="hover:shadow-lg transition-all cursor-pointer active:scale-98 touch-manipulation">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <Avatar
            className="h-14 w-14 sm:h-16 sm:w-16 cursor-pointer shrink-0"
            onClick={handleNavigate}
          >
            <AvatarImage src={avatarUrl || undefined} alt={displayName || "User"} />
            <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3
                  className="font-sans font-semibold text-base sm:text-lg cursor-pointer hover:underline line-clamp-1"
                  onClick={handleNavigate}
                >
                  {displayName || "Anonymous User"}
                </h3>
                {bio && (
                  <p className="font-sans text-xs sm:text-sm text-muted-foreground line-clamp-2 mt-1">{bio}</p>
                )}
              </div>
              <FollowButton userId={userId} size="sm" />
            </div>

            <div className="font-sans flex flex-wrap gap-2">
              {booksRead > 0 && (
                <Badge variant="secondary" className="flex items-center gap-1.5">
                  <Book className="h-3 w-3" />
                  <span>{booksRead}</span>
                </Badge>
              )}
              {currentStreak > 0 && (
                <Badge variant="secondary" className="flex items-center gap-1.5">
                  <FireFlame className="h-3 w-3" />
                  <span>{currentStreak}d</span>
                </Badge>
              )}
              {badges > 0 && (
                <Badge variant="secondary" className="flex items-center gap-1.5">
                  <Trophy className="h-3 w-3" />
                  <span>{badges}</span>
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
