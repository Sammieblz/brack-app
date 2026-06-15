import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ChatBubble,
  MediaImage,
  NavArrowDown,
  NavArrowRight,
  Pin,
  Send,
  Trash,
  VideoCamera,
} from "iconoir-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RichTextEditor } from "@/components/rich-text/RichTextEditor";
import { RichTextRenderer } from "@/components/rich-text/RichTextRenderer";
import { toPlainRichTextPayload } from "@/lib/richText";
import { cn } from "@/lib/utils";
import type { ClubDiscussion, ClubMedia } from "@/services/api";
import type { RichTextPayload } from "@/types/richText";

interface DiscussionThreadProps {
  discussion: ClubDiscussion;
  onReply: (parentId: string, data: RichTextPayload & { files?: File[] }) => Promise<void>;
  onDelete: (discussionId: string) => Promise<void>;
  onPin?: (discussionId: string) => Promise<void>;
  currentUserId?: string;
  canModerate?: boolean;
}

export const DiscussionThread = (props: DiscussionThreadProps) => (
  <Card className="animate-fade-in overflow-hidden border-border/60 bg-card">
    <CardContent className="p-0">
      <DiscussionNode {...props} depth={0} />
    </CardContent>
  </Card>
);

const DiscussionNode = ({
  discussion,
  onReply,
  onDelete,
  onPin,
  currentUserId,
  canModerate = false,
  depth,
}: DiscussionThreadProps & { depth: number }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState<RichTextPayload>(() => toPlainRichTextPayload(""));
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const replies = discussion.replies || [];
  const canDelete = currentUserId === discussion.user_id || canModerate;
  const hasChildren = replies.length > 0;
  const canCollapse = hasChildren || discussion.content.length > 180 || Boolean(discussion.media?.length);

  const handleReply = async () => {
    if (!replyText.content.trim()) return;
    try {
      setSubmitting(true);
      await onReply(discussion.id, {
        content: replyText.content.trim(),
        content_format: replyText.content_format,
        content_json: replyText.content_json,
        content_html: replyText.content_html,
        files: replyFiles,
      });
      setReplyText(toPlainRichTextPayload(""));
      setReplyFiles([]);
      setShowReplyForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article
      className={cn(
        "relative",
        depth === 0 ? "p-4 sm:p-5" : "ml-3 border-l border-border/70 py-3 pl-4 sm:ml-6",
      )}
    >
      {depth > 0 && (
        <span className="absolute -left-px top-8 h-6 w-px bg-primary/50" aria-hidden="true" />
      )}

      <div className="flex items-start gap-3">
        <Avatar className={cn("shrink-0 border border-primary/20", depth === 0 ? "h-10 w-10" : "h-8 w-8")}>
          <AvatarImage src={discussion.user?.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-xs">
            {getInitials(discussion.user?.display_name || "Reader")}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {canCollapse && (
              <button
                type="button"
                onClick={() => setCollapsed((value) => !value)}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary hover:text-primary"
                aria-label={collapsed ? "Expand thread" : "Collapse thread"}
              >
                {collapsed ? <NavArrowRight className="h-3.5 w-3.5" /> : <NavArrowDown className="h-3.5 w-3.5" />}
              </button>
            )}
            <span className="font-sans text-sm font-semibold">
              {discussion.user?.display_name || "Unknown Reader"}
            </span>
            <span className="font-sans text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(discussion.created_at), { addSuffix: true })}
            </span>
            {discussion.is_pinned && (
              <Badge variant="outline" className="gap-1">
                <Pin className="h-3 w-3" />
                Pinned
              </Badge>
            )}
            {discussion.discussion_type === "announcement" && (
              <Badge variant="secondary">Announcement</Badge>
            )}
            {collapsed && hasChildren && (
              <Badge variant="outline">{replies.length} repl{replies.length === 1 ? "y" : "ies"}</Badge>
            )}
          </div>

          {discussion.title && depth === 0 && (
            <h4 className="mt-2 font-display text-lg font-semibold leading-tight text-foreground">
              {discussion.title}
            </h4>
          )}

          {!collapsed && (
            <>
              <RichTextRenderer
                content={discussion.content}
                contentFormat={discussion.content_format}
                contentJson={discussion.content_json}
                contentHtml={discussion.content_html}
                className="mt-2 font-serif text-sm leading-relaxed text-foreground"
              />
              <DiscussionMediaGallery media={discussion.media || []} />
            </>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReplyForm((value) => !value)}
              className="h-8 gap-1 px-2 text-xs"
            >
              <ChatBubble className="h-3.5 w-3.5" />
              Reply
            </Button>
            {canModerate && onPin && depth === 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onPin(discussion.id)}
                className="h-8 gap-1 px-2 text-xs"
              >
                <Pin className="h-3.5 w-3.5" />
                {discussion.is_pinned ? "Unpin" : "Pin"}
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(discussion.id)}
                className="h-8 gap-1 px-2 text-xs text-destructive hover:text-destructive"
              >
                <Trash className="h-3.5 w-3.5" />
                Delete
              </Button>
            )}
          </div>

          {showReplyForm && (
            <div className="mt-3 rounded-xl border border-border/70 bg-muted/20 p-3">
              <RichTextEditor
                value={replyText}
                onChange={setReplyText}
                placeholder="Write your reply..."
                minHeightClassName="min-h-28"
              />
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-2 font-sans text-xs text-muted-foreground transition hover:border-primary hover:text-primary">
                  <MediaImage className="h-4 w-4" />
                  {replyFiles.length > 0 ? `${replyFiles.length} selected` : "Attach media"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                    multiple
                    className="sr-only"
                    onChange={(event) => setReplyFiles(Array.from(event.target.files || []))}
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowReplyForm(false);
                      setReplyText(toPlainRichTextPayload(""));
                      setReplyFiles([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleReply} disabled={submitting || !replyText.content.trim()}>
                    <Send className="mr-1 h-3.5 w-3.5" />
                    {submitting ? "Posting..." : "Post Reply"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!collapsed && hasChildren && (
            <div className="mt-3 space-y-1">
              {replies.map((reply) => (
                <DiscussionNode
                  key={reply.id}
                  discussion={reply}
                  onReply={onReply}
                  onDelete={onDelete}
                  onPin={onPin}
                  currentUserId={currentUserId}
                  canModerate={canModerate}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

const DiscussionMediaGallery = ({ media }: { media: ClubMedia[] }) => {
  if (media.length === 0) return null;
  return (
    <div
      className={cn(
        "mt-3 grid gap-2",
        media.length === 1 ? "grid-cols-1" : "grid-cols-2",
        media.length > 2 && "sm:grid-cols-3",
      )}
    >
      {media.map((item) => (
        <div
          key={item.storage_path}
          className="overflow-hidden rounded-xl border border-border/70 bg-muted/20"
        >
          {item.media_type === "video" ? (
            <video
              src={item.signed_url || undefined}
              controls
              preload="metadata"
              className="max-h-80 w-full bg-black object-contain"
            >
              <track kind="captions" />
            </video>
          ) : (
            <img
              src={item.signed_url || undefined}
              alt={item.alt_text || ""}
              className="max-h-80 w-full object-cover"
              loading="lazy"
            />
          )}
          {item.media_type === "video" && (
            <div className="flex items-center gap-2 px-3 py-2 font-sans text-xs text-muted-foreground">
              <VideoCamera className="h-4 w-4" />
              Video
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
