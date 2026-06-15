import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export const CreatePostDialog = ({ onPostCreated, compact = false }: CreatePostDialogProps) => {
  const [open, setOpen] = useState(false);
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
  const { user } = useAuth();
  const { books } = useBooks(user?.id);
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
    try {
      const selected = Array.from(fileList || []);
      validateFiles(selected);
      setFiles(selected);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid media");
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !richText.content.trim()) {
      triggerHaptic("error");
      toast.error("Please fill in all required fields");
      return;
    }

    if (postType === "book" && bookId === "none") {
      toast.error("Choose a book for this post");
      return;
    }

    if (postType === "club" && clubId === "none") {
      toast.error("Choose a book club for this post");
      return;
    }

    try {
      setLoading(true);
      const media = files.length > 0 ? await uploadPostMediaFiles(files) : [];
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

      triggerHaptic("success");
      toast.success("Post published");
      reset();
      setOpen(false);
      onPostCreated?.();
    } catch (error: unknown) {
      console.error("Error creating post:", error);
      triggerHaptic("error");
      toast.error(error instanceof Error ? error.message : "Failed to create post");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={compact ? "icon" : "default"} aria-label="Create post">
          <EditPencil className={compact ? "h-4 w-4" : "mr-2 h-4 w-4"} />
          {!compact && "Create Post"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(46rem,calc(var(--app-viewport-height,100dvh)-2rem))] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Create a Post</DialogTitle>
          <DialogDescription className="font-sans">
            Share an update, book note, club prompt, image, or short video.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Post Type</Label>
                <Select value={postType} onValueChange={(value) => setPostType(value as PostType)}>
                  <SelectTrigger>
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
                <Label>Visibility</Label>
                <Select
                  value={visibility}
                  onValueChange={(value) => setVisibility(value as PostVisibility)}
                >
                  <SelectTrigger>
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
                <Label>Book</Label>
                <Select value={bookId} onValueChange={setBookId}>
                  <SelectTrigger>
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
                <Label>Book Club</Label>
                <Select value={clubId} onValueChange={setClubId}>
                  <SelectTrigger>
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
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Give your post a clear title..."
                maxLength={200}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Genre/Theme</Label>
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger>
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
              <Label htmlFor="content">Content *</Label>
              <RichTextEditor
                placeholder="Share your thoughts, insight, quote, recommendation, or question..."
                limit={10000}
                value={richText}
                onChange={setRichText}
              />
            </div>
          </div>

          <aside className="space-y-3 rounded-md border border-border/70 bg-muted/20 p-3">
            <div className="space-y-1">
              <Label>Media</Label>
              <p className="font-sans text-xs text-muted-foreground">
                Up to 4 images at 10 MB each, or 1 video at 60 MB.
              </p>
            </div>

            <input
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
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !title.trim() || !richText.content.trim()}>
            {loading ? "Publishing..." : "Publish Post"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
