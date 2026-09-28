import { useEffect, useId, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { MediaImage, Plus } from "iconoir-react";
import { uploadClubImageFile } from "@/services/api/clubs";

interface CreateClubDialogProps {
  onCreateClub: (data: {
    name: string;
    description?: string;
    is_private?: boolean;
    genres?: string[];
    tags?: string[];
    city?: string;
    country?: string;
    member_limit?: number | null;
    banner_image_path?: string;
    avatar_image_path?: string;
  }) => Promise<unknown>;
  compact?: boolean;
}

export const CreateClubDialog = ({ onCreateClub, compact = false }: CreateClubDialogProps) => {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [genres, setGenres] = useState("");
  const [tags, setTags] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [memberLimit, setMemberLimit] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!bannerFile) {
      setBannerPreview(null);
      return;
    }
    const url = URL.createObjectURL(bannerFile);
    setBannerPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [bannerFile]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const parseList = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setLoading(true);
      setSubmitError(null);
      const [bannerImagePath, avatarImagePath] = await Promise.all([
        bannerFile ? uploadClubImageFile(bannerFile, "banner") : Promise.resolve(undefined),
        avatarFile ? uploadClubImageFile(avatarFile, "avatar") : Promise.resolve(undefined),
      ]);
      await onCreateClub({
        name: name.trim(),
        description: description.trim() || undefined,
        is_private: isPrivate,
        banner_image_path: bannerImagePath,
        avatar_image_path: avatarImagePath,
        genres: parseList(genres),
        tags: parseList(tags),
        city: city.trim() || undefined,
        country: country.trim() || undefined,
        member_limit: memberLimit ? Number(memberLimit) : null,
      });
      setOpen(false);
      setName("");
      setDescription("");
      setIsPrivate(false);
      setGenres("");
      setTags("");
      setCity("");
      setCountry("");
      setMemberLimit("");
      setBannerFile(null);
      setAvatarFile(null);
    } catch (error) {
      console.error('Error creating club:', error);
      setSubmitError(error instanceof Error ? error.message : "Failed to create club");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={compact ? "icon" : "default"} aria-label="Create club">
          <Plus className={compact ? "h-4 w-4" : "h-4 w-4 mr-2"} />
          {!compact && "Create Club"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(42rem,calc(var(--app-viewport-height,100dvh)-2rem))] overflow-y-auto sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="font-display">Create Book Club</DialogTitle>
            <DialogDescription className="font-sans">
              Start a new book club and invite others to join your reading journey.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor={`${id}-name`}>Club Name *</Label>
              <Input
                id={`${id}-name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Mystery Lovers Club"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-description`}>Description</Label>
              <Textarea
                id={`${id}-description`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell members what your club is about..."
                rows={4}
                className="font-sans"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
              <div className="grid gap-2">
                <Label htmlFor={`${id}-banner`}>Banner image</Label>
                <label
                  htmlFor={`${id}-banner`}
                  className="flex min-h-32 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground transition hover:border-primary/50 hover:bg-primary/5"
                >
                  {bannerPreview ? (
                    <img src={bannerPreview} alt="" className="h-full max-h-40 w-full object-cover" />
                  ) : (
                    <span className="flex items-center gap-2">
                      <MediaImage className="h-4 w-4" />
                      Add a club banner
                    </span>
                  )}
                </label>
                <Input
                  id={`${id}-banner`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={(event) => setBannerFile(event.target.files?.[0] || null)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${id}-avatar`}>Profile image</Label>
                <label
                  htmlFor={`${id}-avatar`}
                  className="flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 text-muted-foreground transition hover:border-primary/50 hover:bg-primary/5"
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <MediaImage className="h-6 w-6" />
                  )}
                </label>
                <Input
                  id={`${id}-avatar`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={(event) => setAvatarFile(event.target.files?.[0] || null)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor={`${id}-private`}>Private Club</Label>
                <p id={`${id}-private-description`} className="font-sans text-xs text-muted-foreground">
                  Readers can find a preview, but discussions and members stay private
                </p>
              </div>
              <Switch
                id={`${id}-private`} aria-describedby={`${id}-private-description`}
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`${id}-genres`}>Genres</Label>
                <Input
                  id={`${id}-genres`}
                  value={genres}
                  onChange={(e) => setGenres(e.target.value)}
                  placeholder="Fiction, Mystery, History"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${id}-tags`}>Tags</Label>
                <Input
                  id={`${id}-tags`}
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="Buddy reads, slow pace"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor={`${id}-city`}>City</Label>
                <Input
                  id={`${id}-city`}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${id}-country`}>Country</Label>
                <Input
                  id={`${id}-country`}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${id}-memberLimit`}>Member limit</Label>
                <Input
                  id={`${id}-memberLimit`}
                  type="number"
                  min={2}
                  value={memberLimit}
                  onChange={(e) => setMemberLimit(e.target.value)}
                  placeholder="No limit"
                />
              </div>
            </div>
          </div>
          {submitError && <p id={`${id}-submit-error`} role="alert" className="mb-3 text-sm text-destructive">{submitError}</p>}
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" aria-describedby={submitError ? `${id}-submit-error` : undefined} disabled={loading || !name.trim()}>
              {loading ? 'Creating...' : 'Create Club'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
