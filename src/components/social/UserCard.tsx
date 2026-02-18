import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FollowButton } from "./FollowButton";
import { useNavigate } from "react-router-dom";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { BookOpen, Award, Flame } from "lucide-react";

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

            <div className="font-sans flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm">
              {booksRead > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span>{booksRead}</span>
                </div>
              )}
              {currentStreak > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Flame className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span>{currentStreak}d</span>
                </div>
              )}
              {badges > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Award className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span>{badges}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
