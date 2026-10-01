import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Conversation } from "@/hooks/useConversations";
import { Eye, MoreHoriz, Search, Trash } from "iconoir-react";
import { EmptyMessages } from "@/components/empty/EmptyMessages";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { useSwipeable } from "react-swipeable";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { hapticToast } from "@/utils/hapticToast";
import { sanitizeText } from "@/utils/sanitize";
import { deleteConversation, markConversationRead, updateConversationSettings } from "@/services/api";
import { cn } from "@/lib/utils";
import { getLocalGestureTouch, observeTouchCancellation } from "@/utils/touchGesture";
import { useAppBackGuard } from "@/hooks/useAppBackGuard";

interface ConversationsListProps {
  conversations: Conversation[];
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  currentUserId?: string;
  onBeforeLeave?: () => Promise<boolean>;
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

// Keep the row component identity stable through background refreshes.
const ConversationItem = ({
  conv, isSwiped, isSelected, currentUserId, onSelectConversation,
  setSwipedId, onAction, pending, error, onBeforeLeave,
}: {
  conv: Conversation;
  isSwiped: boolean;
  isSelected: boolean;
  currentUserId?: string;
  onSelectConversation: (id: string) => void;
  setSwipedId: (id: string | null) => void;
  onAction: (conversation: Conversation, action: ConversationAction) => Promise<void>;
  pending: PendingAction | null;
  error?: string;
  onBeforeLeave?: () => Promise<boolean>;
}) => {
  const { triggerHaptic } = useHapticFeedback();
  const navigate = useNavigate();
  const actionsId = useId();
  const actionsTrigger = useRef<HTMLButtonElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  const contact = useRef<number | null>(null);
  const axis = useRef<"horizontal" | "vertical" | null>(null);
  const suppressClick = useRef(false);
  const removeListeners = useRef<() => void>();
  const mounted = useRef(true);
  const profileDeparture = useRef(false);
  const [leavingProfile, setLeavingProfile] = useState(false);
  const currentPending = useRef(pending);
  currentPending.current = pending;
  const endContact = useCallback(() => {
    contact.current = null;
    removeListeners.current?.();
    removeListeners.current = undefined;
  }, []);
  const cancelContact = useCallback(() => {
    if (contact.current === null) return;
    suppressClick.current = true;
    endContact();
  }, [endContact]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; endContact(); };
  }, [endContact]);
  useEffect(() => { if (pending) cancelContact(); }, [pending, cancelContact]);

  const closeActions = () => {
    if (pending) return;
    if (actions.current?.contains(document.activeElement)) actionsTrigger.current?.focus();
    setSwipedId(null);
  };
  const swipeHandlers = useSwipeable({
    onTouchStartOrOnMouseDown: ({ event }) => {
      endContact();
      axis.current = null;
      suppressClick.current = false;
      if (pending || !("touches" in event)) return;
      const touch = getLocalGestureTouch(event, ".conversation-open");
      if (!touch) return;
      contact.current = touch.identifier;
      removeListeners.current = observeTouchCancellation(touch.identifier, cancelContact);
    },
    onSwiping: ({ absX, absY, event }) => {
      suppressClick.current = true;
      if (contact.current === null) return;
      axis.current ??= absX > absY ? "horizontal" : "vertical";
      if (axis.current === "horizontal" && event.cancelable) event.preventDefault();
    },
    onSwiped: ({ deltaX, absX }) => {
      if (contact.current === null || axis.current !== "horizontal" || absX < 48) return;
      triggerHaptic("light");
      if (deltaX < 0) setSwipedId(conv.id);
      else closeActions();
    },
    onTouchEndOrOnMouseUp: endContact,
    trackMouse: false,
    preventScrollOnSwipe: false,
    touchEventOptions: { passive: false },
  });

  const unreadCount = conv.unread_count || 0;
  const name = conv.other_user?.display_name || "Unknown Reader";
  const rowPending = pending?.id === conv.id;
  const openProfile = async () => {
    const userId = conv.other_user?.id;
    if (!userId || currentPending.current || profileDeparture.current) return;
    profileDeparture.current = true;
    setLeavingProfile(true);
    try {
      const allowed = onBeforeLeave ? await onBeforeLeave() : true;
      if (allowed && mounted.current && !currentPending.current) navigate(`/users/${userId}`);
    } finally {
      profileDeparture.current = false;
      if (mounted.current) setLeavingProfile(false);
    }
  };

  return (
    <div {...swipeHandlers} className="min-w-0 rounded-lg" style={{ touchAction: "pan-y pinch-zoom" }}
      onTouchCancel={cancelContact}
      onPointerDownCapture={(event) => {
        if (event.currentTarget.contains(event.target as Node) && event.isPrimary !== false) suppressClick.current = false;
      }}
      onClickCapture={(event) => {
        if (!event.currentTarget.contains(event.target as Node) || !suppressClick.current || event.detail === 0) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClick.current = false;
      }}>
      <Card
        className={cn(
          "min-w-0 border-border/70 p-3",
          isSelected && "border-primary bg-primary/10",
          unreadCount > 0 && "border-primary/60"
        )}
        aria-busy={rowPending || undefined}
      >
        <div className="flex items-start gap-2">
          <button
            type="button"
            className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            disabled={Boolean(pending) || leavingProfile || !conv.other_user?.id}
            onClick={() => void openProfile()}
            aria-label={`Open ${name} profile`}
          >
            <Avatar className="h-[44px] w-[44px] border border-border/70">
              <AvatarImage src={conv.other_user?.avatar_url || undefined} />
              <AvatarFallback>{getInitials(conv.other_user?.display_name)}</AvatarFallback>
            </Avatar>
          </button>

          <button type="button" className="conversation-open min-h-[44px] min-w-0 flex-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            data-conversation-id={conv.id}
            aria-label={`Open conversation with ${name}`}
            aria-describedby={`${actionsId}-preview ${actionsId}-summary`}
            aria-current={isSelected ? "true" : undefined}
            disabled={Boolean(pending)}
            onClick={() => {
              if (window.getSelection()?.toString()) return;
              triggerHaptic("selection");
              onSelectConversation(conv.id);
            }}>
            <span className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="min-w-0 break-words font-sans font-semibold [overflow-wrap:anywhere]">{name}</span>
              {conv.is_blocked && (
                <span className={cn(badgeVariants({ variant: "outline" }), "shrink-0 text-xs")}>
                  blocked
                </span>
              )}
              {conv.settings?.is_muted && (
                <span className={cn(badgeVariants({ variant: "secondary" }), "shrink-0 text-xs")}>
                  muted
                </span>
              )}
            </span>
            <span
              id={`${actionsId}-preview`}
              className={cn(
                "block line-clamp-2 break-words font-sans text-sm [overflow-wrap:anywhere]",
                unreadCount > 0 ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              {previewMessage(conv, currentUserId)}
            </span>
            <span id={`${actionsId}-summary`} className="mt-1 flex flex-wrap items-center gap-2">
            {conv.last_message && (
              <span className="font-sans text-xs text-muted-foreground">
                {formatDate(conv.last_message.created_at)}
              </span>
            )}
            {unreadCount > 0 ? (
              <span className={cn(badgeVariants(), "min-w-6 justify-center rounded-full px-2")}>
                {unreadCount}<span className="sr-only"> unread messages</span>
              </span>
            ) : null}
            </span>
          </button>
          <Button ref={actionsTrigger} type="button" size="icon" variant="ghost" className="h-[44px] w-[44px] shrink-0"
            aria-label={`Actions for conversation with ${name}`} aria-expanded={isSwiped} aria-controls={actionsId}
            disabled={Boolean(pending)}
            onClick={() => isSwiped ? closeActions() : setSwipedId(conv.id)}>
            <MoreHoriz className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      {isSwiped && (
        <div id={actionsId} ref={actions} role="group" aria-label={`Conversation actions for ${name}`} className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-2 border-t border-border/70 pt-3">
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-[44px] min-w-0 whitespace-normal text-left"
            disabled={Boolean(pending) || unreadCount === 0}
            onClick={() => void onAction(conv, "read")}
          >
            <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{rowPending && pending.action === "read" ? "Marking as read…" : "Mark as read"}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-[44px] min-w-0 whitespace-normal text-left"
            disabled={Boolean(pending)}
            onClick={() => void onAction(conv, "mute")}
          >
            <span className="min-w-0 [overflow-wrap:anywhere]">{rowPending && pending.action === "mute" ? "Updating…" : conv.settings?.is_muted ? "Unmute" : "Mute"}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-[44px] min-w-0 whitespace-normal text-left text-destructive"
            disabled={Boolean(pending)}
            onClick={() => void onAction(conv, "hide")}
          >
            <Trash className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{rowPending && pending.action === "hide" ? "Hiding…" : "Hide conversation"}</span>
          </Button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 break-words font-sans text-sm text-destructive">{error}</p>}
      </Card>
    </div>
  );
};


type ConversationAction = "read" | "mute" | "hide";
type PendingAction = { id: string; action: ConversationAction };
type ConfirmedState = { hidden?: boolean; muted?: boolean; readMessageId?: string | null };

const ConversationsListContent = ({
  conversations,
  selectedConversationId,
  onSelectConversation,
  currentUserId,
  onBeforeLeave,
}: ConversationsListProps) => {
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const focusSearch = useRef(false);
  const pendingRef = useRef<PendingAction | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [confirmed, setConfirmed] = useState<Record<string, ConfirmedState>>({});
  const [status, setStatus] = useState("");
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!pending && focusSearch.current) { focusSearch.current = false; search.current?.focus(); }
  }, [pending]);
  useAppBackGuard(Boolean(pending), () => !pendingRef.current);

  // Retain acknowledged writes through a failed/stale refresh. Once the server
  // catches up, release the projection so later messages/settings stay live.
  useEffect(() => {
    setConfirmed((current) => {
      const next = { ...current };
      for (const [id, value] of Object.entries(next)) {
        const conversation = conversations.find((item) => item.id === id);
        if (!conversation) { delete next[id]; continue; }
        const remaining = { ...value };
        if (value.muted === Boolean(conversation.settings?.is_muted)) delete remaining.muted;
        if ("readMessageId" in value && (!conversation.unread_count || (conversation.last_message?.id ?? null) !== value.readMessageId)) delete remaining.readMessageId;
        if (Object.keys(remaining).length) next[id] = remaining;
        else delete next[id];
      }
      return next;
    });
  }, [conversations]);

  const visibleConversations = useMemo(() => conversations.flatMap((conversation) => {
    const value = confirmed[conversation.id];
    if (value?.hidden) return [];
    return [{ ...conversation,
      unread_count: value && "readMessageId" in value && (conversation.last_message?.id ?? null) === value.readMessageId ? 0 : conversation.unread_count,
      settings: value?.muted === undefined ? conversation.settings : {
        conversation_id: conversation.id, user_id: currentUserId || "", is_pinned: false, is_archived: false,
        ...conversation.settings, is_muted: value.muted,
      },
    }];
  }), [conversations, confirmed, currentUserId]);

  const filteredConversations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return visibleConversations;
    return visibleConversations.filter((conv) =>
      (conv.other_user?.display_name || "").toLowerCase().includes(normalized)
    );
  }, [visibleConversations, query]);

  const handleAction = async (conv: Conversation, action: ConversationAction) => {
    if (pendingRef.current) return;
    const task = { id: conv.id, action };
    pendingRef.current = task;
    setPending(task);
    setError(null);
    setStatus("");
    try {
      const muted = !conv.settings?.is_muted;
      if (action === "hide") await deleteConversation(conv.id);
      else if (action === "read") await markConversationRead(conv.id);
      else await updateConversationSettings(conv.id, { is_muted: muted });
      if (!mounted.current) return;
      setConfirmed((current) => ({ ...current, [conv.id]: { ...current[conv.id],
        ...(action === "hide" ? { hidden: true } : action === "mute" ? { muted } : { readMessageId: conv.last_message?.id ?? null }),
      } }));
      const message = action === "hide" ? "Conversation hidden" : action === "read" ? "Marked as read" : muted ? "Conversation muted" : "Conversation unmuted";
      setStatus(message);
      hapticToast.success(message);
      if (action === "hide") { setSwipedId(null); focusSearch.current = true; }
      window.dispatchEvent(new Event("messages-changed"));
    } catch {
      if (mounted.current) setError({ id: conv.id, message: `${action === "hide" ? "Could not hide this conversation" : action === "read" ? "Could not mark this conversation as read" : "Could not change notifications"}. Try again.` });
    } finally {
      pendingRef.current = null;
      if (mounted.current) setPending(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={search}
          aria-label="Search messages"
          disabled={Boolean(pending)}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search messages"
          className="pl-9"
        />
      </div>

      <p role="status" className="sr-only">{pending ? "Updating conversation…" : status}</p>
      {visibleConversations.length === 0 ? <EmptyMessages /> : filteredConversations.length === 0 ? (
        <PremiumEmptyState
          asset="noResults"
          title="No matching conversations"
          description="Try another reader name or clear your search."
          variant="plain"
          size="compact"
          className="rounded-lg border border-dashed border-border p-4"
        />
      ) : (
        <div className="space-y-2">
          {filteredConversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conv={conv}
              isSwiped={swipedId === conv.id}
              isSelected={selectedConversationId === conv.id}
              currentUserId={currentUserId}
              onSelectConversation={onSelectConversation}
              setSwipedId={setSwipedId}
              onAction={handleAction}
              pending={pending}
              error={error?.id === conv.id ? error.message : undefined}
              onBeforeLeave={onBeforeLeave}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const ConversationsList = (props: ConversationsListProps) => <ConversationsListContent key={props.currentUserId ?? "anonymous"} {...props} />;
