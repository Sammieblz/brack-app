import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Conversation } from "@/hooks/useConversations";
import { Eye, EyeClosed, Search, Trash } from "iconoir-react";
import { EmptyMessages } from "@/components/empty/EmptyMessages";
import { useSwipeable } from "react-swipeable";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { hapticToast } from "@/utils/hapticToast";
import { sanitizeText } from "@/utils/sanitize";
import { deleteConversation, markConversationRead, updateConversationSettings } from "@/services/api";
import { cn } from "@/lib/utils";

interface ConversationsListProps {
  conversations: Conversation[];
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  currentUserId?: string;
}

const getInitials = (name?: string | null) => {
  if (!name) return "U";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

  if (diffInHours < 24) {
    if (diffInHours < 1) return "Just now";
    return `${diffInHours}h ago`;
  }
  if (diffInHours < 168) {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const previewMessage = (conv: Conversation, currentUserId?: string) => {
  const message = conv.last_message;
  if (!message) return "No messages yet";
  const prefix = message.sender_id === currentUserId ? "You: " : "";
  if (message.deleted_at) return `${prefix}Message deleted`;
  if (message.message_type === "gif") return `${prefix}Sent a GIF`;
  if (message.media_count && message.media_count > 0) {
    return `${prefix}Sent ${message.media_count > 1 ? `${message.media_count} images` : "an image"}`;
  }
  return `${prefix}${sanitizeText(message.content || "")}`;
};

export const ConversationsList = ({
  conversations,
  selectedConversationId,
  onSelectConversation,
  currentUserId,
}: ConversationsListProps) => {
  const { triggerHaptic } = useHapticFeedback();
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const filteredConversations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return conversations;
    return conversations.filter((conv) =>
      (conv.other_user?.display_name || "").toLowerCase().includes(normalized)
    );
  }, [conversations, query]);

  if (conversations.length === 0) {
    return <EmptyMessages />;
  }

  const handleHide = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic("medium");

    try {
      await deleteConversation(conversationId);
      hapticToast.success("Conversation hidden");
      setSwipedId(null);
      window.dispatchEvent(new Event("messages-changed"));
    } catch {
      hapticToast.error("Failed to hide conversation");
    }
  };

  const handleMarkRead = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic("light");

    try {
      await markConversationRead(conversationId);
      hapticToast.success("Marked as read");
      setSwipedId(null);
      window.dispatchEvent(new Event("messages-changed"));
    } catch {
      hapticToast.error("Failed to update");
    }
  };

  const handleMuteToggle = async (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateConversationSettings(conv.id, {
        is_muted: !conv.settings?.is_muted,
      });
      hapticToast.success(conv.settings?.is_muted ? "Conversation unmuted" : "Conversation muted");
      window.dispatchEvent(new Event("messages-changed"));
    } catch {
      hapticToast.error("Failed to update conversation");
    }
  };

  const ConversationItem = ({ conv }: { conv: Conversation }) => {
    const swipeHandlers = useSwipeable({
      onSwipedLeft: () => {
        triggerHaptic("light");
        setSwipedId(conv.id);
      },
      onSwipedRight: () => {
        triggerHaptic("light");
        setSwipedId(null);
      },
      trackMouse: false,
    });

    const isSwiped = swipedId === conv.id;
    const isSelected = selectedConversationId === conv.id;
    const unreadCount = conv.unread_count || 0;

    return (
      <div {...swipeHandlers} className="relative overflow-hidden rounded-lg">
        <Card
          className={cn(
            "cursor-pointer border-border/70 p-3 transition-all hover:border-primary/40",
            isSelected && "border-primary bg-primary/10",
            unreadCount > 0 && "border-primary/60",
            isSwiped && "-translate-x-[8.25rem]",
            "duration-300"
          )}
          onClick={() => {
            triggerHaptic("selection");
            onSelectConversation(conv.id);
          }}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="shrink-0 rounded-full"
              onClick={(event) => {
                event.stopPropagation();
                if (conv.other_user?.id) navigate(`/users/${conv.other_user.id}`);
              }}
              aria-label={`Open ${conv.other_user?.display_name || "reader"} profile`}
            >
              <Avatar className="h-12 w-12 border border-border/70">
                <AvatarImage src={conv.other_user?.avatar_url || undefined} />
                <AvatarFallback>{getInitials(conv.other_user?.display_name)}</AvatarFallback>
              </Avatar>
            </button>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <button
                  type="button"
                  className="min-w-0 truncate text-left font-sans font-semibold hover:text-primary"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (conv.other_user?.id) navigate(`/users/${conv.other_user.id}`);
                  }}
                >
                  {conv.other_user?.display_name || "Unknown Reader"}
                </button>
                {conv.is_blocked && (
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    blocked
                  </Badge>
                )}
                {conv.settings?.is_muted && (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    muted
                  </Badge>
                )}
              </div>
              <p
                className={cn(
                  "truncate font-sans text-sm",
                  unreadCount > 0 ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {previewMessage(conv, currentUserId)}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              {conv.last_message && (
                <span className="font-sans text-xs text-muted-foreground">
                  {formatDate(conv.last_message.created_at)}
                </span>
              )}
              {unreadCount > 0 ? (
                <Badge className="min-w-6 justify-center rounded-full px-2">
                  {unreadCount}
                </Badge>
              ) : (
                <span className="h-6" />
              )}
            </div>
          </div>
        </Card>

        {isSwiped && (
          <div className="absolute right-0 top-0 flex h-full items-center gap-2 pr-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={(event) => handleMarkRead(conv.id, event)}
              aria-label="Mark as read"
            >
              {conv.unread_count ? <Eye className="h-4 w-4" /> : <EyeClosed className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={(event) => handleMuteToggle(conv, event)}
              aria-label={conv.settings?.is_muted ? "Unmute" : "Mute"}
            >
              <span className="font-sans text-xs">{conv.settings?.is_muted ? "On" : "Off"}</span>
            </Button>
            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={(event) => handleHide(conv.id, event)}
              aria-label="Hide conversation"
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search messages"
          className="pl-9"
        />
      </div>

      {filteredConversations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="font-sans text-sm text-muted-foreground">No matching conversations.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredConversations.map((conv) => (
            <ConversationItem key={conv.id} conv={conv} />
          ))}
        </div>
      )}
    </div>
  );
};
