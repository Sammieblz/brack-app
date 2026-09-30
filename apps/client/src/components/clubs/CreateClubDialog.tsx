import { forwardRef, useEffect, useId, useRef, useState, type ComponentPropsWithoutRef, type ReactNode, type RefObject } from "react";
import {
  Dialog,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AdaptiveDialogContent, AdaptiveDialogDescription, AdaptiveDialogFooter, AdaptiveDialogHeader, AdaptiveDialogTitle } from "@/components/ui/adaptive-dialog";
import { MobileAlertDialog } from "@/components/ui/mobile-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { MediaImage, Plus } from "iconoir-react";
import { uploadClubImageFile } from "@/services/api/clubs";
import { useAuth } from "@/hooks/useAuth";

export const CreateClubDialogTrigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof Button> & {
  compact?: boolean;
}>(({ compact = false, ...props }, ref) => (
  <Button ref={ref} size={compact ? "icon" : "default"} aria-label="Create club" {...props}>
    <Plus aria-hidden="true" className={compact ? "h-4 w-4" : "h-4 w-4 mr-2"} />
    {!compact && "Create Club"}
  </Button>
));
CreateClubDialogTrigger.displayName = "CreateClubDialogTrigger";

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
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Pass null when the invoker belongs to a responsive header. */
  trigger?: ReactNode;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export const CreateClubDialog = ({ onCreateClub, compact = false, open: controlledOpen, onOpenChange,
  trigger, returnFocusRef }: CreateClubDialogProps) => {
  const id = useId();
  const { user, loading: authLoading } = useAuth();
  const authScope = authLoading ? "loading" : user?.id;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
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
  const [discardOpen, setDiscardOpen] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const scope = useRef(authScope);
  scope.current = authScope;
  const previousScope = useRef(authScope);
  const nameRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const confirmationReturnRef = useRef<HTMLElement | null>(null);
  const uploaded = useRef<{ banner?: { file: File; path: string }; avatar?: { file: File; path: string } }>({});

  const resetDraft = () => {
    setName(""); setDescription(""); setIsPrivate(false); setGenres(""); setTags("");
    setCity(""); setCountry(""); setMemberLimit(""); setBannerFile(null); setAvatarFile(null);
    setSubmitError(null); setDiscardOpen(false);
    uploaded.current = {};
    if (bannerInputRef.current) bannerInputRef.current.value = "";
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  useEffect(() => {
    mounted.current = true;
    generation.current += 1;
    if (previousScope.current !== authScope) {
      previousScope.current = authScope;
      pending.current = false;
      setLoading(false);
      resetDraft();
      setOpen(false);
    }
    return () => { mounted.current = false; generation.current += 1; };
    // The task is owned by the resolved account, not callback render identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authScope]);

  const dirty = Boolean(name || description || isPrivate || genres || tags || city || country || memberLimit || bannerFile || avatarFile);
  const requestOpenChange = (next: boolean) => {
    if (pending.current) return;
    if (!next && dirty) {
      confirmationReturnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : nameRef.current;
      setDiscardOpen(true);
      return;
    }
    if (!next) resetDraft();
    setOpen(next);
  };

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
    if (pending.current || discardOpen || !name.trim() || authLoading || !user) return;
    pending.current = true;
    const owner = scope.current;
    const attempt = generation.current;
    const isCurrent = () => mounted.current && scope.current === owner && generation.current === attempt;
    const upload = async (file: File | null, kind: "banner" | "avatar") => {
      if (!file) return undefined;
      if (uploaded.current[kind]?.file === file) return uploaded.current[kind]!.path;
      const path = await uploadClubImageFile(file, kind);
      if (isCurrent()) uploaded.current[kind] = { file, path };
      return path;
    };

    try {
      setLoading(true);
      setSubmitError(null);
      const uploads = await Promise.allSettled([
        upload(bannerFile, "banner"),
        upload(avatarFile, "avatar"),
      ]);
      if (!isCurrent()) return;
      const failedUpload = uploads.find((result) => result.status === "rejected");
      if (failedUpload?.status === "rejected") throw failedUpload.reason;
      const [bannerImagePath, avatarImagePath] = uploads.map((result) => result.status === "fulfilled" ? result.value : undefined);
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
      if (!isCurrent()) return;
      resetDraft();
      setOpen(false);
    } catch (error) {
      if (!isCurrent()) return;
      console.error('Error creating club:', error);
      setSubmitError(error instanceof Error ? error.message : "Failed to create club");
    } finally {
      if (isCurrent()) {
        pending.current = false;
        setLoading(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={requestOpenChange}>
      {trigger !== null && <DialogTrigger asChild>{trigger ?? <CreateClubDialogTrigger compact={compact} />}</DialogTrigger>}
      <AdaptiveDialogContent onCloseAutoFocus={(event) => {
        if (returnFocusRef?.current?.isConnected) {
          event.preventDefault();
          returnFocusRef.current.focus();
        }
      }}>
        <form onSubmit={handleSubmit} aria-busy={loading}>
          <AdaptiveDialogHeader>
            <AdaptiveDialogTitle className="font-display">Create Book Club</AdaptiveDialogTitle>
            <AdaptiveDialogDescription className="font-sans">
              Start a new book club and invite others to join your reading journey.
            </AdaptiveDialogDescription>
          </AdaptiveDialogHeader>
          <fieldset disabled={loading} className="grid min-w-0 gap-4 border-0 p-0 [&_input]:min-w-0 [&_div]:min-w-0">
            <div className="grid gap-2">
              <Label htmlFor={`${id}-name`}>Club Name *</Label>
              <Input
                ref={nameRef}
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
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,9rem)]">
              <div className="group/banner grid gap-2">
                <Label id={`${id}-banner-label`} htmlFor={`${id}-banner`}>Banner image</Label>
                <label
                  htmlFor={`${id}-banner`}
                  className="flex min-h-32 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground transition hover:border-primary/50 hover:bg-primary/5 group-focus-within/banner:outline group-focus-within/banner:outline-2 group-focus-within/banner:outline-ring"
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
                <input
                  ref={bannerInputRef}
                  id={`${id}-banner`}
                  aria-labelledby={`${id}-banner-label`}
                  aria-describedby={bannerFile ? `${id}-banner-file` : undefined}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={(event) => setBannerFile(event.target.files?.[0] || null)}
                />
                {bannerFile && <p id={`${id}-banner-file`} className="break-words text-xs text-muted-foreground">{bannerFile.name}</p>}
              </div>
              <div className="group/avatar grid gap-2">
                <Label id={`${id}-avatar-label`} htmlFor={`${id}-avatar`}>Profile image</Label>
                <label
                  htmlFor={`${id}-avatar`}
                  className="flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 text-muted-foreground transition hover:border-primary/50 hover:bg-primary/5 group-focus-within/avatar:outline group-focus-within/avatar:outline-2 group-focus-within/avatar:outline-ring"
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <MediaImage className="h-6 w-6" />
                  )}
                </label>
                <input
                  ref={avatarInputRef}
                  id={`${id}-avatar`}
                  aria-labelledby={`${id}-avatar-label`}
                  aria-describedby={avatarFile ? `${id}-avatar-file` : undefined}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={(event) => setAvatarFile(event.target.files?.[0] || null)}
                />
                {avatarFile && <p id={`${id}-avatar-file`} className="break-words text-xs text-muted-foreground">{avatarFile.name}</p>}
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
          </fieldset>
          {loading && <p role="status" className="mt-3 text-sm text-muted-foreground">Creating your book club…</p>}
          {submitError && <p id={`${id}-submit-error`} role="alert" className="mb-3 text-sm text-destructive">{submitError}</p>}
          <AdaptiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => requestOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" aria-describedby={submitError ? `${id}-submit-error` : undefined} disabled={loading || authLoading || !user || !name.trim()}>
              {loading ? 'Creating...' : 'Create Club'}
            </Button>
          </AdaptiveDialogFooter>
        </form>
      </AdaptiveDialogContent>
      <MobileAlertDialog open={open && discardOpen} onOpenChange={setDiscardOpen}
        title="Discard this club draft?" description="Your club details and selected images have not been saved."
        cancelText="Keep editing" confirmText="Discard draft" variant="destructive"
        returnFocusRef={confirmationReturnRef}
        onConfirm={() => {
          if (pending.current) return;
          resetDraft();
          setOpen(false);
        }} />
    </Dialog>
  );
};
