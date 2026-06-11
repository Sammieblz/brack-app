import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Crown,
  Lock,
  MapPin,
  MediaImage,
  NavArrowRight,
  Send,
  Trash,
} from "iconoir-react";
import { formatDistanceToNow } from "date-fns";
import { AppBackButton } from "@/components/AppBackButton";
import LoadingSpinner from "@/components/LoadingSpinner";
import { MobileHeader } from "@/components/MobileHeader";
import { MobileLayout } from "@/components/MobileLayout";
import { DiscussionThread } from "@/components/clubs/DiscussionThread";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { APP_ICONS } from "@/config/iconography";
import { useConfirmDialog } from "@/contexts/ConfirmDialogContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { discoverReaders, type UserSearchResult } from "@/services/api/readers";
import {
  createClubDiscussion,
  getClubDetail,
  getCurrentAuthUser,
  inviteClubMember,
  joinBookClub,
  leaveBookClub,
  manageClubMember,
  moderateClubDiscussion,
  requestJoinClub,
  respondClubInvite,
  reviewJoinRequest,
  updateClubMedia,
  uploadClubDiscussionMediaFiles,
  uploadClubImageFile,
  type ClubDetailResponse,
  type ClubDiscussion,
  type ClubMember,
  type ClubMemberRole,
} from "@/services/api";
import { toast } from "sonner";

const BookClubDetail = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const confirm = useConfirmDialog();
  const isMobile = useIsMobile();
  const [detail, setDetail] = useState<ClubDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>();

  const loadClub = async () => {
    if (!clubId) return;
    try {
      setLoading(true);
      const [clubDetail, user] = await Promise.all([
        getClubDetail(clubId),
        getCurrentAuthUser(),
      ]);
      setDetail(clubDetail);
      setCurrentUserId(user?.id);
    } catch (error) {
      console.error("Error fetching club:", error);
      toast.error("Failed to load club");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  const club = detail?.club;
  const userRole = detail?.user_role ?? club?.user_role ?? null;
  const isAdmin = userRole === "admin";
  const canModerate = userRole === "admin" || userRole === "moderator";
  const isMember = Boolean(userRole);

  const handleJoin = async () => {
    if (!club) return;
    try {
      await joinBookClub(club.id);
      toast.success("Joined book club");
      await loadClub();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to join club");
    }
  };

  const handleRequest = async (message?: string) => {
    if (!club) return;
    try {
      await requestJoinClub(club.id, message);
      toast.success("Join request sent");
      await loadClub();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to request access");
    }
  };

  const handleLeave = async () => {
    if (!club) return;
    const ok = await confirm({
      title: "Leave this club?",
      description: "You will lose access to private discussions and member-only activity.",
      confirmText: "Leave Club",
    });
    if (!ok) return;
    try {
      await leaveBookClub(club.id);
      toast.success("Left club");
      navigate("/clubs");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to leave club");
    }
  };

  const handleCreateDiscussion = async (data: {
    title?: string;
    content: string;
    discussion_type?: "discussion" | "announcement";
    is_pinned?: boolean;
    parent_id?: string;
    files?: File[];
  }) => {
    if (!club) return;
    const media = data.files?.length
      ? await uploadClubDiscussionMediaFiles(data.files, club.id)
      : [];
    await createClubDiscussion(club.id, { ...data, media });
    toast.success(data.parent_id ? "Reply posted" : "Posted to club");
    await loadClub();
  };

  const handleModerate = async (
    discussionId: string,
    action: "delete" | "restore" | "pin" | "unpin",
  ) => {
    const destructive = action === "delete";
    if (destructive) {
      const ok = await confirm({
        title: "Remove this post?",
        description: "The post will be hidden from the club discussion thread.",
        confirmText: "Remove",
      });
      if (!ok) return;
    }
    await moderateClubDiscussion(discussionId, action);
    toast.success(action === "delete" ? "Post removed" : "Discussion updated");
    await loadClub();
  };

  if (loading) {
    return (
      <MobileLayout>
        {isMobile && (
          <MobileHeader
            title="Book Club"
            back={{ label: "Back", ariaLabel: "Go back", fallbackPath: "/clubs" }}
          />
        )}
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner />
        </div>
      </MobileLayout>
    );
  }

  if (!club || !detail) {
    return (
      <MobileLayout>
        {isMobile && (
          <MobileHeader
            title="Book Club"
            back={{ label: "Back", ariaLabel: "Go back", fallbackPath: "/clubs" }}
          />
        )}
        <main className="app-page-narrow">
          <p className="text-center font-sans text-muted-foreground">Club not found</p>
        </main>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      {isMobile && (
        <MobileHeader
          title={club.name}
          back={{ label: "Back", ariaLabel: "Go back", fallbackPath: "/clubs" }}
        />
      )}
      <main className="app-page">
        {!isMobile && (
          <AppBackButton
            label="Back"
            ariaLabel="Go back"
            fallbackPath="/clubs"
            showLabel
            variant="outline"
            className="mb-4 border-border/70 bg-card/45 shadow-none hover:bg-accent"
          />
        )}

        <ClubHero
          detail={detail}
          onJoin={handleJoin}
          onRequest={handleRequest}
          onLeave={isMember && userRole !== "admin" ? handleLeave : undefined}
        />

        {club.preview_only ? (
          <PreviewOnlyPanel clubName={club.name} onRequest={handleRequest} requested={club.join_status === "requested"} />
        ) : (
          <Tabs defaultValue="overview" className="mt-6 space-y-5">
            <div className="max-w-full overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
              <TabsList className="w-max min-w-max justify-start gap-1 overflow-visible shadow-sm">
                <TabsTrigger value="overview" className="flex-none px-4 sm:px-5">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="discussions" className="flex-none px-4 sm:px-5">
                  Discussions
                </TabsTrigger>
                <TabsTrigger value="announcements" className="flex-none px-4 sm:px-5">
                  Announcements
                </TabsTrigger>
                <TabsTrigger value="members" className="flex-none px-4 sm:px-5">
                  Members
                </TabsTrigger>
                {isAdmin && (
                  <TabsTrigger value="admin" className="flex-none px-4 sm:px-5">
                    Admin
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <TabsContent value="overview">
              <OverviewTab detail={detail} />
            </TabsContent>

            <TabsContent value="discussions" className="space-y-4">
              <DiscussionComposer
                canPost={isMember}
                onSubmit={(data) => handleCreateDiscussion({ ...data, discussion_type: "discussion" })}
              />
              <DiscussionList
                discussions={detail.discussions}
                currentUserId={currentUserId}
                canModerate={canModerate}
                onReply={(parentId, content, files) => handleCreateDiscussion({ parent_id: parentId, content, files })}
                onModerate={handleModerate}
              />
            </TabsContent>

            <TabsContent value="announcements" className="space-y-4">
              {isAdmin && (
                <DiscussionComposer
                  canPost
                  announcement
                  onSubmit={(data) =>
                    handleCreateDiscussion({ ...data, discussion_type: "announcement", is_pinned: true })
                  }
                />
              )}
              <DiscussionList
                discussions={detail.announcements}
                currentUserId={currentUserId}
                canModerate={canModerate}
                onReply={(parentId, content, files) => handleCreateDiscussion({ parent_id: parentId, content, files })}
                onModerate={handleModerate}
                emptyLabel="No announcements yet"
              />
            </TabsContent>

            <TabsContent value="members">
              <MembersTab
                members={detail.members}
                isAdmin={isAdmin}
                currentUserId={currentUserId}
                onManage={async (targetUserId, action, role) => {
                  if (!club) return;
                  if (action === "remove") {
                    const ok = await confirm({
                      title: "Remove member?",
                      description: "They will lose access to private club content.",
                      confirmText: "Remove",
                    });
                    if (!ok) return;
                  }
                  await manageClubMember(club.id, targetUserId, action, role);
                  toast.success("Member updated");
                  await loadClub();
                }}
              />
            </TabsContent>

            {isAdmin && (
              <TabsContent value="admin">
                <AdminTab
                  detail={detail}
                  onReviewRequest={async (requestId, decision) => {
                    await reviewJoinRequest(requestId, decision);
                    toast.success(decision === "approve" ? "Request approved" : "Request declined");
                    await loadClub();
                  }}
                  onInvite={async (readerId, message) => {
                    await inviteClubMember(club.id, readerId, message);
                    toast.success("Invite sent");
                    await loadClub();
                  }}
                  onUpdateMedia={async ({ bannerFile, avatarFile }) => {
                    const [bannerPath, avatarPath] = await Promise.all([
                      bannerFile ? uploadClubImageFile(bannerFile, "banner", club.id) : Promise.resolve(undefined),
                      avatarFile ? uploadClubImageFile(avatarFile, "avatar", club.id) : Promise.resolve(undefined),
                    ]);
                    await updateClubMedia(club.id, {
                      ...(bannerPath ? { banner_image_path: bannerPath } : {}),
                      ...(avatarPath ? { avatar_image_path: avatarPath } : {}),
                    });
                    toast.success("Club media updated");
                    await loadClub();
                  }}
                />
              </TabsContent>
            )}
          </Tabs>
        )}
      </main>
    </MobileLayout>
  );
};

const ClubHero = ({
  detail,
  onJoin,
  onRequest,
  onLeave,
}: {
  detail: ClubDetailResponse;
  onJoin: () => Promise<void>;
  onRequest: (message?: string) => Promise<void>;
  onLeave?: () => Promise<void>;
}) => {
  const club = detail.club;
  const region = [club.city, club.country].filter(Boolean).join(", ");

  return (
    <Card className="overflow-hidden border-border/70">
      {club.banner_image_url && (
        <div className="relative h-40 overflow-hidden bg-primary/10 sm:h-52">
          <img src={club.banner_image_url} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/25 to-transparent" />
        </div>
      )}
      <CardContent className={cn("grid gap-5 p-5 lg:grid-cols-[1fr_22rem]", club.banner_image_url && "relative -mt-16")}>
        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-primary/10 text-primary shadow-sm ring-4 ring-card sm:h-28 sm:w-28">
            {club.avatar_image_url || club.cover_image_url ? (
              <img src={club.avatar_image_url || club.cover_image_url || ""} alt="" className="h-full w-full object-cover" />
            ) : (
              <APP_ICONS.readers.clubs className="h-10 w-10" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap gap-2">
              {club.is_private && (
                <Badge variant="outline" className="gap-1">
                  <Lock className="h-3 w-3" />
                  Private
                </Badge>
              )}
              {club.user_role && (
                <Badge variant="secondary" className="gap-1 capitalize">
                  <Crown className="h-3 w-3" />
                  {club.user_role}
                </Badge>
              )}
              {club.join_status === "requested" && <Badge variant="outline">Request pending</Badge>}
            </div>
            <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">
              {club.name}
            </h1>
            <p className="mt-2 max-w-3xl font-sans text-muted-foreground">
              {club.description || "A shared reading space for this group."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[...club.genres, ...club.tags].slice(0, 8).map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Metric label="Members" value={club.member_count} />
            <Metric label="Threads" value={club.discussion_count} />
            <Metric label="Announcements" value={club.announcement_count} />
          </div>
          {region && (
            <p className="mt-4 flex items-center gap-2 font-sans text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              {region}
            </p>
          )}
          {club.current_book && (
            <div className="mt-4 flex gap-3 rounded-lg border border-border/70 bg-background/60 p-3">
              {club.current_book.cover_url && (
                <img src={club.current_book.cover_url} alt="" className="h-16 w-11 rounded object-cover" />
              )}
              <div className="min-w-0">
                <p className="font-sans text-xs font-semibold text-muted-foreground">Current book</p>
                <p className="truncate font-serif font-semibold">{club.current_book.title}</p>
                {club.current_book.author && (
                  <p className="truncate font-serif text-sm text-muted-foreground">
                    by {club.current_book.author}
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {!club.user_role && !club.is_private && (
              <Button className="flex-1" onClick={onJoin}>
                Join Club
              </Button>
            )}
            {!club.user_role && club.is_private && club.join_status !== "requested" && (
              <Button className="flex-1" variant="outline" onClick={() => onRequest()}>
                Request to Join
              </Button>
            )}
            {onLeave && (
              <Button className="flex-1" variant="outline" onClick={onLeave}>
                Leave Club
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const Metric = ({ label, value }: { label: string; value: number }) => (
  <div>
    <p className="font-sans text-2xl font-semibold">{value}</p>
    <p className="font-sans text-xs text-muted-foreground">{label}</p>
  </div>
);

const PreviewOnlyPanel = ({
  clubName,
  requested,
  onRequest,
}: {
  clubName: string;
  requested: boolean;
  onRequest: (message?: string) => Promise<void>;
}) => {
  const [message, setMessage] = useState("");
  return (
    <Card className="mt-6">
      <CardContent className="grid gap-5 p-6 lg:grid-cols-[1fr_22rem]">
        <div>
          <h2 className="font-display text-2xl font-semibold">Private club preview</h2>
          <p className="mt-2 font-sans text-muted-foreground">
            {clubName} shares a limited preview publicly. Discussions, members, announcements, and current read details unlock after an admin approves your request.
          </p>
        </div>
        <div className="space-y-3">
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            disabled={requested}
            placeholder="Optional note for the admins"
          />
          <Button className="w-full" disabled={requested} onClick={() => onRequest(message)}>
            {requested ? "Request Pending" : "Request Access"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const OverviewTab = ({ detail }: { detail: ClubDetailResponse }) => {
  const club = detail.club;
  const recent = [...detail.announcements, ...detail.discussions]
    .sort((a, b) => String(b.created_at).localeCompare(a.created_at))
    .slice(0, 4);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Club Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="font-sans text-muted-foreground">
            {club.description || "This club has not added a longer overview yet."}
          </p>
          {club.member_limit && (
            <div>
              <div className="mb-2 flex justify-between font-sans text-sm">
                <span>Member capacity</span>
                <span>{club.member_count} / {club.member_limit}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min((club.member_count / club.member_limit) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Recent Club Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recent.length === 0 ? (
            <PremiumEmptyState
              asset="emptyComments"
              title="No recent club posts yet"
              description="Discussions and announcements will appear here once members start posting."
              variant="plain"
              size="compact"
            />
          ) : (
            recent.map((item) => (
              <div key={item.id} className="rounded-lg border border-border/70 p-3">
                <p className="line-clamp-1 font-sans font-semibold">
                  {item.title || (item.discussion_type === "announcement" ? "Announcement" : "Discussion")}
                </p>
                <p className="mt-1 font-sans text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const DiscussionComposer = ({
  canPost,
  announcement = false,
  onSubmit,
}: {
  canPost: boolean;
  announcement?: boolean;
  onSubmit: (data: { title?: string; content: string; files?: File[] }) => Promise<void>;
}) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (!canPost) {
    return (
      <Card>
        <CardContent className="p-5 font-sans text-sm text-muted-foreground">
          Join this club to participate in discussions.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">
          {announcement ? "Post an Announcement" : "Start a Discussion"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!content.trim()) return;
            setSubmitting(true);
            try {
              await onSubmit({ title: title.trim() || undefined, content: content.trim(), files });
              setTitle("");
              setContent("");
              setFiles([]);
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={`club-title-${announcement ? "announcement" : "discussion"}`}>Title</Label>
            <Input
              id={`club-title-${announcement ? "announcement" : "discussion"}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={announcement ? "Announcement title" : "Discussion topic"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`club-content-${announcement ? "announcement" : "discussion"}`}>Message</Label>
            <Textarea
              id={`club-content-${announcement ? "announcement" : "discussion"}`}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={4}
              placeholder="Share what members should know..."
              required
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-2 font-sans text-sm text-muted-foreground transition hover:border-primary hover:text-primary">
              <MediaImage className="h-4 w-4" />
              {files.length > 0 ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "Attach media"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                multiple
                className="sr-only"
                onChange={(event) => setFiles(Array.from(event.target.files || []))}
              />
            </label>
            <Button type="submit" disabled={submitting || !content.trim()}>
              <Send className="mr-2 h-4 w-4" />
              {submitting ? "Posting..." : announcement ? "Post Announcement" : "Post Discussion"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const DiscussionList = ({
  discussions,
  currentUserId,
  canModerate,
  onReply,
  onModerate,
  emptyLabel = "No discussions yet",
}: {
  discussions: ClubDiscussion[];
  currentUserId?: string;
  canModerate: boolean;
  onReply: (parentId: string, content: string, files?: File[]) => Promise<void>;
  onModerate: (discussionId: string, action: "delete" | "restore" | "pin" | "unpin") => Promise<void>;
  emptyLabel?: string;
}) => {
  if (discussions.length === 0) {
    return (
      <PremiumEmptyState
        asset="emptyComments"
        title={emptyLabel}
        description="Start a thread to give members something to respond to."
        size="compact"
      />
    );
  }

  return (
    <div className="space-y-4">
      {discussions.map((discussion) => (
        <DiscussionThread
          key={discussion.id}
          discussion={discussion}
          onReply={onReply}
          onDelete={(discussionId) => onModerate(discussionId, "delete")}
          onPin={(discussionId) => onModerate(discussionId, discussion.is_pinned ? "unpin" : "pin")}
          currentUserId={currentUserId}
          canModerate={canModerate}
        />
      ))}
    </div>
  );
};

const MembersTab = ({
  members,
  isAdmin,
  currentUserId,
  onManage,
}: {
  members: ClubMember[];
  isAdmin: boolean;
  currentUserId?: string;
  onManage: (
    targetUserId: string,
    action: "remove" | "set_role",
    role?: ClubMemberRole,
  ) => Promise<void>;
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="font-display">Members ({members.length})</CardTitle>
    </CardHeader>
    <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {members.map((member) => (
        <div key={member.id} className="flex items-center gap-3 rounded-xl border border-border/70 p-3">
          <Avatar className="h-11 w-11">
            <AvatarImage src={member.user?.avatar_url || undefined} />
            <AvatarFallback>{getInitials(member.user?.display_name || "Reader")}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-sans font-semibold">{member.user?.display_name || "Reader"}</p>
            <p className="font-sans text-xs capitalize text-muted-foreground">{member.role}</p>
          </div>
          {isAdmin && member.user_id !== currentUserId && (
            <div className="flex items-center gap-2">
              <Select
                value={member.role}
                onValueChange={(value) =>
                  onManage(member.user_id, "set_role", value as ClubMemberRole)
                }
              >
                <SelectTrigger className="h-9 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                className="text-destructive"
                onClick={() => onManage(member.user_id, "remove")}
              >
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      ))}
    </CardContent>
  </Card>
);

const AdminTab = ({
  detail,
  onReviewRequest,
  onInvite,
  onUpdateMedia,
}: {
  detail: ClubDetailResponse;
  onReviewRequest: (requestId: string, decision: "approve" | "decline") => Promise<void>;
  onInvite: (readerId: string, message?: string) => Promise<void>;
  onUpdateMedia: (files: { bannerFile?: File; avatarFile?: File }) => Promise<void>;
}) => {
  const [readerQuery, setReaderQuery] = useState("");
  const [readerResults, setReaderResults] = useState<UserSearchResult[]>([]);
  const [selectedReader, setSelectedReader] = useState<UserSearchResult | null>(null);
  const [message, setMessage] = useState("");
  const [bannerFile, setBannerFile] = useState<File | undefined>();
  const [avatarFile, setAvatarFile] = useState<File | undefined>();
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [savingMedia, setSavingMedia] = useState(false);
  const [searchingReaders, setSearchingReaders] = useState(false);
  const requests = detail.admin?.pending_requests || [];
  const invites = detail.admin?.pending_invites || [];
  const club = detail.club;
  const memberIds = useMemo(
    () => new Set(detail.members.map((member) => member.user_id)),
    [detail.members],
  );

  useEffect(() => {
    const query = readerQuery.trim();
    if (query.length < 2 || selectedReader) {
      setReaderResults([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        setSearchingReaders(true);
        const results = await discoverReaders(query, 75, 8);
        setReaderResults(
          results.searchResults
            .filter((reader) => !memberIds.has(reader.id))
            .slice(0, 6),
        );
      } catch (error) {
        console.error("Reader invite search failed", error);
        setReaderResults([]);
      } finally {
        setSearchingReaders(false);
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [memberIds, readerQuery, selectedReader]);

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

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Pending Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.length === 0 ? (
            <p className="font-sans text-sm text-muted-foreground">No pending join requests.</p>
          ) : (
            requests.map((request) => (
              <div key={request.id} className="rounded-xl border border-border/70 p-3">
                <div className="flex items-start gap-3">
                  <Avatar>
                    <AvatarImage src={request.user?.avatar_url || undefined} />
                    <AvatarFallback>{getInitials(request.user?.display_name || "Reader")}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-sans font-semibold">{request.user?.display_name || "Reader"}</p>
                    {request.message && (
                      <p className="mt-1 font-sans text-sm text-muted-foreground">{request.message}</p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => onReviewRequest(request.id, "decline")}>
                    Decline
                  </Button>
                  <Button onClick={() => onReviewRequest(request.id, "approve")}>
                    Approve
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Club Media</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/20">
              <div className="relative h-28 bg-primary/10">
                {bannerPreview || club.banner_image_url ? (
                  <img
                    src={bannerPreview || club.banner_image_url || ""}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-primary/70">
                    <MediaImage className="h-8 w-8" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
                <div className="absolute -bottom-7 left-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card text-primary shadow-sm ring-4 ring-card">
                  {avatarPreview || club.avatar_image_url || club.cover_image_url ? (
                    <img
                      src={avatarPreview || club.avatar_image_url || club.cover_image_url || ""}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <APP_ICONS.readers.clubs className="h-7 w-7" />
                  )}
                </div>
              </div>
              <div className="px-4 pb-4 pt-10">
                <p className="line-clamp-1 font-sans text-sm font-semibold">{club.name}</p>
                <p className="font-sans text-xs text-muted-foreground">
                  Preview of how the club appears in discovery and detail pages.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <ClubMediaPicker
                id="club-admin-banner"
                label="Banner"
                description="Wide image for the club header"
                file={bannerFile}
                onFile={setBannerFile}
              />
              <ClubMediaPicker
                id="club-admin-avatar"
                label="Profile"
                description="Square image for club cards"
                file={avatarFile}
                onFile={setAvatarFile}
              />
            </div>
            <Button
              className="w-full"
              disabled={savingMedia || (!bannerFile && !avatarFile)}
              onClick={async () => {
                setSavingMedia(true);
                try {
                  await onUpdateMedia({ bannerFile, avatarFile });
                  setBannerFile(undefined);
                  setAvatarFile(undefined);
                  setBannerPreview(null);
                  setAvatarPreview(null);
                } finally {
                  setSavingMedia(false);
                }
              }}
            >
              {savingMedia ? "Saving..." : "Update Media"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Invite Reader</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="club-invite-reader">Reader name</Label>
              <Input
                id="club-invite-reader"
                value={selectedReader?.display_name || readerQuery}
                onChange={(event) => {
                  setSelectedReader(null);
                  setReaderQuery(event.target.value);
                }}
                placeholder="Search by reader name"
              />
              {selectedReader && (
                <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={selectedReader.avatar_url || undefined} />
                    <AvatarFallback>{getInitials(selectedReader.display_name || "Reader")}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-sans text-sm font-semibold">
                      {selectedReader.display_name || "Reader"}
                    </p>
                    <p className="font-sans text-xs capitalize text-muted-foreground">
                      {selectedReader.relationship === "none" ? "Suggested reader" : selectedReader.relationship}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedReader(null);
                      setReaderQuery("");
                    }}
                  >
                    Change
                  </Button>
                </div>
              )}
              {!selectedReader && (readerResults.length > 0 || searchingReaders || readerQuery.trim().length >= 2) && (
                <div className="max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-sm">
                  {searchingReaders ? (
                    <p className="px-3 py-2 font-sans text-sm text-muted-foreground">Searching readers...</p>
                  ) : readerResults.length === 0 ? (
                    <p className="px-3 py-2 font-sans text-sm text-muted-foreground">
                      No inviteable readers found.
                    </p>
                  ) : (
                    readerResults.map((reader) => (
                      <button
                        key={reader.id}
                        type="button"
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-accent"
                        onClick={() => {
                          setSelectedReader(reader);
                          setReaderQuery(reader.display_name || "");
                          setReaderResults([]);
                        }}
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={reader.avatar_url || undefined} />
                          <AvatarFallback>{getInitials(reader.display_name || "Reader")}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-sans text-sm font-semibold">
                            {reader.display_name || "Reader"}
                          </p>
                          <p className="truncate font-sans text-xs text-muted-foreground">
                            {reader.recommendation_reason || "Reader suggestion"}
                          </p>
                        </div>
                        {reader.relationship !== "none" && (
                          <Badge variant="outline" className="capitalize">
                            {reader.relationship}
                          </Badge>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={3}
              placeholder="Optional invite note"
            />
            <Button
              className="w-full"
              disabled={!selectedReader}
              onClick={async () => {
                if (!selectedReader) return;
                await onInvite(selectedReader.id, message.trim() || undefined);
                setSelectedReader(null);
                setReaderQuery("");
                setReaderResults([]);
                setMessage("");
              }}
            >
              Send Invite
              <NavArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Pending Invites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invites.length === 0 ? (
              <p className="font-sans text-sm text-muted-foreground">No outstanding invites.</p>
            ) : (
              invites.map((invite) => (
                <div key={invite.id} className="rounded-lg border border-border/70 p-3">
                  <p className="font-sans font-semibold">
                    {invite.invited_user?.display_name || invite.invited_user_id}
                  </p>
                  {invite.expires_at && (
                    <p className="font-sans text-xs text-muted-foreground">
                      Expires {formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true })}
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const ClubMediaPicker = ({
  id,
  label,
  description,
  file,
  onFile,
}: {
  id: string;
  label: string;
  description: string;
  file?: File;
  onFile: (file: File | undefined) => void;
}) => (
  <div className="rounded-xl border border-border/70 bg-card/60 p-3">
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <p className="font-sans text-sm font-semibold">{label}</p>
        <p className="font-sans text-xs text-muted-foreground">{description}</p>
      </div>
      {file && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onFile(undefined)}>
          Clear
        </Button>
      )}
    </div>
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-3 font-sans text-sm transition hover:border-primary hover:bg-primary/5"
    >
      <span className="min-w-0">
        <span className="block truncate font-medium">
          {file?.name || `Choose ${label.toLowerCase()} image`}
        </span>
        <span className="block text-xs text-muted-foreground">JPEG, PNG, WebP, or GIF up to 10 MB</span>
      </span>
      <MediaImage className="h-5 w-5 shrink-0 text-primary" />
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(event) => onFile(event.target.files?.[0])}
      />
    </label>
  </div>
);

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

export default BookClubDetail;
