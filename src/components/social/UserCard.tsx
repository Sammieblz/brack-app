import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FollowButton } from "./FollowButton";
import { useNavigate } from "react-router-dom";
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
    <Card className="hover:shadow-lg transition-shadow cursor-pointer">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <Avatar
            className="h-16 w-16 cursor-pointer"
            onClick={() => navigate(`/users/${userId}`)}
          >
            <AvatarImage src={avatarUrl || undefined} alt={displayName || "User"} />
            <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <h3
                  className="font-semibold text-lg cursor-pointer hover:underline"
                  onClick={() => navigate(`/users/${userId}`)}
                >
                  {displayName || "Anonymous User"}
                </h3>
                {bio && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{bio}</p>
                )}
              </div>
              <FollowButton userId={userId} size="sm" />
            </div>

            <div className="flex gap-4 text-sm">
              {booksRead > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <BookOpen className="h-4 w-4" />
                  <span>{booksRead} books</span>
                </div>
              )}
              {currentStreak > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Flame className="h-4 w-4" />
                  <span>{currentStreak} day streak</span>
                </div>
              )}
              {badges > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Award className="h-4 w-4" />
                  <span>{badges} badges</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
