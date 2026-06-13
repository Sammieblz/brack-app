import { type ComponentType, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BookClubCard } from "@/components/clubs/BookClubCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CreateClubDialog } from "@/components/clubs/CreateClubDialog";
import { FollowButton } from "@/components/social/FollowButton";
import { Input } from "@/components/ui/input";
import LoadingSpinner from "@/components/LoadingSpinner";
import { MobileHeader } from "@/components/MobileHeader";
import { MobileLayout } from "@/components/MobileLayout";
import { NativeHeader } from "@/components/NativeHeader";
import { PullToRefresh } from "@/components/PullToRefresh";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { APP_ICONS } from "@/config/iconography";
import type { EmptyStateAssetKey } from "@/config/emptyStateAssets";
import { useBookClubs } from "@/hooks/useBookClubs";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useIsMobile } from "@/hooks/use-mobile";
import { type UserSearchResult, useUserSearch } from "@/hooks/useUserSearch";
import { cn } from "@/lib/utils";
import type { ReaderStatusBadge } from "@/services/api";

type MainTab = "readers" | "clubs";
type ReaderSection = "suggestions" | "nearby" | "connections" | "friendsOfFriends" | "activeFriends";

const readerSections: Array<{
  value: ReaderSection;
  label: string;
  shortLabel: string;
  icon: ComponentType<{ className?: string }>;
  emptyTitle: string;
  emptyDescription: string;
}> = [
  {
    value: "suggestions",
    label: "Suggestions",
    shortLabel: "For You",
    icon: APP_ICONS.readers.suggestions,
    emptyTitle: "No smart suggestions yet",
    emptyDescription: "Follow a few readers, add genres, or join clubs so Brack can find better matches.",
  },
  {
    value: "nearby",
    label: "Nearby",
    shortLabel: "Nearby",
    icon: APP_ICONS.readers.nearby,
    emptyTitle: "No nearby readers",
    emptyDescription: "Add your location in Personal Info or widen your reading circle through clubs.",
  },
  {
    value: "connections",
    label: "Connections",
    shortLabel: "Network",
    icon: APP_ICONS.readers.connections,
    emptyTitle: "No connections yet",
    emptyDescription: "Follow readers you know, then return here to keep up with your network.",
  },
  {
    value: "friendsOfFriends",
    label: "Friends of Friends",
    shortLabel: "2nd Degree",
    icon: APP_ICONS.readers.friendsOfFriends,
    emptyTitle: "No friend-of-friend suggestions",
    emptyDescription: "Mutual connections appear here once your friends follow more readers.",
  },
  {
    value: "activeFriends",
    label: "Active Friends",
    shortLabel: "Active",
    icon: APP_ICONS.readers.active,
    emptyTitle: "No active friends right now",
    emptyDescription: "Mutual friends with online status enabled will appear here when they are active.",
  },
];

const statusLabels: Record<ReaderStatusBadge, string> = {
  available: "Available",
  reading_now: "Reading now",
  buddy_reads: "Buddy reads",
  looking_for_club: "Looking for a club",
  taking_recommendations: "Taking recs",
  quiet: "Quiet",
};

export default function Readers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<MainTab>("readers");
  const [readerSection, setReaderSection] = useState<ReaderSection>("suggestions");
  const { results, loading } = useUserSearch(searchQuery);
  const { clubs, loading: clubsLoading, createClub, joinClub, leaveClub } = useBookClubs();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { triggerHaptic } = useHapticFeedback();
  const hasSearch = searchQuery.trim().length > 0;

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (activeTab === "readers") {
        setActiveTab("clubs");
        triggerHaptic("selection");
      }
    },
    onSwipedRight: () => {
      if (activeTab === "clubs") {
        setActiveTab("readers");
        triggerHaptic("selection");
      }
    },
    trackMouse: false,
    preventScrollOnSwipe: false,
  });

  const myClubs = clubs.filter((club) => club.user_role);
  const publicClubs = clubs.filter((club) => !club.is_private && !club.user_role);

  const visibleReaders = useMemo(() => {
    if (hasSearch) return results.searchResults;
    return results[readerSection];
  }, [hasSearch, readerSection, results]);

  const activeSectionConfig = readerSections.find((section) => section.value === readerSection)!;

  const handleRefresh = async () => {
    const currentQuery = searchQuery;
    setSearchQuery("");
    window.setTimeout(() => setSearchQuery(currentQuery), 100);
  };

  const createClubAction =
    activeTab === "clubs" ? <CreateClubDialog compact={isMobile} onCreateClub={createClub} /> : undefined;

  return (
    <MobileLayout>
      {isMobile ? (
        <MobileHeader title="Discover" action={createClubAction} />
      ) : (
        <NativeHeader
          title="Discover"
          subtitle="Find smart reader suggestions, nearby matches, and active friends"
          action={createClubAction}
          showUtilityActions
        />
      )}

      <PullToRefresh onRefresh={handleRefresh}>
        <main className="app-page">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MainTab)}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <TabsList className="w-full sm:w-auto" onClick={() => triggerHaptic("selection")}>
                <TabsTrigger value="readers" className="gap-2">
                  <APP_ICONS.readers.readers className="h-4 w-4" />
                  Readers
                </TabsTrigger>
                <TabsTrigger value="clubs" className="gap-2">
                  <APP_ICONS.readers.clubs className="h-4 w-4" />
                  Book Clubs
                </TabsTrigger>
              </TabsList>

              <div className="hidden gap-3 sm:grid sm:grid-cols-3 lg:w-[30rem]">
                <SummaryPill label="Suggestions" value={results.suggestions.length} />
                <SummaryPill label="Active friends" value={results.activeFriends.length} />
                <SummaryPill label="Nearby" value={results.nearby.length} />
              </div>
            </div>

            <TabsContent value="readers" className="mt-5 space-y-4" {...swipeHandlers}>
              <Card>
                <CardContent className="space-y-3 p-3 sm:p-4">
                  <div className="relative">
                    <APP_ICONS.common.search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search readers by name"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="rounded-full pl-10"
                    />
                  </div>

                  {!hasSearch && (
                    <div className="overflow-x-auto pb-1">
                      <div className="flex min-w-max gap-2">
                        {readerSections.map(({ value, label, shortLabel, icon: Icon }) => {
                          const active = readerSection === value;
                          return (
                            <Button
                              key={value}
                              type="button"
                              variant={active ? "default" : "outline"}
                              size="sm"
                              className="gap-2 rounded-full"
                              onClick={() => {
                                setReaderSection(value);
                                triggerHaptic("selection");
                              }}
                            >
                              <Icon className="h-4 w-4" />
                              <span>{isMobile ? shortLabel : label}</span>
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {hasSearch && (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-semibold">Search Results</h2>
                    <p className="font-sans text-sm text-muted-foreground">
                      Ranked by relationship, shared signals, and privacy rules.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
                    Clear
                  </Button>
                </div>
              )}

              {!hasSearch && (
                <SectionHeader
                  icon={activeSectionConfig.icon}
                  title={activeSectionConfig.label}
                  count={visibleReaders.length}
                />
              )}

              {loading ? (
                <Card>
                  <CardContent className="flex min-h-[16rem] items-center justify-center">
                    <LoadingSpinner />
                  </CardContent>
                </Card>
              ) : visibleReaders.length === 0 ? (
                <EmptyDiscoverState
                  asset={hasSearch ? "noResults" : "emptyReaders"}
                  title={hasSearch ? "No matching readers" : activeSectionConfig.emptyTitle}
                  description={
                    hasSearch
                      ? "Try a different name. Private and blocked readers are not shown."
                      : activeSectionConfig.emptyDescription
                  }
                />
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {visibleReaders.map((user) => (
                    <ReaderCard
                      key={user.id}
                      user={user}
                      onOpen={() => navigate(`/users/${user.id}`)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="clubs" className="mt-5 space-y-4" {...swipeHandlers}>
              {clubsLoading ? (
                <Card>
                  <CardContent className="flex min-h-[16rem] items-center justify-center">
                    <LoadingSpinner />
                  </CardContent>
                </Card>
              ) : (
                <Tabs defaultValue="my-clubs">
                  <TabsList className="w-full sm:w-auto">
                    <TabsTrigger value="my-clubs" className="gap-2">
                      <APP_ICONS.readers.myClubs className="h-4 w-4" />
                      My Clubs ({myClubs.length})
                    </TabsTrigger>
                    <TabsTrigger value="discover" className="gap-2">
                      <APP_ICONS.readers.discoverClubs className="h-4 w-4" />
                      Discover ({publicClubs.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="my-clubs" className="mt-4">
                    {myClubs.length === 0 ? (
                      <EmptyDiscoverState
                        asset="emptyClubs"
                        title="No clubs yet"
                        description="Create a club or join one from Discover to start discussing books."
                      />
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {myClubs.map((club) => (
                          <BookClubCard key={club.id} club={club} onLeave={leaveClub} />
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="discover" className="mt-4">
                    {publicClubs.length === 0 ? (
                      <EmptyDiscoverState
                        asset="emptyClubs"
                        title="No public clubs"
                        description="Be the first to create a public club for readers to join."
                      />
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {publicClubs.map((club) => (
                          <BookClubCard key={club.id} club={club} onJoin={joinClub} />
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </PullToRefresh>
    </MobileLayout>
  );
}

const getInitials = (name: string | null) => {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const ReaderCard = ({ user, onOpen }: { user: UserSearchResult; onOpen: () => void }) => {
  const visibleBadges = user.badges.slice(0, 4);

  return (
    <Card className="cursor-pointer overflow-hidden transition-colors hover:border-primary/45" onClick={onOpen}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <Avatar className="h-12 w-12 md:h-14 md:w-14">
              <AvatarImage src={user.avatar_url || ""} />
              <AvatarFallback>{getInitials(user.display_name)}</AvatarFallback>
            </Avatar>
            {user.is_online && (
              <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-card bg-emerald-500" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-sans text-base font-semibold">
                    {user.display_name || "Anonymous Reader"}
                  </h3>
                  <StatusBadge status={user.status_badge} />
                </div>
                {user.bio && (
                  <p className="mt-1 line-clamp-2 font-sans text-sm text-muted-foreground">
                    {user.bio}
                  </p>
                )}
              </div>
              <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
                <FollowButton userId={user.id} size="sm" />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {visibleBadges.map((badge) => (
                <Badge
                  key={badge}
                  variant={badge === "Active now" ? "default" : "secondary"}
                  className={cn("text-xs", badge === "Active now" && "bg-emerald-600 text-white")}
                >
                  {badge}
                </Badge>
              ))}
              {user.badges.length > visibleBadges.length && (
                <Badge variant="outline" className="text-xs">
                  +{user.badges.length - visibleBadges.length}
                </Badge>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 font-sans text-sm text-muted-foreground">
              <ReaderMeta icon={APP_ICONS.readers.booksRead} label={`${user.books_read_count} books`} />
              {user.current_streak > 0 && (
                <ReaderMeta icon={APP_ICONS.readers.streak} label={`${user.current_streak} day streak`} />
              )}
              {user.distance_km !== undefined && (
                <ReaderMeta icon={APP_ICONS.readers.distance} label={`${Math.round(user.distance_km)}km away`} />
              )}
              {user.mutual_friend_count > 0 && (
                <ReaderMeta
                  icon={APP_ICONS.readers.friendsOfFriends}
                  label={`${user.mutual_friend_count} mutual`}
                />
              )}
            </div>

            <p className="mt-2 font-sans text-xs text-muted-foreground">
              {user.recommendation_reason}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const StatusBadge = ({ status }: { status: ReaderStatusBadge }) => (
  <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
    {statusLabels[status] || "Available"}
  </Badge>
);

const ReaderMeta = ({
  icon: Icon,
  label,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
}) => (
  <span className="inline-flex items-center gap-1">
    <Icon className="h-4 w-4 text-primary" />
    {label}
  </span>
);

const SectionHeader = ({
  icon: Icon,
  title,
  count,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  count: number;
}) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-2">
      <Icon className="h-5 w-5 text-primary" />
      <h2 className="font-display text-xl font-semibold">{title}</h2>
    </div>
    <Badge variant="secondary">{count}</Badge>
  </div>
);

const SummaryPill = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-md border border-border bg-card px-3 py-2">
    <p className="font-sans text-xs text-muted-foreground">{label}</p>
    <p className="font-sans text-lg font-semibold leading-none">{value}</p>
  </div>
);

const EmptyDiscoverState = ({
  asset,
  title,
  description,
}: {
  asset: EmptyStateAssetKey;
  title: string;
  description: string;
}) => (
  <PremiumEmptyState
    asset={asset}
    title={title}
    description={description}
    size="default"
  />
);
