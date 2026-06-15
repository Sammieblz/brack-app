import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react";
import {
  Attachment,
  ChatBubble,
  Copy,
  Emoji,
  MediaImage,
  Search,
  Send,
  Trash,
  Xmark,
} from "iconoir-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { TypingIndicator } from "@/components/messaging/TypingIndicator";
import { ReactionBar } from "@/components/reactions/ReactionBar";
import { useClubChatTypingIndicator } from "@/hooks/useClubChatTypingIndicator";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useProfileContext } from "@/contexts/ProfileContext";
import { cn } from "@/lib/utils";
import { sanitizeInput, sanitizeText } from "@/utils/sanitize";
import {
  deleteClubChatMessage,
  getClubChatHistory,
  markClubChatRead,
  searchGifs,
  sendClubChatMessage,
  subscribeToClubChat,
  toggleClubChatReaction,
  uploadClubChatMediaFiles,
  type ClubChatMessage,
  type ClubChatReactionType,
  type ClubMember,
  type GifSearchResult,
} from "@/services/api";
import { toast } from "sonner";

interface ClubChatThreadProps {
  clubId: string;
  members: ClubMember[];
  currentUserId?: string;
  canModerate?: boolean;
}

const getInitials = (name?: string | null) => {
  if (!name) return "R";
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
  const sameDay = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return time;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
};

const shouldGroupWithPrevious = (message: ClubChatMessage, previous?: ClubChatMessage) => {
  if (!previous) return false;
  if (message.user_id !== previous.user_id) return false;
  const delta = new Date(message.created_at).getTime() - new Date(previous.created_at).getTime();
  return delta >= 0 && delta < 5 * 60 * 1000;
};

const previewText = (message: ClubChatMessage) => {
  if (message.deleted_at) return "Deleted message";
  if (message.content) return sanitizeText(message.content);
  if (message.message_type === "gif") return "GIF";
  return "Media";
};

export const ClubChatThread = ({
  clubId,
  members,
  currentUserId,
  canModerate = false,
}: ClubChatThreadProps) => {
  const [messages, setMessages] = useState<ClubChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ClubChatMessage | null>(null);
  const [previewMedia, setPreviewMedia] = useState<string | null>(null);
  const [gifOpen, setGifOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState<GifSearchResult[]>([]);
  const [gifSearching, setGifSearching] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
  const isOnline = useNetworkStatus();
  const { profile } = useProfileContext();

  const currentTypingUser = useMemo(
    () =>
      currentUserId
        ? {
            id: currentUserId,
            name: profile?.display_name || "You",
            avatarUrl: profile?.avatar_url,
          }
        : null,
    [currentUserId, profile?.avatar_url, profile?.display_name]
  );
  const { typingUsers, setTyping } = useClubChatTypingIndicator(clubId, currentTypingUser);

  const membersById = useMemo(
    () => new Map(members.map((member) => [member.user_id, member])),
    [members]
  );

  const currentMention = useMemo(() => {
    const match = content.match(/(?:^|\s)@([\w\s-]{0,32})$/);
    return match?.[1]?.toLowerCase() ?? null;
  }, [content]);

  const mentionMatches = useMemo(() => {
    if (currentMention == null) return [];
    return members
      .filter((member) => member.user_id !== currentUserId)
      .filter((member) =>
        (member.user?.display_name || "Reader").toLowerCase().includes(currentMention)
      )
      .slice(0, 5);
  }, [currentMention, currentUserId, members]);

  const selectedFilePreviews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files]
  );

  useEffect(() => {
    return () => selectedFilePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [selectedFilePreviews]);

  const loadMessages = async () => {
    try {
      const response = await getClubChatHistory(clubId);
      setMessages(response.messages || []);
      const latest = response.messages?.[response.messages.length - 1];
      if (latest) void markClubChatRead(clubId, latest.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load club chat");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void loadMessages();
    const unsubscribe = subscribeToClubChat(clubId, () => void loadMessages());
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers.length]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      void setTyping(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  const openProfile = (userId?: string | null) => {
    if (userId) navigate(`/users/${userId}`);
  };

  const validateFiles = (selected: File[]) => {
    if (selected.length > 4) throw new Error("Club chat messages can include up to 4 media items");
    for (const file of selected) {
      if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
        throw new Error(`${file.name} is not a supported image or GIF`);
      }
      if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} must be 10 MB or smaller`);
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
    setContent("");
    setFiles([]);
    setReplyingTo(null);
    setMentionIds([]);
    void setTyping(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    void setTyping(Boolean(value.trim()));
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => void setTyping(false), 2200);
  };

  const handleSend = async (gif?: GifSearchResult) => {
    if (sending || !isOnline) return;
    if (!content.trim() && files.length === 0 && !gif) return;
    try {
      setSending(true);
      const media = files.length > 0 ? await uploadClubChatMediaFiles(files, clubId) : [];
      const message = await sendClubChatMessage({
        club_id: clubId,
        content: content.trim() ? sanitizeInput(content) : null,
        media,
        gif: gif || null,
        reply_to_message_id: replyingTo?.id || null,
        mention_ids: mentionIds,
      });
      setMessages((current) => [...current.filter((item) => item.id !== message.id), message]);
      clearComposer();
      setGifOpen(false);
      setGifResults([]);
      setGifQuery("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleGifSearch = async () => {
    if (!gifQuery.trim()) return;
    try {
      setGifSearching(true);
      const response = await searchGifs(gifQuery);
      setGifResults(response.results || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to search GIFs");
    } finally {
      setGifSearching(false);
    }
  };

  const handleToggleReaction = async (messageId: string, reactionType: ClubChatReactionType) => {
    try {
      const response = await toggleClubChatReaction(messageId, reactionType);
      setMessages((current) =>
        current.map((message) => (message.id === messageId ? response.message : message))
      );
    } catch {
      toast.error("Failed to update reaction");
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      const message = await deleteClubChatMessage(messageId);
      setMessages((current) => current.map((item) => (item.id === messageId ? message : item)));
      toast.success("Message removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove message");
    }
  };

  const insertMention = (member: ClubMember) => {
    const displayName = member.user?.display_name || "Reader";
    setContent((value) => value.replace(/(?:^|\s)@([\w\s-]{0,32})$/, ` @${displayName} `));
    setMentionIds((ids) => Array.from(new Set([...ids, member.user_id])));
  };

  const handleEmojiClick = (emoji: EmojiClickData) => {
    setContent((value) => `${value}${emoji.emoji}`);
    setEmojiOpen(false);
  };

  const canSend = isOnline && (content.trim().length > 0 || files.length > 0);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border/70 px-4 py-3">
        <p className="font-display text-xl font-semibold">Club Chat</p>
        <p className="font-sans text-sm text-muted-foreground">
          Fast member-only conversation. Keep long-form threads in Discussions.
        </p>
      </div>

      <div className="h-[min(44rem,calc(var(--app-viewport-height,100dvh)-17rem))] min-h-[28rem] overflow-y-auto p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center font-sans text-sm text-muted-foreground">
            Loading chat...
          </div>
        ) : messages.length === 0 ? (
          <PremiumEmptyState
            asset="emptyMessages"
            title="No club messages yet"
            description="Start with an emoji, a reading update, or a quick prompt."
            size="compact"
          />
        ) : (
          <div className="space-y-2">
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const grouped = shouldGroupWithPrevious(message, previous);
              const isOwn = message.user_id === currentUserId;
              const member = membersById.get(message.user_id);
              const sender = isOwn
                ? { id: currentUserId, display_name: profile?.display_name || "You", avatar_url: profile?.avatar_url }
                : message.user || member?.user;
              const canDelete = isOwn || canModerate;

              return (
                <div key={message.id} className={cn("flex gap-2", isOwn && "justify-end")}>
                  {!isOwn && (
                    grouped ? (
                      <div className="h-9 w-9 shrink-0" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => openProfile(message.user_id)}
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

                  <div className={cn("group max-w-[82%] space-y-1 sm:max-w-[72%]", isOwn && "text-right")}>
                    {!grouped && (
                      <button
                        type="button"
                        onClick={() => openProfile(message.user_id)}
                        className={cn(
                          "block font-sans text-xs font-medium text-muted-foreground hover:text-primary",
                          isOwn && "ml-auto"
                        )}
                      >
                        {isOwn ? "You" : sender?.display_name || "Reader"}
                      </button>
                    )}

                    <div className={cn("flex items-end gap-2", isOwn && "flex-row-reverse")}>
                      <div
                        className={cn(
                          "overflow-hidden rounded-2xl border px-3 py-2 text-left shadow-sm animate-in fade-in-0 slide-in-from-bottom-1",
                          isOwn
                            ? "rounded-br-md border-primary/30 bg-primary text-primary-foreground"
                            : "rounded-bl-md border-border bg-muted/60 text-foreground",
                          message.deleted_at && "bg-muted/30 text-muted-foreground"
                        )}
                      >
                        {message.deleted_at ? (
                          <p className="font-sans text-sm italic">Message deleted</p>
                        ) : (
                          <>
                            {message.reply_to_message && (
                              <div className="mb-2 rounded-md border border-current/20 px-2 py-1 text-xs opacity-80">
                                Reply to {message.reply_to_message.user?.display_name || "reader"}:{" "}
                                {previewText(message.reply_to_message as ClubChatMessage)}
                              </div>
                            )}
                            {message.content && (
                              <p className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
                                {sanitizeText(message.content)}
                              </p>
                            )}
                            {message.media && message.media.length > 0 && (
                              <div className={cn("mt-2 grid gap-2", message.media.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
                                {message.media.map((item) => {
                                  const url = item.signed_url || item.preview_url || item.external_url;
                                  if (!url) {
                                    return (
                                      <div key={item.id || item.storage_path || item.provider_id} className="flex aspect-video items-center justify-center rounded-lg bg-background/40 text-xs">
                                        Media unavailable
                                      </div>
                                    );
                                  }
                                  return (
                                    <button
                                      key={item.id || item.storage_path || item.provider_id}
                                      type="button"
                                      onClick={() => setPreviewMedia(url)}
                                      className="overflow-hidden rounded-lg border border-current/10 bg-background/10"
                                    >
                                      <img
                                        src={url}
                                        alt={item.media_type === "gif" ? "GIF" : "Club chat media"}
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
                            <ReactionBar
                              currentReaction={message.current_user_reaction}
                              onToggle={(reactionType) => handleToggleReaction(message.id, reactionType)}
                            />
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
                                  onClick={async () => {
                                    await navigator.clipboard.writeText(message.content || "");
                                    toast.success("Message copied");
                                  }}
                                >
                                  <Copy className="h-4 w-4" />
                                  Copy
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left font-sans text-sm text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDelete(message.id)}
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

                    <div className={cn("flex flex-wrap items-center gap-1 text-xs text-muted-foreground", isOwn && "justify-end")}>
                      <span>{formatTimestamp(message.created_at)}</span>
                      {message.reaction_counts && Object.keys(message.reaction_counts).length > 0 && (
                        <ReactionBar
                          compact
                          currentReaction={message.current_user_reaction}
                          reactionCounts={message.reaction_counts}
                          onToggle={(reactionType) => handleToggleReaction(message.id, reactionType)}
                        />
                      )}
                    </div>
                  </div>

                  {isOwn && (
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
            <TypingIndicator
              users={typingUsers.map((user) => ({
                id: user.userId,
                name: user.name,
                avatarUrl: user.avatarUrl,
              }))}
            />
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-border/70 bg-card p-3">
        {!isOnline && (
          <div className="mb-2 rounded-md border border-border bg-muted/60 px-3 py-2 font-sans text-sm text-muted-foreground">
            Club chat needs a connection.
          </div>
        )}
        {replyingTo && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
            <div className="min-w-0">
              <p className="font-sans text-xs font-medium">Replying to</p>
              <p className="truncate font-sans text-sm text-muted-foreground">{previewText(replyingTo)}</p>
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

        {mentionMatches.length > 0 && (
          <div className="mb-2 max-h-48 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-sm">
            {mentionMatches.map((member) => (
              <button
                key={member.user_id}
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-accent"
                onClick={() => insertMention(member)}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={member.user?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">{getInitials(member.user?.display_name)}</AvatarFallback>
                </Avatar>
                <span className="font-sans text-sm">{member.user?.display_name || "Reader"}</span>
              </button>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(event: ChangeEvent<HTMLInputElement>) => handleFileChange(event.target.files)}
        />

        <div className="flex items-end gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            disabled={!isOnline || sending}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach image or GIF"
          >
            <Attachment className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            disabled={!isOnline || sending}
            onClick={() => setGifOpen(true)}
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
                disabled={!isOnline || sending}
                aria-label="Add emoji"
              >
                <Emoji className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto border-border p-0" align="end">
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                lazyLoadEmojis
                previewConfig={{ showPreview: false }}
                height={360}
                width={320}
              />
            </PopoverContent>
          </Popover>
          <Textarea
            value={content}
            onChange={(event) => handleContentChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Message the club. Use @ to mention a member."
            rows={1}
            className="max-h-32 min-h-11 resize-none"
          />
          <Button
            type="button"
            onClick={() => void handleSend()}
            disabled={!canSend || sending}
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label="Send club message"
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
              alt="Club chat media preview"
              className="max-h-[80vh] w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={gifOpen} onOpenChange={setGifOpen}>
        <DialogContent className="max-h-[min(42rem,calc(var(--app-viewport-height,100dvh)-2rem))] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Search GIFs</DialogTitle>
            <DialogDescription>Choose a lightweight GIF for club chat.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={gifQuery}
                onChange={(event) => setGifQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleGifSearch();
                }}
                placeholder="Search GIFs"
                className="pl-9"
              />
            </div>
            <Button onClick={() => void handleGifSearch()} disabled={gifSearching || !gifQuery.trim()}>
              {gifSearching ? "Searching..." : "Search"}
            </Button>
          </div>
          {gifResults.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-border text-center">
              <p className="font-sans text-sm text-muted-foreground">Search for a reaction, scene, or mood.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {gifResults.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => void handleSend(gif)}
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
