import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TypingIndicator } from "@/components/messaging/TypingIndicator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MobileDialog } from "@/components/ui/mobile-dialog";
import {
  Attachment,
  ChatBubble,
  Copy,
  Emoji,
  MediaImage,
  MoreHoriz,
  Search,
  Send,
  Trash,
  Xmark,
} from "iconoir-react";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useProfileContext } from "@/contexts/ProfileContext";
import { ReactionBar } from "@/components/reactions/ReactionBar";
import { blockUser, searchMessageGifs, uploadMessageMediaFiles } from "@/services/api";
import type {
  GifSearchResult,
  DirectMessageEligibilityStatus,
  Message,
  MessageReactionType,
  SendMessageRequest,
} from "@/services/api";
import { sanitizeText, sanitizeInput } from "@/utils/sanitize";
import { cn } from "@/lib/utils";
import { hasOpenOverlay } from "@/lib/backLayers";
import { getLocalGestureTouch, observeTouchCancellation } from "@/utils/touchGesture";
import { toast } from "sonner";

export interface MessageThreadTaskState {
  pending: boolean;
  hasTransientDraft: boolean;
}

interface MessageThreadProps {
  messages: Message[];
  onSendMessage: (contentOrRequest: string | Omit<SendMessageRequest, "conversation_id">) => Promise<boolean>;
  onToggleReaction: (messageId: string, reactionType: MessageReactionType) => Promise<boolean>;
  onDeleteMessage: (messageId: string) => Promise<boolean>;
  currentUserId?: string;
  conversationId: string | null;
  otherUser?: {
    id: string;
    display_name: string | null;
    avatar_url?: string | null;
    show_online_status?: boolean | null;
    last_seen_at?: string | null;
    reader_status?: string | null;
  } | null;
  isBlocked?: boolean;
  messageEligibility?: DirectMessageEligibilityStatus;
  onBack?: () => void;
  showParticipantHeader?: boolean;
  onTaskStateChange?: (state: MessageThreadTaskState) => void;
  onBeforeLeave?: () => Promise<boolean>;
}

/** The bubble owns only a deliberate interior right swipe. Text selection, native
 * menus, vertical pan, pinch and controls keep their own browser interaction. */
const ReplyGesture = ({ enabled, onReply, children }: { enabled: boolean; onReply: () => void; children: ReactNode }) => {
  const surface = useRef<HTMLDivElement>(null);
  const reply = useRef(onReply);
  reply.current = onReply;
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    const element = surface.current;
    if (!element || !enabled) return;
    let contact: { id: number; x: number; y: number; horizontal: boolean; distance: number } | null = null;
    let stopObserving: (() => void) | undefined;
    const cancel = () => {
      contact = null;
      stopObserving?.();
      stopObserving = undefined;
      setOffset(0);
      setDragging(false);
    };
    const start = (event: TouchEvent) => {
      cancel();
      if (!(event.target instanceof Node) || !element.contains(event.target)) return;
      const touch = getLocalGestureTouch(event);
      if (!touch) return;
      contact = { id: touch.identifier, x: touch.clientX, y: touch.clientY, horizontal: false, distance: 0 };
      stopObserving = observeTouchCancellation(touch.identifier, cancel);
    };
    const move = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!contact) return;
      if (event.defaultPrevented || event.touches.length !== 1 || touch?.identifier !== contact.id || window.getSelection()?.toString() || hasOpenOverlay()) { cancel(); return; }
      const dx = touch.clientX - contact.x;
      const dy = touch.clientY - contact.y;
      if (!contact.horizontal) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return;
        if (dx <= 0 || Math.abs(dy) >= dx) { cancel(); return; }
        contact.horizontal = true;
        setDragging(true);
      }
      contact.distance = Math.max(0, dx);
      setOffset(Math.min(64, contact.distance * 0.6));
      if (event.cancelable) event.preventDefault();
    };
    const end = (event: TouchEvent) => {
      const shouldReply = Boolean(contact?.horizontal && contact.distance >= 64 && event.touches.length === 0 &&
        !event.defaultPrevented && !window.getSelection()?.toString() && !hasOpenOverlay());
      cancel();
      if (shouldReply) reply.current();
    };
    element.addEventListener("touchstart", start, { passive: true });
    element.addEventListener("touchmove", move, { passive: false });
    element.addEventListener("touchend", end, { passive: true });
    element.addEventListener("touchcancel", cancel, { passive: true });
    return () => {
      cancel();
      element.removeEventListener("touchstart", start);
      element.removeEventListener("touchmove", move);
      element.removeEventListener("touchend", end);
      element.removeEventListener("touchcancel", cancel);
    };
  }, [enabled]);
  return <div ref={surface} data-message-reply-surface className="relative min-w-0 touch-pan-y touch-pinch-zoom">
    {offset > 0 && <ChatBubble aria-hidden className="pointer-events-none absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />}
    <div className={cn("min-w-0 motion-reduce:transition-none", !dragging && "transition-transform duration-150 ease-out")}
      style={{ transform: `translateX(${offset}px)`, ...(dragging ? { transition: "none" } : {}) }}>{children}</div>
  </div>;
};

const getInitials = (name?: string | null) => {
  if (!name) return "U";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const formatTimestamp = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (diffInHours < 24 && date.getDate() === now.getDate()) return timeStr;
  if (diffInHours < 48 && date.getDate() === now.getDate() - 1) return `Yesterday ${timeStr}`;
  if (diffInHours < 168) {
    return `${date.toLocaleDateString([], { weekday: "short" })} ${timeStr}`;
  }
  return `${date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  })} ${timeStr}`;
};

const shouldGroupWithPrevious = (message: Message, previous?: Message) => {
  if (!previous) return false;
  if (message.sender_id !== previous.sender_id) return false;
  const delta = new Date(message.created_at).getTime() - new Date(previous.created_at).getTime();
  return delta >= 0 && delta < 5 * 60 * 1000;
};

const previewText = (message: Message) => {
  if (message.deleted_at) return "Deleted message";
  if (message.content) return sanitizeText(message.content);
  if (message.message_type === "gif") return "GIF";
  return "Media";
};

export const MessageThread = ({
  messages,
  onSendMessage,
  onToggleReaction,
  onDeleteMessage,
  currentUserId,
  conversationId,
  otherUser,
  isBlocked,
  messageEligibility = "eligible",
  showParticipantHeader,
  onTaskStateChange,
  onBeforeLeave,
}: MessageThreadProps) => {
  const id = useId();
  const [messageContent, setMessageContent] = useState("");
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [previewMedia, setPreviewMedia] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState<GifSearchResult[]>([]);
  const [gifSearching, setGifSearching] = useState(false);
  const [composerError, setComposerError] = useState<{ target: "media" | "send"; message: string; invalid?: boolean } | null>(null);
  const [gifError, setGifError] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState<string | null>(null);
  const [conversationOptionsOpen, setConversationOptionsOpen] = useState(false);
  const [actionTask, setActionTask] = useState<{ type: "block" } | { type: "delete"; messageId: string } | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reactionError, setReactionError] = useState<{ messageId: string; text: string } | null>(null);
  const [reactionPending, setReactionPending] = useState<string | null>(null);
  const [awayFromLatest, setAwayFromLatest] = useState(false);
  const actionLocked = useRef(false);
  const reactionLocked = useRef(false);
  const actionOpenerRef = useRef<HTMLElement | null>(null);
  const headerBlockRef = useRef<HTMLButtonElement>(null);
  const conversationOpenerRef = useRef<HTMLButtonElement>(null);
  const messageActionRefs = useRef(new Map<string, HTMLButtonElement>());
  const replyFocusAfterClose = useRef(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const actionReturnFocus = useMemo(() => ({
    get current() {
      if (actionOpenerRef.current?.isConnected) return actionOpenerRef.current;
      return headerBlockRef.current ?? conversationOpenerRef.current ?? composerRef.current;
    },
  }), []);
  const mediaOpenerRef = useRef<HTMLButtonElement | null>(null);
  const gifOpenerRef = useRef<HTMLButtonElement>(null);
  const sendingRef = useRef(false);
  const textRevision = useRef(0);
  const mountedRef = useRef(true);
  const owner = useMemo(() => ({ conversationId, currentUserId }), [conversationId, currentUserId]);
  const activeOwner = useRef(owner);
  activeOwner.current = owner;
  const retryRequest = useRef<{
    content: string;
    files: File[];
    replyId: string | null;
    gifId?: string;
    request: Omit<SendMessageRequest, "conversation_id">;
  } | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const followingLatest = useRef(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { otherUserTyping, setTyping } = useTypingIndicator(conversationId, currentUserId);
  const { triggerHaptic } = useHapticFeedback();
  const isMobile = useIsMobile();
  const participantHeader = showParticipantHeader ?? !isMobile;
  const isOnline = useNetworkStatus();
  const navigate = useNavigate();
  const { profile } = useProfileContext();
  const messagingDisabled = Boolean(isBlocked) || messageEligibility !== "eligible";
  const unavailableMessage = isBlocked || messageEligibility === "restricted"
    ? "Messaging is unavailable because of a privacy or safety setting. Existing history is still visible."
    : "This conversation is read-only until you both follow each other again. Existing history is still visible.";

  // Legacy conversation-only keys are intentionally not read: their reader owner
  // cannot be established on a shared device. Leave them untouched.
  const draftKey = conversationId && currentUserId ? `message_draft_${currentUserId}_${conversationId}` : null;
  const selectedFilePreviews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files]
  );

  useEffect(() => {
    return () => selectedFilePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [selectedFilePreviews]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    let saved = "";
    try { saved = draftKey ? localStorage.getItem(draftKey) || "" : ""; } catch { /* In-memory composing still works. */ }
    setMessageContent(saved);
    textRevision.current += 1;
    setFiles([]);
    setReplyingTo(null);
    setComposerError(null);
    setGifError(null);
    setGifOpen(false);
    setGifResults([]);
    setGifQuery("");
    setGifSearching(false);
    setPreviewMedia(null);
    setSending(false);
    sendingRef.current = false;
    retryRequest.current = null;
    setEmojiOpen(false);
    setActionsOpen(null);
    setConversationOptionsOpen(false);
    setActionTask(null);
    setActionPending(false);
    setActionError(null);
    setReactionError(null);
    setReactionPending(null);
    actionLocked.current = false;
    reactionLocked.current = false;
    followingLatest.current = true;
    setAwayFromLatest(false);
    if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [draftKey, owner]);

  useLayoutEffect(() => {
    onTaskStateChange?.({ pending: sending || actionPending || Boolean(reactionPending), hasTransientDraft: files.length > 0 || Boolean(replyingTo) });
  }, [sending, actionPending, reactionPending, files.length, replyingTo, onTaskStateChange]);
  useLayoutEffect(() => () => onTaskStateChange?.({ pending: false, hasTransientDraft: false }), [onTaskStateChange]);

  useLayoutEffect(() => {
    if (followingLatest.current && historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [messages]);
  useEffect(() => {
    const history = historyRef.current;
    if (!history || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (followingLatest.current) history.scrollTop = history.scrollHeight;
    });
    observer.observe(history);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      void setTyping(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const openProfile = async (userId?: string | null) => {
    if (!userId || sendingRef.current || actionLocked.current || reactionLocked.current) return;
    if (onBeforeLeave && !(await onBeforeLeave())) return;
    if (mountedRef.current && activeOwner.current === owner) navigate(`/users/${userId}`);
  };

  const updateText = (value: string) => {
    textRevision.current += 1;
    setMessageContent(value);
    try {
      if (draftKey) {
        if (value) localStorage.setItem(draftKey, value);
        else localStorage.removeItem(draftKey);
      }
    } catch { /* Storage restrictions must not block writing a message. */ }
  };

  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    updateText(event.target.value);
    if (composerError?.invalid) setComposerError(null);
    setTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTyping(false), 2000);
  };

  const validateFiles = (selected: File[]) => {
    if (selected.length > 4) throw new Error("Messages can include up to 4 media items");
    for (const file of selected) {
      if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
        throw new Error(`${file.name} is not a supported image or GIF`);
      }
      if (file.size > 8 * 1024 * 1024) throw new Error(`${file.name} must be 8 MB or smaller`);
    }
  };

  const handleFileChange = (fileList: FileList | null) => {
    if (sendingRef.current) return;
    try {
      const selected = Array.from(fileList || []);
      validateFiles(selected);
      setFiles(selected);
      setComposerError(null);
    } catch (error) {
      setComposerError({ target: "media", message: error instanceof Error ? error.message : "Invalid media" });
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const submitMessage = async (gif?: GifSearchResult) => {
    if (sendingRef.current || actionLocked.current || reactionLocked.current || !conversationId || messagingDisabled || !isOnline) return;
    if (!gif && !messageContent.trim() && files.length === 0) return;
    if (messageContent.length > 5000) {
      triggerHaptic("error");
      const message = "Message must be 5000 characters or fewer.";
      setComposerError({ target: "send", message, invalid: true });
      if (gif) setGifError(message);
      else composerRef.current?.focus();
      return;
    }

    // Snapshot one submission; continued typing belongs to the next draft.
    const revision = textRevision.current;
    const submittedFiles = files;
    const replyId = replyingTo?.id || null;
    const current = () => mountedRef.current && activeOwner.current === owner;
    const previous = retryRequest.current;
    const attempt = previous && previous.content === messageContent && previous.files === files &&
      previous.replyId === replyId && previous.gifId === gif?.id
      ? previous
      : {
          content: messageContent,
          files,
          replyId,
          gifId: gif?.id,
          request: {
            content: messageContent.trim() ? sanitizeInput(messageContent) : null,
            reply_to_message_id: replyId,
            client_message_id: crypto.randomUUID(),
            ...(gif ? { gif } : {}),
          } as Omit<SendMessageRequest, "conversation_id">,
        };
    retryRequest.current = attempt;
    sendingRef.current = true;
    setSending(true);
    setComposerError(null);
    setGifError(null);
    let uploading = false;
    try {
      triggerHaptic("light");
      setTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (!gif && !attempt.request.media) {
        uploading = true;
        attempt.request.media = files.length ? await uploadMessageMediaFiles(files) : [];
        uploading = false;
      }
      // A completed upload must not send into a task that was replaced meanwhile.
      if (!current()) return;
      const success = await onSendMessage(attempt.request);
      if (!current()) return;
      if (success) {
        if (textRevision.current === revision) updateText("");
        if (!gif) {
          setFiles((currentFiles) => currentFiles === submittedFiles ? [] : currentFiles);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
        setReplyingTo((reply) => reply?.id === replyId ? null : reply);
        retryRequest.current = null;
        if (gif) {
          setGifOpen(false);
          setGifResults([]);
          setGifQuery("");
        }
        triggerHaptic("success");
      } else {
        const message = "Message wasn't sent. Your draft is still here. Try again.";
        setComposerError({ target: "send", message });
        if (gif) setGifError(message);
      }
    } catch (error) {
      if (!current()) return;
      const message = error instanceof Error ? error.message : uploading ? "Couldn't upload media. Try again." : "Couldn't send message. Try again.";
      setComposerError({ target: uploading ? "media" : "send", message });
      if (gif) setGifError(message);
    } finally {
      if (current()) {
        sendingRef.current = false;
        setSending(false);
      }
    }
  };

  const handleSend = () => submitMessage();

  const handleGifSearch = async () => {
    if (!gifQuery.trim() || gifSearching || sendingRef.current) return;
    try {
      setGifSearching(true);
      setGifError(null);
      const response = await searchMessageGifs(gifQuery);
      if (!mountedRef.current || activeOwner.current !== owner) return;
      setGifResults(response.results || []);
    } catch (error) {
      if (mountedRef.current && activeOwner.current === owner) setGifError(error instanceof Error ? error.message : "Failed to search GIFs");
    } finally {
      if (mountedRef.current && activeOwner.current === owner) setGifSearching(false);
    }
  };

  const handleEmojiClick = (emoji: EmojiClickData) => {
    if (sendingRef.current || messagingDisabled) return;
    updateText(`${messageContent}${emoji.emoji}`);
    setEmojiOpen(false);
  };

  const handleCopy = async (message: Message) => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      if (mountedRef.current && activeOwner.current === owner) { setActionsOpen(null); toast.success("Message copied"); }
    } catch {
      if (mountedRef.current && activeOwner.current === owner) setReactionError({ messageId: message.id, text: "Couldn't copy this message. Select its text to copy it." });
    }
  };

  const startReply = (message: Message) => {
    if (sendingRef.current || actionLocked.current || reactionLocked.current || messagingDisabled || message.deleted_at) return;
    replyFocusAfterClose.current = actionsOpen === message.id;
    setActionsOpen(null);
    setConversationOptionsOpen(false);
    setReplyingTo(message);
    if (!replyFocusAfterClose.current) composerRef.current?.focus();
  };

  const startAction = (task: NonNullable<typeof actionTask>, opener: HTMLElement) => {
    if (actionLocked.current || sendingRef.current || reactionLocked.current) return;
    actionOpenerRef.current = opener;
    setActionsOpen(null);
    setConversationOptionsOpen(false);
    setActionError(null);
    setActionTask(task);
  };

  const confirmAction = async () => {
    if (!actionTask || actionLocked.current || sendingRef.current || reactionLocked.current) return;
    const task = actionTask;
    actionLocked.current = true;
    setActionPending(true);
    setActionError(null);
    const current = () => mountedRef.current && activeOwner.current === owner;
    try {
      if (task.type === "block") {
        if (!otherUser?.id) throw new Error("This reader is no longer available.");
        await blockUser(otherUser.id);
      } else if (!(await onDeleteMessage(task.messageId))) throw new Error("Message wasn't deleted. Please try again.");
      if (!current()) return;
      if (task.type === "delete") actionOpenerRef.current = composerRef.current;
      setActionTask(null);
      if (task.type === "block") {
        toast.success("Reader blocked");
        window.dispatchEvent(new Event("messages-changed"));
      }
    } catch (error) {
      if (current()) setActionError(error instanceof Error ? error.message : "Couldn't save this change. Please try again.");
    } finally {
      if (current()) { actionLocked.current = false; setActionPending(false); }
    }
  };

  const toggleReaction = async (message: Message, reactionType: MessageReactionType) => {
    if (reactionLocked.current || sendingRef.current || actionLocked.current || messagingDisabled || !isOnline || message.deleted_at) return;
    reactionLocked.current = true;
    setReactionPending(message.id);
    setReactionError(null);
    const current = () => mountedRef.current && activeOwner.current === owner;
    try {
      if (!(await onToggleReaction(message.id, reactionType))) throw new Error("Reaction wasn't saved. Please try again.");
    } catch (error) {
      if (current()) setReactionError({ messageId: message.id, text: error instanceof Error ? error.message : "Couldn't save this reaction. Please try again." });
    } finally {
      if (current()) { reactionLocked.current = false; setReactionPending(null); }
    }
  };

  const canSend = isOnline && !messagingDisabled && !actionPending && !reactionPending && (messageContent.trim().length > 0 || files.length > 0);

  return (
    <div data-shell-composer-active="true" className="flex h-full min-h-0 min-w-0 flex-col bg-card">
      {participantHeader && (
        <div className="border-b border-border/70 bg-card/95 p-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => openProfile(otherUser?.id)}
              className="flex min-w-0 items-center gap-3 text-left"
            >
              <Avatar className="h-11 w-11 border border-border/70">
                <AvatarImage src={otherUser?.avatar_url || undefined} />
                <AvatarFallback>{getInitials(otherUser?.display_name)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0">
                <span className="block truncate font-sans text-sm font-semibold">
                  {otherUser?.display_name || "Unknown Reader"}
                </span>
                <span className="block font-sans text-xs text-muted-foreground">
                  Private conversation
                </span>
              </span>
            </button>
            <Button ref={headerBlockRef} variant="outline" size="sm" onClick={(event) => startAction({ type: "block" }, event.currentTarget)} disabled={!otherUser?.id || sending || actionPending || Boolean(reactionPending)}>
              Block
            </Button>
          </div>
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden">
      <div ref={historyRef} role="region" aria-label="Message history" tabIndex={0}
        onScroll={(event) => {
          const history = event.currentTarget;
          followingLatest.current = history.scrollHeight - history.scrollTop - history.clientHeight < 48;
          setAwayFromLatest(!followingLatest.current);
        }}
        className={cn("h-full overflow-y-auto overflow-x-hidden touch-pan-y touch-pinch-zoom", isMobile ? "p-3" : "p-5")}>
        {messagingDisabled && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/[0.08] p-3">
            <p className="font-sans text-sm text-destructive">
              {unavailableMessage}
            </p>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center text-center text-muted-foreground">
            <div>
              <ChatBubble className="mx-auto mb-3 h-10 w-10 text-primary" />
              <p className="font-display text-lg font-semibold text-foreground">
                Start the conversation
              </p>
              <p className="mt-1 font-sans text-sm">Share a recommendation, quote, or reading note.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const grouped = shouldGroupWithPrevious(message, previous);
              const isOwnMessage = message.sender_id === currentUserId;
              const sender = isOwnMessage
                ? {
                    id: currentUserId,
                    display_name: profile?.display_name || "You",
                    avatar_url: profile?.avatar_url,
                  }
                : otherUser;

              return (
                <div
                  key={message.id}
                  className={cn("flex gap-2", isOwnMessage ? "justify-end" : "justify-start")}
                >
                  {!isOwnMessage && (
                    grouped ? (
                      <div className="h-[44px] w-[44px] shrink-0" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => openProfile(sender?.id)}
                        className="mt-1 flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full"
                        aria-label={`Open ${sender?.display_name || "reader"} profile`}
                      >
                        <Avatar className="h-[36px] w-[36px] border border-border/70">
                          <AvatarImage src={sender?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(sender?.display_name)}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    )
                  )}

                  <div
                    className={cn(
                      "group min-w-0 max-w-[calc(100%-52px)] space-y-1 sm:max-w-[80%]",
                      isOwnMessage && "items-end text-right"
                    )}
                  >
                    {!grouped && (
                      <button
                        type="button"
                        onClick={() => openProfile(sender?.id)}
                        className={cn(
                          "block font-sans text-xs font-medium text-muted-foreground hover:text-primary",
                          isOwnMessage && "ml-auto"
                        )}
                      >
                        {isOwnMessage ? "You" : sender?.display_name || "Reader"}
                      </button>
                    )}

                    <div className={cn("flex min-w-0 items-end gap-1", isOwnMessage && "flex-row-reverse")}>
                      <ReplyGesture key={`${currentUserId}:${conversationId}:${message.id}`} enabled={!message.deleted_at && !messagingDisabled && !sending && !actionPending && !reactionPending} onReply={() => startReply(message)}>
                      <div
                        className={cn(
                          "min-w-0 overflow-hidden rounded-2xl border px-3 py-2 text-left shadow-sm",
                          isOwnMessage
                            ? "rounded-br-md border-primary/30 bg-primary text-primary-foreground"
                            : "rounded-bl-md border-border bg-muted/60 text-foreground",
                          message.deleted_at && "bg-muted/30 text-muted-foreground"
                        )}
                      >
                        {message.deleted_at ? (
                          <p className="font-sans text-sm italic">Message deleted</p>
                        ) : (
                          <>
                            {message.reply_to_message_id && (
                              <div className="mb-2 rounded-md border border-current/20 px-2 py-1 text-xs opacity-80">
                                Reply
                              </div>
                            )}
                            {message.content && (
                              <p className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed [overflow-wrap:anywhere]">
                                {sanitizeText(message.content)}
                              </p>
                            )}
                            {message.media && message.media.length > 0 && (
                              <div
                                className={cn(
                                  "mt-2 grid gap-2",
                                  message.media.length === 1 ? "grid-cols-1" : "grid-cols-2"
                                )}
                              >
                                {message.media.map((item) => {
                                  const url = item.signed_url || item.preview_url || item.external_url;
                                  if (!url) {
                                    return (
                                      <div
                                        key={item.id || item.storage_path || item.provider_id}
                                        className="flex aspect-video items-center justify-center rounded-lg bg-background/40 text-xs"
                                      >
                                        Media unavailable
                                      </div>
                                    );
                                  }
                                  return (
                                    <button
                                      type="button"
                                      key={item.id || item.storage_path || item.provider_id}
                                      onClick={(event) => {
                                        mediaOpenerRef.current = event.currentTarget;
                                        setPreviewFailed(false);
                                        setPreviewMedia(url);
                                      }}
                                      aria-label={item.media_type === "gif" ? "Open message GIF" : "Open message image"}
                                      className="overflow-hidden rounded-lg border border-current/10 bg-background/10"
                                    >
                                      <img
                                        src={url}
                                        alt={item.media_type === "gif" ? "GIF" : "Message media"}
                                        className="max-h-64 w-full object-cover"
                                        loading="lazy"
                                      />
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      </ReplyGesture>

                      {!message.deleted_at && (
                        <Popover open={actionsOpen === message.id} onOpenChange={(open) => setActionsOpen(open ? message.id : null)}>
                          <PopoverTrigger asChild>
                            <Button
                              ref={(element) => { if (element) messageActionRefs.current.set(message.id, element); else messageActionRefs.current.delete(message.id); }}
                              size="icon"
                              variant="ghost"
                              className="h-[44px] w-[44px] shrink-0 text-muted-foreground [&_svg]:size-[20px]"
                              aria-label="Message actions"
                              aria-describedby={`${id}-${message.id}-actions-help`}
                            >
                              <MoreHoriz className="h-4 w-4" />
                              <span id={`${id}-${message.id}-actions-help`} className="sr-only">{isOwnMessage ? "Your message" : `Message from ${sender?.display_name || "reader"}`}: {previewText(message).slice(0, 120)}</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="max-h-[var(--radix-popover-content-available-height)] w-auto max-w-[calc(100vw-2rem)] overflow-y-auto p-2"
                            onCloseAutoFocus={(event) => {
                              if (replyFocusAfterClose.current) { event.preventDefault(); replyFocusAfterClose.current = false; composerRef.current?.focus(); }
                            }}>
                            {!messagingDisabled && (
                              <fieldset disabled={Boolean(reactionPending) || sending || actionPending || !isOnline}>
                              <ReactionBar
                                className="flex-wrap [&_button]:h-11 [&_button]:w-11 [&_button]:min-w-11"
                                currentReaction={message.current_user_reaction}
                                onToggle={(reactionType) => toggleReaction(message, reactionType)}
                              />
                              </fieldset>
                            )}
                            {reactionPending === message.id && <p role="status" className="text-sm text-muted-foreground">Saving reaction…</p>}
                            {reactionError?.messageId === message.id && <p role="alert" className="max-w-64 text-sm text-destructive">{reactionError.text}</p>}
                            <div className="mt-2 grid gap-1 border-t border-border pt-2">
                              {!messagingDisabled && (
                                <button
                                  type="button"
                                  className="flex min-h-11 items-center gap-2 rounded-md px-2 py-1.5 text-left font-sans text-sm hover:bg-muted"
                                  disabled={sending || actionPending || Boolean(reactionPending)}
                                  onClick={() => startReply(message)}
                                >
                                  <ChatBubble className="h-4 w-4" />
                                  Reply
                                </button>
                              )}
                              {message.content && (
                                <button
                                  type="button"
                                  className="flex min-h-11 items-center gap-2 rounded-md px-2 py-1.5 text-left font-sans text-sm hover:bg-muted"
                                  onClick={() => handleCopy(message)}
                                >
                                  <Copy className="h-4 w-4" />
                                  Copy
                                </button>
                              )}
                              {isOwnMessage && (
                                <button
                                  type="button"
                                  className="flex min-h-11 items-center gap-2 rounded-md px-2 py-1.5 text-left font-sans text-sm text-destructive hover:bg-destructive/10"
                                  disabled={sending || actionPending || Boolean(reactionPending)}
                                  onClick={(event) => startAction({ type: "delete", messageId: message.id }, messageActionRefs.current.get(message.id) || composerRef.current || event.currentTarget)}
                                >
                                  <Trash className="h-4 w-4" />
                                  Delete
                                </button>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>

                    <div
                      className={cn(
                        "flex flex-wrap items-center gap-1 text-xs text-muted-foreground",
                        isOwnMessage && "justify-end"
                      )}
                    >
                      <span>{formatTimestamp(message.created_at)}</span>
                      {message.reaction_counts &&
                        Object.keys(message.reaction_counts).length > 0 && (
                          <fieldset disabled={Boolean(reactionPending) || sending || actionPending || messagingDisabled || !isOnline}>
                          <ReactionBar
                            compact
                            className="[&_button]:min-h-11 [&_button]:min-w-11"
                            currentReaction={message.current_user_reaction}
                            reactionCounts={message.reaction_counts}
                            onToggle={(reactionType) => toggleReaction(message, reactionType)}
                          />
                          </fieldset>
                        )}
                    </div>
                    {reactionError?.messageId === message.id && actionsOpen !== message.id && <p role="alert" className="text-left text-sm text-destructive">{reactionError.text}</p>}
                    {reactionPending === message.id && actionsOpen !== message.id && <p role="status" className="text-left text-sm text-muted-foreground">Saving reaction…</p>}
                  </div>

                  {isOwnMessage && (
                    grouped ? (
                      <div className="h-[44px] w-[44px] shrink-0" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => openProfile(currentUserId)}
                        className="mt-1 flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full"
                        aria-label="Open your profile"
                      >
                        <Avatar className="h-[36px] w-[36px] border border-border/70">
                          <AvatarImage src={profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(profile?.display_name || "You")}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}

      {otherUserTyping && !messagingDisabled && (
          <TypingIndicator
            className="mt-3"
            users={[
              {
                id: otherUser?.id,
                name: otherUser?.display_name || "Reader",
                avatarUrl: otherUser?.avatar_url,
              },
            ]}
          />
        )}
      </div>
      {awayFromLatest && <Button type="button" variant="secondary" className="absolute bottom-3 left-1/2 h-auto max-w-[calc(100%-2rem)] -translate-x-1/2 whitespace-normal" onClick={() => {
        followingLatest.current = true;
        if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
        setAwayFromLatest(false);
      }}>Latest messages</Button>}
      </div>

      <div className={cn("shrink-0 border-t border-border/70 bg-card", isMobile ? "p-3 pb-safe" : "p-4")}>
        {!isOnline && (
          <div className="mb-2 rounded-md border border-border bg-muted/60 px-3 py-2 font-sans text-sm text-muted-foreground">
            Messages need a connection. You can keep writing while offline.
          </div>
        )}

        {replyingTo && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
            <div className="min-w-0">
              <p className="font-sans text-xs font-medium">Replying to</p>
              <p className="truncate font-sans text-sm text-muted-foreground">
                {previewText(replyingTo)}
              </p>
            </div>
            <Button size="icon" variant="ghost" className="h-[44px] w-[44px] shrink-0 [&_svg]:size-[20px]" disabled={sending} aria-label="Cancel reply" onClick={() => setReplyingTo(null)}>
              <Xmark className="h-4 w-4" />
            </Button>
          </div>
        )}

        {selectedFilePreviews.length > 0 && (
          <div className="mb-2 flex gap-2 overflow-x-auto rounded-md border border-border bg-muted/20 p-2">
            {selectedFilePreviews.map((preview) => (
              <div key={preview.url} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md">
                <img src={preview.url} alt={preview.file.name} className="h-full w-full object-cover" />
              </div>
            ))}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-[44px] w-[44px] shrink-0 [&_svg]:size-[20px]"
              disabled={sending}
              aria-label="Remove attached media"
              onClick={() => {
                setFiles([]);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              <Xmark className="h-4 w-4" />
            </Button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          aria-label="Attach message media"
          disabled={sending || messagingDisabled || !isOnline}
          onChange={(event) => handleFileChange(event.target.files)}
        />

        <label htmlFor={`${id}-message`} className="sr-only">Message</label>
        <p id={`${id}-message-help`} className="mb-2 text-xs text-muted-foreground">
          {messagingDisabled ? unavailableMessage : !isOnline ? "Connect to send. You can keep writing while offline." : "Enter sends; Shift+Enter adds a new line."}
        </p>
        {composerError && <p id={`${id}-composer-error`} role="alert" className="mb-2 text-sm text-destructive">{composerError.message}</p>}
        <p role="status" className={sending ? "mb-2 text-xs text-muted-foreground" : "sr-only"}>{sending ? "Sending message. You can keep writing your next draft." : ""}</p>

        <Textarea
          id={`${id}-message`}
          ref={composerRef}
          aria-describedby={`${id}-message-help${composerError ? ` ${id}-composer-error` : ""}`}
          aria-invalid={composerError?.invalid || undefined}
          placeholder={messagingDisabled ? "Messaging is unavailable" : "Message"}
          value={messageContent}
          onChange={handleInputChange}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
              event.preventDefault();
              handleSend();
            }
          }}
          rows={2}
          disabled={messagingDisabled}
          className="mb-2 max-h-32 min-h-11 min-w-0 resize-none"
        />
        <div className="flex flex-wrap items-end gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-[44px] w-[44px] [&_svg]:size-[20px]"
            onClick={() => fileInputRef.current?.click()}
            disabled={!isOnline || messagingDisabled || sending}
            aria-label="Attach image or GIF"
            aria-describedby={composerError?.target === "media" ? `${id}-composer-error` : undefined}
          >
            <Attachment className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-[44px] w-[44px] [&_svg]:size-[20px]"
            ref={gifOpenerRef}
            onClick={() => setGifOpen(true)}
            disabled={!isOnline || messagingDisabled || sending}
            aria-label="Search GIFs"
          >
            <MediaImage className="h-4 w-4" />
          </Button>

          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-[44px] w-[44px] [&_svg]:size-[20px]"
                disabled={!isOnline || messagingDisabled || sending}
                aria-label="Add emoji"
              >
                <Emoji className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="max-h-[var(--radix-popover-content-available-height)] w-auto max-w-[calc(100vw-2rem)] overflow-y-auto border-border p-0" align="end">
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                lazyLoadEmojis
                searchDisabled={false}
                previewConfig={{ showPreview: false }}
                height={360}
                width="min(320px, calc(100vw - 2rem))"
              />
            </PopoverContent>
          </Popover>

          {!participantHeader && <Popover open={conversationOptionsOpen} onOpenChange={setConversationOptionsOpen}>
            <PopoverTrigger asChild><Button ref={conversationOpenerRef} type="button" size="icon" variant="ghost" className="h-[44px] w-[44px] [&_svg]:size-[20px]" aria-label="Conversation options"><MoreHoriz aria-hidden className="h-4 w-4" /></Button></PopoverTrigger>
            <PopoverContent className="max-w-[calc(100vw-2rem)] p-2" align="end">
              <Button type="button" variant="ghost" className="w-full justify-start whitespace-normal text-left" disabled={!otherUser?.id || sending || actionPending || Boolean(reactionPending)}
                onClick={(event) => startAction({ type: "block" }, conversationOpenerRef.current || event.currentTarget)}>Block reader</Button>
            </PopoverContent>
          </Popover>}

          <Button
            disableHaptic
            onClick={handleSend}
            disabled={!canSend || sending}
            size="icon"
            className="ml-auto h-[44px] w-[44px] shrink-0 [&_svg]:size-[20px]"
            aria-label="Send message"
            aria-describedby={composerError ? `${id}-composer-error` : undefined}
            aria-busy={sending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <MobileDialog open={Boolean(actionTask)} onOpenChange={(open) => { if (!open && !actionLocked.current) setActionTask(null); }}
        title={actionTask?.type === "block" ? `Block ${otherUser?.display_name || "this reader"}?` : "Delete message?"}
        description={actionTask?.type === "block" ? "You will no longer be able to message each other." : "The message will be removed from this conversation. This cannot be undone."}
        returnFocusRef={actionReturnFocus}
        footer={<>
          <Button type="button" variant="outline" disabled={actionPending} onClick={() => setActionTask(null)}>Cancel</Button>
          <Button type="button" variant="outline" className="border-destructive text-foreground hover:bg-destructive/10" disabled={actionPending}
            onClick={() => void confirmAction()}>{actionPending ? "Saving…" : actionTask?.type === "block" ? "Block reader" : "Delete message"}</Button>
        </>}>
        {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
        {actionPending && <p role="status" className="text-sm text-muted-foreground">Saving this change. Please wait.</p>}
      </MobileDialog>

      <Dialog open={Boolean(previewMedia)} onOpenChange={(open) => !open && setPreviewMedia(null)}>
        <DialogContent className="max-h-[calc(var(--app-viewport-height,100dvh)-2rem)] max-w-3xl overflow-y-auto p-4" onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (mediaOpenerRef.current?.isConnected) mediaOpenerRef.current.focus();
          else composerRef.current?.focus();
        }}>
          <DialogHeader className="pr-12 text-left">
            <DialogTitle>Message media</DialogTitle>
            <DialogDescription>Full-size media from this conversation.</DialogDescription>
          </DialogHeader>
          {previewFailed && <p role="alert" className="text-sm text-destructive">This media could not load. Close the preview and try again.</p>}
          {previewMedia && !previewFailed && (
            <img
              src={previewMedia}
              alt="Message media preview"
              onError={() => setPreviewFailed(true)}
              className="max-h-[65dvh] w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={gifOpen} onOpenChange={(open) => { if (!sendingRef.current) setGifOpen(open); }}>
        <DialogContent className="max-h-[min(42rem,calc(var(--app-viewport-height,100dvh)-2rem))] max-w-2xl overflow-y-auto" onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (gifOpenerRef.current?.isConnected) gifOpenerRef.current.focus();
          else composerRef.current?.focus();
        }}>
          <DialogHeader>
            <DialogTitle>Search GIFs</DialogTitle>
            <DialogDescription>Powered by Tenor. Choose a lightweight GIF for this chat.</DialogDescription>
          </DialogHeader>
          {gifError && <p id={`${id}-gif-error`} role="alert" className="text-sm text-destructive">{gifError}</p>}
          <p role="status" className={sending ? "text-sm text-muted-foreground" : "sr-only"}>{sending ? "Sending GIF. Please wait." : ""}</p>
          {files.length > 0 && <p className="text-sm text-muted-foreground">Attached images stay in your draft when you send a GIF.</p>}
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-0 flex-[1_1_12rem]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search GIFs"
                aria-describedby={gifError ? `${id}-gif-error` : undefined}
                disabled={sending}
                value={gifQuery}
                onChange={(event) => setGifQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) void handleGifSearch();
                }}
                placeholder="Search GIFs"
                className="pl-9"
              />
            </div>
            <Button onClick={handleGifSearch} disabled={gifSearching || sending || !gifQuery.trim()}>
              {gifSearching ? "Searching..." : "Search"}
            </Button>
          </div>

          {gifResults.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-border text-center">
              <p className="font-sans text-sm text-muted-foreground">
                Search for a reaction, scene, or mood.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {gifResults.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => submitMessage(gif)}
                  disabled={sending || actionPending || Boolean(reactionPending) || !isOnline || messagingDisabled}
                  aria-label={`Send GIF: ${gif.title}`}
                  aria-describedby={gifError ? `${id}-gif-error` : undefined}
                  className="overflow-hidden rounded-md border border-border bg-muted transition hover:border-primary"
                >
                  <img src={gif.preview_url} alt={gif.title} className="aspect-video w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
