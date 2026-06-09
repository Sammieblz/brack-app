import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarCheck,
  Lock,
  MapPin,
  NavArrowRight,
  Send,
  UserBadgeCheck,
} from "iconoir-react";
import { formatDistanceToNow } from "date-fns";
import { APP_ICONS } from "@/config/iconography";
import type { BookClub } from "@/hooks/useBookClubs";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface BookClubCardProps {
  club: BookClub;
  variant?: "default" | "compact" | "featured";
  onJoin?: (clubId: string) => Promise<void> | void;
  onLeave?: (clubId: string) => Promise<void> | void;
  onRequestJoin?: (clubId: string, message?: string) => Promise<void> | void;
  onAcceptInvite?: (inviteId: string) => Promise<void> | void;
  onDeclineInvite?: (inviteId: string) => Promise<void> | void;
}

export const BookClubCard = ({
  club,
  variant = "default",
  onJoin,
  onLeave,
  onRequestJoin,
  onAcceptInvite,
  onDeclineInvite,
}: BookClubCardProps) => {
  const navigate = useNavigate();
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const isMember = Boolean(club.user_role);
  const canOpen = !club.preview_only || isMember;
  const region = [club.city, club.country].filter(Boolean).join(", ");
  const lastActive = club.last_activity_at
    ? formatDistanceToNow(new Date(club.last_activity_at), { addSuffix: true })
    : null;

  const runAction = async (action?: () => Promise<void> | void) => {
    if (!action) return;
    try {
      setBusy(true);
      await action();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      className={cn(
        "group overflow-hidden border-border/70 bg-card transition hover:border-primary/40 hover:shadow-sm",
        variant === "featured" && "border-primary/30 bg-primary/[0.03]",
      )}
    >
      {(club.banner_image_url || club.cover_image_url) && (
        <button
          type="button"
          onClick={() => canOpen && navigate(`/clubs/${club.id}`)}
          className={cn("block h-24 w-full overflow-hidden bg-primary/10", canOpen && "cursor-pointer")}
          disabled={!canOpen}
          aria-label={canOpen ? `Open ${club.name}` : `${club.name} preview`}
        >
          <img
            src={club.banner_image_url || club.cover_image_url || ""}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        </button>
      )}
      <CardContent className="flex h-full flex-col gap-4 p-4">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={() => canOpen && navigate(`/clubs/${club.id}`)}
            className={cn(
              "-mt-1 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-primary/10 text-primary shadow-sm",
              (club.banner_image_url || club.cover_image_url) && "-mt-10 ring-4 ring-card",
              canOpen && "transition group-hover:scale-[1.02]",
            )}
            aria-label={canOpen ? `Open ${club.name}` : `${club.name} preview`}
          >
            {club.avatar_image_url || club.cover_image_url ? (
              <img src={club.avatar_image_url || club.cover_image_url || ""} alt="" className="h-full w-full object-cover" />
            ) : (
              <APP_ICONS.readers.clubs className="h-7 w-7" />
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {club.is_private && (
                <Badge variant="outline" className="gap-1">
                  <Lock className="h-3 w-3" />
                  Private
                </Badge>
              )}
              {club.user_role && (
                <Badge variant="secondary" className="gap-1 capitalize">
                  <UserBadgeCheck className="h-3 w-3" />
                  {club.user_role}
                </Badge>
              )}
              {club.join_status === "requested" && <Badge variant="outline">Requested</Badge>}
              {club.join_status === "invited" && <Badge className="gap-1">Invite</Badge>}
            </div>

            <button
              type="button"
              onClick={() => canOpen && navigate(`/clubs/${club.id}`)}
              className="block text-left"
              disabled={!canOpen}
            >
              <h3 className="line-clamp-2 font-display text-lg font-semibold leading-tight text-foreground transition group-hover:text-primary">
                {club.name}
              </h3>
            </button>
            <p className="mt-1 line-clamp-2 font-sans text-sm text-muted-foreground">
              {club.description || "A reading group looking for its next chapter."}
            </p>
          </div>
        </div>

        <div className="grid gap-2 font-sans text-sm text-muted-foreground sm:grid-cols-2">
          <span className="flex items-center gap-2">
            <APP_ICONS.readers.clubs className="h-4 w-4 text-primary" />
            {club.member_count} member{club.member_count === 1 ? "" : "s"}
          </span>
          {region && (
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="truncate">{region}</span>
            </span>
          )}
          {lastActive && !club.preview_only && (
            <span className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary" />
              {lastActive}
            </span>
          )}
          {club.recommendation_reason && (
            <span className="flex items-center gap-2">
              <APP_ICONS.readers.suggestions className="h-4 w-4 text-primary" />
              <span className="truncate">{club.recommendation_reason}</span>
            </span>
          )}
        </div>

        {(club.genres.length > 0 || club.tags.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {[...club.genres, ...club.tags].slice(0, 5).map((tag) => (
              <Badge key={tag} variant="outline" className="max-w-full truncate">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {club.current_book && !club.preview_only && (
          <div className="rounded-lg border border-border/70 bg-muted/25 p-3">
            <p className="mb-2 flex items-center gap-2 font-sans text-xs font-semibold text-muted-foreground">
              <APP_ICONS.profile.booksTab className="h-4 w-4 text-primary" />
              Current book
            </p>
            <div className="flex items-center gap-3">
              {club.current_book.cover_url && (
                <img
                  src={club.current_book.cover_url}
                  alt=""
                  className="h-14 w-10 rounded object-cover shadow-sm"
                />
              )}
              <div className="min-w-0">
                <p className="truncate font-serif text-sm font-semibold">{club.current_book.title}</p>
                {club.current_book.author && (
                  <p className="truncate font-serif text-xs text-muted-foreground">
                    by {club.current_book.author}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {requestOpen && (
          <div className="space-y-2 rounded-lg border border-primary/25 bg-primary/[0.03] p-3">
            <Textarea
              value={requestMessage}
              onChange={(event) => setRequestMessage(event.target.value)}
              rows={3}
              placeholder="Add a short note for the admins..."
              className="resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRequestOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  runAction(async () => {
                    await onRequestJoin?.(club.id, requestMessage);
                    setRequestOpen(false);
                    setRequestMessage("");
                  })
                }
              >
                <Send className="mr-2 h-4 w-4" />
                Send
              </Button>
            </div>
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
          {canOpen && (
            <Button
              variant={isMember ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => navigate(`/clubs/${club.id}`)}
            >
              View Club
              <NavArrowRight className="h-4 w-4" />
            </Button>
          )}
          {!isMember && club.join_status === "invited" && (
            <>
              <Button
                size="sm"
                disabled={busy || !club.invite_id}
                onClick={() => club.invite_id && runAction(() => onAcceptInvite?.(club.invite_id!))}
              >
                Accept
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy || !club.invite_id}
                onClick={() => club.invite_id && runAction(() => onDeclineInvite?.(club.invite_id!))}
              >
                Decline
              </Button>
            </>
          )}
          {!isMember && club.join_status === "none" && !club.is_private && onJoin && (
            <Button size="sm" disabled={busy} onClick={() => runAction(() => onJoin(club.id))}>
              Join
            </Button>
          )}
          {!isMember && club.join_status === "none" && club.is_private && onRequestJoin && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setRequestOpen(true)}>
              Request to Join
            </Button>
          )}
          {isMember && club.user_role !== "admin" && onLeave && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => runAction(() => onLeave(club.id))}>
              Leave
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
