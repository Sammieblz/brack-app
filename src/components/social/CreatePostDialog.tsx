import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createCommunityPost } from "@/services/api";
import { toast } from "sonner";
import { EditPencil } from "iconoir-react";
import { GENRES } from "@/constants";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

interface CreatePostDialogProps {
  onPostCreated?: () => void;
  compact?: boolean;
}

export const CreatePostDialog = ({ onPostCreated, compact = false }: CreatePostDialogProps) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [genre, setGenre] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { triggerHaptic } = useHapticFeedback();

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      triggerHaptic('error');
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate input lengths
    if (title.length > 200) {
      triggerHaptic('error');
      toast.error("Title must be less than 200 characters");
      return;
    }

    if (content.length > 10000) {
      triggerHaptic('error');
      toast.error("Content must be less than 10000 characters");
      return;
    }

    try {
      setLoading(true);
      await createCommunityPost({ title, content, genre });

      triggerHaptic('success');
      toast.success("Post created successfully!");
      setTitle("");
      setContent("");
      setGenre("");
      setOpen(false);
      onPostCreated?.();
    } catch (error: unknown) {
      console.error("Error creating post:", error);
      triggerHaptic('error');
      toast.error("Failed to create post");
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
      <DialogContent className="max-h-[min(44rem,calc(var(--app-viewport-height,100dvh)-2rem))] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Create a Post</DialogTitle>
          <DialogDescription className="font-sans">
            Share your reading thoughts with the community
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Give your post a compelling title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="genre">Genre/Theme</Label>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger>
                <SelectValue placeholder="Select a genre or theme..." />
              </SelectTrigger>
              <SelectContent>
                {GENRES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              placeholder="Share your thoughts, insights, or recommendations..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="font-serif resize-none"
            />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || !title.trim() || !content.trim()}
            >
              {loading ? "Publishing..." : "Publish Post"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
