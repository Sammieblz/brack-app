import { Button } from "@/components/ui/button";
import { useFollowing } from "@/hooks/useFollowing";
import { UserPlus, UserMinus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface FollowButtonProps {
  userId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
}

export const FollowButton = ({ userId, variant = "default", size = "default" }: FollowButtonProps) => {
  const { user } = useAuth();
  const { isFollowing, followUser, unfollowUser, loading } = useFollowing(userId);

  // Don't show follow button for own profile
  if (!user || user.id === userId) {
    return null;
  }

  const handleClick = () => {
    if (isFollowing) {
      unfollowUser();
    } else {
      followUser();
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      variant={isFollowing ? "outline" : variant}
      size={size}
    >
      {isFollowing ? (
        <>
          <UserMinus className="mr-2 h-4 w-4" />
          Unfollow
        </>
      ) : (
        <>
          <UserPlus className="mr-2 h-4 w-4" />
          Follow
        </>
      )}
    </Button>
  );
};
