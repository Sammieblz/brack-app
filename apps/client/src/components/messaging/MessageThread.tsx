import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Attachment,
  ChatBubble,
  Copy,
  Emoji,
  MediaImage,
  Search,
  Send,
  Trash,
  WarningTriangle,
  Xmark,
} from "iconoir-react";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useProfileContext } from "@/contexts/ProfileContext";
import { blockUser, searchMessageGifs, uploadMessageMediaFiles } from "@/services/api";
import type {
  GifSearchResult,
  Message,
  MessageReactionType,
  SendMessageRequest,
} from "@/services/api";
import { sanitizeText, sanitizeInput } from "@/utils/sanitize";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const REACTIONS: Array<{ type: MessageReactionType; label: string; title: string }> = [
  { type: "like", label: "+1", title: "Like" },
  { type: "dislike", label: "-1", title: "Dislike" },
  { type: "heart", label: "<3", title: "Heart" },
  { type: "laugh", label: "Ha", title: "Laugh" },
  { type: "wow", label: "Wow", title: "Wow" },
  { type: "thanks", label: "Thx", title: "Thanks" },
];

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
  onBack?: () => void;
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
}: MessageThreadProps) => {
  const [messageContent, setMessageContent] = useState("");
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [previewMedia, setPreviewMedia] = useState<string | null>(null);
  const [gifOpen, setGifOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState<GifSearchResult[]>([]);
  const [gifSearching, setGifSearching] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { otherUserTyping, setTyping } = useTypingIndicator(conversationId, currentUserId);
  const { triggerHaptic } = useHapticFeedback();
  const isMobile = useIsMobile();
  const isOnline = useNetworkStatus();
  const navigate = useNavigate();
  const { profile } = useProfileContext();

  const draftKey = conversationId ? `message_draft_${conversationId}` : null;
  const selectedFilePreviews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files]
  );

  useEffect(() => {
    return () => selectedFilePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [selectedFilePreviews]);

  useEffect(() => {
    if (!draftKey) return;
    setMessageContent(localStorage.getItem(draftKey) || "");
    setFiles([]);
    setReplyingTo(null);
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return;
    localStorage.setItem(draftKey, messageContent);
  }, [draftKey, messageContent]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const openProfile = (userId?: string | null) => {
    if (userId) navigate(`/users/${userId}`);
  };

  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setMessageContent(event.target.value);
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
    try {
      const selected = Array.from(fileList || []);
      validateFiles(selected);
      setFiles(selected);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid media");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const clearComposer = () => {
    setMessageContent("");
    setFiles([]);
    setReplyingTo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (draftKey) localStorage.removeItem(draftKey);
  };

  const handleSend = async () => {
    if (sending || !conversationId || isBlocked || !isOnline) return;
    if (!messageContent.trim() && files.length === 0) return;
    if (messageContent.length > 5000) {
      triggerHaptic("error");
      toast.error("Message must be less than 5000 characters");
      return;
    }

    try {
      triggerHaptic("light");
      setSending(true);
      setTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      const media = files.length > 0 ? await uploadMessageMediaFiles(files) : [];
      const success = await onSendMessage({
        content: sanitizeInput(messageContent),
        media,
        reply_to_message_id: replyingTo?.id || null,
      });

      if (success) {
        clearComposer();
        triggerHaptic("success");
      }
    } finally {
      setSending(false);
    }
  };

  const handleGifSearch = async () => {
    if (!gifQuery.trim()) return;
    try {
      setGifSearching(true);
      const response = await searchMessageGifs(gifQuery);
      setGifResults(response.results || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to search GIFs");
    } finally {
      setGifSearching(false);
    }
  };

  const handleSendGif = async (gif: GifSearchResult) => {
    if (sending || !isOnline || isBlocked) return;
    try {
      setSending(true);
      const success = await onSendMessage({
        content: messageContent.trim() ? sanitizeInput(messageContent) : null,
        gif,
        reply_to_message_id: replyingTo?.id || null,
      });
      if (success) {
        clearComposer();
        setGifOpen(false);
        setGifResults([]);
        setGifQuery("");
      }
    } finally {
      setSending(false);
    }
  };

  const handleCopy = async (message: Message) => {
    if (!message.content) return;
    await navigator.clipboard.writeText(message.content);
    toast.success("Message copied");
  };

  const handleBlock = async () => {
    if (!otherUser?.id) return;
    const confirmed = window.confirm(
      `Block ${otherUser.display_name || "this reader"}? You will no longer be able to message each other.`
    );
    if (!confirmed) return;
    try {
      await blockUser(otherUser.id);
      toast.success("Reader blocked");
      window.dispatchEvent(new Event("messages-changed"));
    } catch {
      toast.error("Failed to block reader");
    }
  };

  const canSend = isOnline && !isBlocked && (messageContent.trim().length > 0 || files.length > 0);

  return (
    <div className="flex h-full flex-col bg-card">
      {!isMobile && (
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
            <Button variant="outline" size="sm" onClick={handleBlock} disabled={!otherUser?.id}>
              Block
            </Button>
          </div>
        </div>
      )}

      <div className={cn("min-h-0 flex-1 overflow-y-auto", isMobile ? "p-3" : "p-5")}>
        {isBlocked && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/8 p-3">
            <p className="font-sans text-sm text-destructive">
              Messaging is disabled because one of you blocked the other. Existing text history is
              still visible.
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
                  onContextMenu={(event) => event.preventDefault()}
                >
                  {!isOwnMessage && (
                    grouped ? (
                      <div className="h-9 w-9 shrink-0" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => openProfile(sender?.id)}
                        className="mt-1 shrink-0 rounded-full"
                        aria-label={`Open ${sender?.display_name || "reader"} profile`}
                      >
                        <Avatar className="h-9 w-9 border border-border/70">
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
                      "group max-w-[82%] space-y-1 sm:max-w-[70%]",
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

                    <div className={cn("flex items-end gap-2", isOwnMessage && "flex-row-reverse")}>
                      <div
                        className={cn(
                          "overflow-hidden rounded-2xl border px-3 py-2 text-left shadow-sm",
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
                              <p className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
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
                                      onClick={() => setPreviewMedia(url)}
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

                      {!message.deleted_at && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                              aria-label="Message actions"
                            >
                              <Emoji className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-2">
                            <div className="flex gap-1">
                              {REACTIONS.map((reaction) => (
                                <Button
                                  key={reaction.type}
                                  type="button"
                                  variant={
                                    message.current_user_reaction === reaction.type ? "default" : "ghost"
                                  }
                                  size="icon"
                                  className="h-9 w-9"
                                  title={reaction.title}
                                  onClick={() => onToggleReaction(message.id, reaction.type)}
                                >
                                  <span aria-hidden>{reaction.label}</span>
                                  <span className="sr-only">{reaction.title}</span>
                                </Button>
                              ))}
                            </div>
                            <div className="mt-2 grid gap-1 border-t border-border pt-2">
                              <button
                                type="button"
                                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left font-sans text-sm hover:bg-muted"
                                onClick={() => setReplyingTo(message)}
                              >
                                <ChatBubble className="h-4 w-4" />
                                Reply
                              </button>
                              {message.content && (
                                <button
                                  type="button"
                                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left font-sans text-sm hover:bg-muted"
                                  onClick={() => handleCopy(message)}
                                >
                                  <Copy className="h-4 w-4" />
                                  Copy
                                </button>
                              )}
                              {isOwnMessage ? (
                                <button
                                  type="button"
                                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left font-sans text-sm text-destructive hover:bg-destructive/10"
                                  onClick={() => onDeleteMessage(message.id)}
                                >
                                  <Trash className="h-4 w-4" />
                                  Delete
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left font-sans text-sm text-destructive hover:bg-destructive/10"
                                  onClick={() => toast.success("Message reported. Thank you.")}
                                >
                                  <WarningTriangle className="h-4 w-4" />
                                  Report
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
                        REACTIONS.filter((reaction) => message.reaction_counts?.[reaction.type]).map(
                          (reaction) => (
                            <button
                              key={reaction.type}
                              type="button"
                              className={cn(
                                "rounded-full border border-border bg-background px-1.5 py-0.5 text-xs",
                                message.current_user_reaction === reaction.type &&
                                  "border-primary bg-primary/10 text-primary"
                              )}
                              onClick={() => onToggleReaction(message.id, reaction.type)}
                              title={reaction.title}
                            >
                              {reaction.label} {message.reaction_counts?.[reaction.type]}
                            </button>
                          )
                        )}
                    </div>
                  </div>

                  {isOwnMessage && (
                    grouped ? (
                      <div className="h-9 w-9 shrink-0" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => openProfile(currentUserId)}
                        className="mt-1 shrink-0 rounded-full"
                        aria-label="Open your profile"
                      >
                        <Avatar className="h-9 w-9 border border-border/70">
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

        {otherUserTyping && !isBlocked && (
          <div className="mt-3 flex gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={otherUser?.avatar_url || undefined} />
              <AvatarFallback className="text-xs">{getInitials(otherUser?.display_name)}</AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-1 rounded-2xl bg-muted px-3 py-2">
              <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/40" />
              <span
                className="h-2 w-2 animate-bounce rounded-full bg-foreground/40"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="h-2 w-2 animate-bounce rounded-full bg-foreground/40"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={cn("border-t border-border/70 bg-card", isMobile ? "p-3 pb-safe" : "p-4")}>
        {!isOnline && (
          <div className="mb-2 rounded-md border border-border bg-muted/60 px-3 py-2 font-sans text-sm text-muted-foreground">
            Messages need a connection. Your draft is saved on this device.
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
            <Button size="icon" variant="ghost" onClick={() => setReplyingTo(null)}>
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
              className="shrink-0"
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
          onChange={(event) => handleFileChange(event.target.files)}
        />

        <div className="flex items-end gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={!isOnline || Boolean(isBlocked) || sending}
            aria-label="Attach image or GIF"
          >
            <Attachment className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => setGifOpen(true)}
            disabled={!isOnline || Boolean(isBlocked) || sending}
            aria-label="Search GIFs"
          >
            <MediaImage className="h-4 w-4" />
          </Button>

          <Textarea
            placeholder={isBlocked ? "Messaging is disabled" : "Message"}
            value={messageContent}
            onChange={handleInputChange}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            disabled={Boolean(isBlocked)}
            className="max-h-32 min-h-11 resize-none"
          />

          <Button
            onClick={handleSend}
            disabled={!canSend || sending}
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={Boolean(previewMedia)} onOpenChange={(open) => !open && setPreviewMedia(null)}>
        <DialogContent className="max-w-3xl p-3">
          {previewMedia && (
            <img
              src={previewMedia}
              alt="Message media preview"
              className="max-h-[80vh] w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={gifOpen} onOpenChange={setGifOpen}>
        <DialogContent className="max-h-[min(42rem,calc(var(--app-viewport-height,100dvh)-2rem))] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Search GIFs</DialogTitle>
            <DialogDescription>Powered by Tenor. Choose a lightweight GIF for this chat.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={gifQuery}
                onChange={(event) => setGifQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleGifSearch();
                }}
                placeholder="Search GIFs"
                className="pl-9"
              />
            </div>
            <Button onClick={handleGifSearch} disabled={gifSearching || !gifQuery.trim()}>
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
                  onClick={() => handleSendGif(gif)}
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
