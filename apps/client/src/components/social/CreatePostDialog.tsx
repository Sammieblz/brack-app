import { forwardRef, useEffect, useId, useMemo, useRef, useState, type ComponentPropsWithoutRef, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AdaptiveDialogContent, AdaptiveDialogDescription, AdaptiveDialogHeader, AdaptiveDialogTitle, AdaptiveDialogFooter } from "@/components/ui/adaptive-dialog";
import { MobileAlertDialog } from "@/components/ui/mobile-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { createPost, uploadPostMediaFiles, type PostType, type PostVisibility } from "@/services/api";
import { RichTextEditor } from "@/components/rich-text/RichTextEditor";
import { toPlainRichTextPayload } from "@/lib/richText";
import type { RichTextPayload } from "@/types/richText";
import { toast } from "sonner";
import { EditPencil, MediaImage, Trash } from "iconoir-react";
import { GENRES } from "@/constants";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useAuth } from "@/hooks/useAuth";
import { useBooks } from "@/hooks/useBooks";
import { useBookClubs } from "@/hooks/useBookClubs";
import { cn } from "@/lib/utils";

interface CreatePostDialogProps {
  onPostCreated?: () => void;
  compact?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Use null when the trigger is owned by a responsive header. */
  trigger?: ReactNode;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export const CreatePostDialogTrigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof Button> & { compact?: boolean }>(
  ({ compact = false, ...props }, ref) => <Button ref={ref} size={compact ? "icon" : "default"} aria-label="Create post" {...props}>
    <EditPencil className={compact ? "h-4 w-4" : "mr-2 h-4 w-4"} aria-hidden="true" />
    {!compact && "Create Post"}
  </Button>,
);
CreatePostDialogTrigger.displayName = "CreatePostDialogTrigger";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export const CreatePostDialog = (props: CreatePostDialogProps) => {
  const { user, loading } = useAuth();
  const scope = loading ? null : user?.id ?? null;
  const { onOpenChange } = props;
  const previousScope = useRef(scope);
  const scopeChanged = previousScope.current !== scope;
  useEffect(() => {
    if (previousScope.current !== scope) {
      previousScope.current = scope;
      onOpenChange?.(false);
    }
  }, [scope, onOpenChange]);
  // A new reader must never inherit another reader's in-memory draft or upload.
  return scope ? <CreatePostTask key={scope} {...props} open={scopeChanged && props.open !== undefined ? false : props.open} userId={scope} /> : null;
};

const CreatePostTask = ({ onPostCreated, compact = false, open: controlledOpen, onOpenChange, trigger, returnFocusRef, userId }: CreatePostDialogProps & { userId: string }) => {
  const id = useId();
  const [error, setError] = useState<{ target: "required" | "book" | "club" | "media" | "submit"; message: string } | null>(null);
  const clearError = (target: NonNullable<typeof error>["target"]) => setError((previous) => previous?.target === target ? null : previous);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  const [discardRequested, setDiscardRequested] = useState(false);
  const discardInvoker = useRef<HTMLElement | null>(null);
  const pendingRef = useRef(false);
  const mounted = useRef(false);
  const uploaded = useRef<{ files: File[]; media: Awaited<ReturnType<typeof uploadPostMediaFiles>> } | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [title, setTitle] = useState("");
  const [richText, setRichText] = useState<RichTextPayload>(() => toPlainRichTextPayload(""));
  const [genre, setGenre] = useState<string>("none");
  const [postType, setPostType] = useState<PostType>("text");
  const [visibility, setVisibility] = useState<PostVisibility>("public");
  const [bookId, setBookId] = useState<string>("none");
  const [clubId, setClubId] = useState<string>("none");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { triggerHaptic } = useHapticFeedback();
  const { books } = useBooks(userId);
  const { clubs } = useBookClubs();

  const previews = useMemo(
    () =>
      files.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [files]
  );

  useEffect(() => {
    return () => previews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [previews]);

  const reset = () => {
    uploaded.current = null;
    setError(null);
    setTitle("");
    setRichText(toPlainRichTextPayload(""));
    setGenre("none");
    setPostType("text");
    setVisibility("public");
    setBookId("none");
    setClubId("none");
    setFiles([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const dirty = title !== "" || richText.content !== "" || genre !== "none" || postType !== "text"
    || visibility !== "public" || bookId !== "none" || clubId !== "none" || files.length > 0;
  const requestOpenChange = (nextOpen: boolean) => {
    if (pendingRef.current) return;
    if (!nextOpen && dirty) {
      if (!discardRequested) discardInvoker.current = document.activeElement as HTMLElement | null;
      setDiscardRequested(true);
      return;
    }
    if (!nextOpen) reset();
    setOpen(nextOpen);
  };

  const validateFiles = (selected: File[]) => {
    const imageFiles = selected.filter((file) => IMAGE_TYPES.has(file.type));
    const videoFiles = selected.filter((file) => VIDEO_TYPES.has(file.type));
    const unsupported = selected.find(
      (file) => !IMAGE_TYPES.has(file.type) && !VIDEO_TYPES.has(file.type)
    );

    if (unsupported) throw new Error(`${unsupported.name} is not a supported media type`);
    if (imageFiles.length > 4) throw new Error("Posts can include up to 4 images");
    if (videoFiles.length > 1) throw new Error("Posts can include up to 1 video");
    if (imageFiles.length > 0 && videoFiles.length > 0) {
      throw new Error("Use either images or one video per post");
    }
    for (const file of imageFiles) {
      if (file.size > MAX_IMAGE_BYTES) throw new Error(`${file.name} must be 10 MB or smaller`);
    }
    for (const file of videoFiles) {
      if (file.size > MAX_VIDEO_BYTES) throw new Error(`${file.name} must be 60 MB or smaller`);
    }
  };

  const handleFileChange = (fileList: FileList | null) => {
    if (pendingRef.current) return;
    try {
      const selected = Array.from(fileList || []);
      validateFiles(selected);
      setFiles(selected);
      uploaded.current = null;
      clearError("media");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid media";
      setError({ target: "media", message });
      toast.error(message);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (pendingRef.current || discardRequested) return;
    if (!title.trim() || !richText.content.trim()) {
      setError({ target: "required", message: "Please fill in all required fields" });
      triggerHaptic("error");
      toast.error("Please fill in all required fields");
      return;
    }

    if (postType === "book" && bookId === "none") {
      setError({ target: "book", message: "Choose a book for this post" });
      toast.error("Choose a book for this post");
      return;
    }

    if (postType === "club" && clubId === "none") {
      setError({ target: "club", message: "Choose a book club for this post" });
      toast.error("Choose a book club for this post");
      return;
    }

    pendingRef.current = true;
    try {
      setLoading(true);
      setError(null);
      const media = uploaded.current?.files === files ? uploaded.current.media
        : files.length > 0 ? await uploadPostMediaFiles(files) : [];
      if (!mounted.current) return;
      uploaded.current = { files, media };
      await createPost({
        title,
        content: richText.content,
        content_format: richText.content_format,
        content_json: richText.content_json,
        content_html: richText.content_html,
        genre: genre === "none" ? null : genre,
        post_type: postType,
        visibility,
        book_id: postType === "book" ? bookId : null,
        club_id: postType === "club" ? clubId : null,
        media,
      });

    } catch (error: unknown) {
      if (!mounted.current) return;
      console.error("Error creating post:", error);
      triggerHaptic("error");
      const message = error instanceof Error ? error.message : "Failed to create post";
      setError({ target: "submit", message });
      toast.error(message);
      return;
    } finally {
      pendingRef.current = false;
      if (mounted.current) setLoading(false);
    }
    if (!mounted.current) return;
    triggerHaptic("success");
    toast.success("Post published");
    reset();
    setOpen(false);
    // Refresh is separate from the confirmed write; a refresh failure must not
    // invite a duplicate publish of a post that already exists.
    try { await onPostCreated?.(); } catch (error) { console.error("Error refreshing after post creation:", error); }
  };

  return (
    <Dialog open={open} onOpenChange={requestOpenChange}>
      {trigger !== null && <DialogTrigger asChild>{trigger ?? <CreatePostDialogTrigger compact={compact} />}</DialogTrigger>}
      <AdaptiveDialogContent size="wide" onCloseAutoFocus={(event) => {
        if (returnFocusRef?.current?.isConnected) { event.preventDefault(); returnFocusRef.current.focus(); }
      }}>
        <AdaptiveDialogHeader>
          <AdaptiveDialogTitle className="font-display">Create a Post</AdaptiveDialogTitle>
          <AdaptiveDialogDescription className="font-sans">
            Share an update, book note, club prompt, image, or short video.
          </AdaptiveDialogDescription>
        </AdaptiveDialogHeader>

        <fieldset disabled={loading || discardRequested} className="flex min-w-0 flex-wrap gap-4">
          <legend className="sr-only">Post details</legend>
          <div className="min-w-0 flex-[2_1_22rem] space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${id}-type`}>Post Type</Label>
                <Select disabled={loading || discardRequested} value={postType} onValueChange={(value) => setPostType(value as PostType)}>
                  <SelectTrigger id={`${id}-type`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text post</SelectItem>
                    <SelectItem value="book">Book info</SelectItem>
                    <SelectItem value="club">Book club info</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${id}-visibility`}>Visibility</Label>
                <Select
                  disabled={loading || discardRequested}
                  value={visibility}
                  onValueChange={(value) => setVisibility(value as PostVisibility)}
                >
                  <SelectTrigger id={`${id}-visibility`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="followers">Followers</SelectItem>
                    <SelectItem value="private">Only me</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {postType === "book" && (
              <div className="space-y-2">
                <Label htmlFor={`${id}-book`}>Book</Label>
                <Select disabled={loading || discardRequested} value={bookId} onValueChange={(value) => { setBookId(value); clearError("book"); }}>
                  <SelectTrigger id={`${id}-book`} aria-invalid={error?.target === "book"} aria-describedby={error?.target === "book" ? `${id}-error` : undefined}>
                    <SelectValue placeholder="Choose a book" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose a book</SelectItem>
                    {books.map((book) => (
                      <SelectItem key={book.id} value={book.id}>
                        {book.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {postType === "club" && (
              <div className="space-y-2">
                <Label htmlFor={`${id}-club`}>Book Club</Label>
                <Select disabled={loading || discardRequested} value={clubId} onValueChange={(value) => { setClubId(value); clearError("club"); }}>
                  <SelectTrigger id={`${id}-club`} aria-invalid={error?.target === "club"} aria-describedby={error?.target === "club" ? `${id}-error` : undefined}>
                    <SelectValue placeholder="Choose a club" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose a club</SelectItem>
                    {clubs.map((club) => (
                      <SelectItem key={club.id} value={club.id}>
                        {club.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor={`${id}-title`}>Title *</Label>
              <Input
                id={`${id}-title`} aria-required="true"
                aria-invalid={error?.target === "required" && !title.trim()}
                aria-describedby={error?.target === "required" && !title.trim() ? `${id}-error` : undefined}
                placeholder="Give your post a clear title..."
                maxLength={200}
                value={title}
                onChange={(event) => { setTitle(event.target.value); clearError("required"); }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${id}-genre`}>Genre/Theme</Label>
              <Select disabled={loading || discardRequested} value={genre} onValueChange={setGenre}>
                <SelectTrigger id={`${id}-genre`}>
                  <SelectValue placeholder="Select a genre or theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No genre</SelectItem>
                  {GENRES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label id={`${id}-content-label`} htmlFor={`${id}-content`}>Content *</Label>
              <RichTextEditor
                disabled={loading || discardRequested}
                id={`${id}-content`} labelledBy={`${id}-content-label`} aria-required="true"
                aria-invalid={error?.target === "required" && !richText.content.trim()}
                aria-describedby={error?.target === "required" && !richText.content.trim() ? `${id}-error` : undefined}
                placeholder="Share your thoughts, insight, quote, recommendation, or question..."
                limit={10000}
                value={richText}
                onChange={(value) => { setRichText(value); clearError("required"); }}
              />
            </div>
          </div>

          <aside className="min-w-0 flex-[1_1_14rem] space-y-3 rounded-md border border-border/70 bg-muted/20 p-3">
            <div className="space-y-1">
              <Label htmlFor={`${id}-media`}>Media</Label>
              <p id={`${id}-media-help`} className="font-sans text-xs text-muted-foreground">
                Up to 4 images at 10 MB each, or 1 video at 60 MB.
              </p>
            </div>

            <input
              id={`${id}-media`}
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
              multiple
              className="hidden"
              onChange={(event) => handleFileChange(event.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              aria-describedby={`${id}-media-help${error?.target === "media" ? ` ${id}-error` : ""}`}
              onClick={() => inputRef.current?.click()}
            >
              <MediaImage className="h-4 w-4" />
              Add Media
            </Button>

            {previews.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {previews.map((preview) => (
                  <div
                    key={preview.url}
                    className="relative aspect-square overflow-hidden rounded-md border border-border bg-card"
                  >
                    {preview.file.type.startsWith("video/") ? (
                      <video src={preview.url} className="h-full w-full object-cover" muted />
                    ) : (
                      <img
                        src={preview.url}
                        alt={preview.file.name}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-32 flex-col items-center justify-center rounded-md border border-dashed border-border/70 text-center">
                <MediaImage className="mb-2 h-6 w-6 text-muted-foreground" />
                <p className="font-sans text-xs text-muted-foreground">No media selected</p>
              </div>
            )}

            {files.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full gap-2 text-destructive hover:text-destructive"
                onClick={() => {
                  setFiles([]);
                  uploaded.current = null;
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                <Trash className="h-4 w-4" />
                Clear media
              </Button>
            )}

            <div className="space-y-2 border-t border-border/70 pt-3">
              <p className="font-sans text-xs font-medium">Preview</p>
              <div className={cn("rounded-md border border-border bg-card p-3", !title && "opacity-70")}>
                <div className="mb-2 flex flex-wrap gap-1">
                  <Badge variant="outline">{postType}</Badge>
                  <Badge variant="secondary">{visibility}</Badge>
                </div>
                <p className="line-clamp-2 font-display text-sm font-semibold">
                  {title || "Post title"}
                </p>
                <p className="mt-1 line-clamp-3 font-serif text-xs text-muted-foreground">
                  {richText.content || "Your post preview will appear here."}
                </p>
              </div>
            </div>
          </aside>
        </fieldset>

        {loading && <p role="status" className="mt-4 text-sm text-muted-foreground">Publishing your post. Keep this task open until it finishes.</p>}
        {error && <p id={`${id}-error`} role="alert" className="mt-4 text-sm text-destructive">{error.message}</p>}
        <AdaptiveDialogFooter>
          <Button variant="outline" disabled={loading || discardRequested} onClick={() => requestOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} aria-describedby={error?.target === "submit" ? `${id}-error` : undefined} disabled={loading || discardRequested || !title.trim() || !richText.content.trim()}>
            {loading ? "Publishing..." : "Publish Post"}
          </Button>
        </AdaptiveDialogFooter>
        <MobileAlertDialog open={discardRequested} onOpenChange={setDiscardRequested}
          title="Discard post draft?" description="Your unpublished text, selections and media will be removed."
          cancelText="Keep editing" confirmText="Discard draft" variant="destructive" returnFocusRef={discardInvoker}
          onConfirm={() => { reset(); setOpen(false); }} />
      </AdaptiveDialogContent>
    </Dialog>
  );
};
