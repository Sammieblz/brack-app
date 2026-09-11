import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFollowing } from "@/hooks/useFollowing";
import { Check, MoreHoriz, UserPlus, UserXmark } from "iconoir-react";
import { useAuth } from "@/hooks/useAuth";

interface FollowButtonProps {
  userId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
}

export interface FollowActionRelationship {
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMutual: boolean;
  loading: boolean;
  followUser: () => Promise<void>;
  unfollowUser: () => Promise<void>;
}

interface FollowActionProps extends FollowButtonProps {
  relationship: FollowActionRelationship;
  context?: "default" | "profile";
  displayName?: string | null;
}

export const FollowAction = ({
  userId,
  relationship,
  context = "default",
  displayName,
  variant = "default",
  size = "default",
}: FollowActionProps) => {
  const { user } = useAuth();
  const [confirmUnfollowOpen, setConfirmUnfollowOpen] = useState(false);
  const { isFollowing, isFollowedBy, isMutual, loading, followUser, unfollowUser } = relationship;

  if (!user || user.id === userId) return null;

  const readerName = displayName || "this reader";
  const requestUnfollow = () => {
    if (isMutual) {
      setConfirmUnfollowOpen(true);
      return;
    }
    void unfollowUser();
  };

  if (!isFollowing) {
    return (
      <Button onClick={() => void followUser()} disabled={loading} variant={variant} size={size}>
        <UserPlus className="mr-2 h-4 w-4" />
        {isFollowedBy ? "Follow back" : "Follow"}
      </Button>
    );
  }

  if (context !== "profile") {
    return (
      <Button
        onClick={requestUnfollow}
        disabled={loading}
        variant="outline"
        size={size}
        aria-label={`Unfollow ${readerName}`}
      >
        <Check className="mr-2 h-4 w-4" />
        Following
      </Button>
    );
  }

  return (
    <>
      <div className="inline-flex items-center gap-1">
        <span
          className={buttonVariants({ variant: "secondary", size })}
          role="status"
          aria-label={`Following ${readerName}`}
        >
          <Check className="mr-2 h-4 w-4" />
          Following
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={loading}
              aria-label={`Relationship actions for ${readerName}`}
              className="h-9 w-9"
            >
              <MoreHoriz className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={requestUnfollow}
            >
              <UserXmark className="mr-2 h-4 w-4" />
              Unfollow
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmUnfollowOpen} onOpenChange={setConfirmUnfollowOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unfollow {readerName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Your conversation history will stay available, but neither of you can send new
              messages until you follow each other again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep following</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void unfollowUser()}
            >
              Unfollow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export const FollowButton = ({ userId, variant = "default", size = "default" }: FollowButtonProps) => {
  const relationship = useFollowing(userId);
  return (
    <FollowAction
      userId={userId}
      relationship={relationship}
      variant={variant}
      size={size}
    />
  );
};
