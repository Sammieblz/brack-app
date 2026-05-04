import { type ComponentType, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BookClubCard } from "@/components/clubs/BookClubCard";
import { Card, CardContent } from "@/components/ui/card";
import { CreateClubDialog } from "@/components/clubs/CreateClubDialog";
import { FollowButton } from "@/components/social/FollowButton";
import { Input } from "@/components/ui/input";
import LoadingSpinner from "@/components/LoadingSpinner";
import { MobileHeader } from "@/components/MobileHeader";
import { MobileLayout } from "@/components/MobileLayout";
import { NativeHeader } from "@/components/NativeHeader";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { APP_ICONS } from "@/config/iconography";
import { useBookClubs } from "@/hooks/useBookClubs";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useIsMobile } from "@/hooks/use-mobile";
import { type UserSearchResult, useUserSearch } from "@/hooks/useUserSearch";

type MainTab = "readers" | "clubs";
type ReaderFilter = "all" | "nearby" | "social" | "taste" | "active";

const readerFilters: Array<{
  value: ReaderFilter;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { value: "all", label: "All", icon: APP_ICONS.readers.all },
  { value: "nearby", label: "Nearby", icon: APP_ICONS.readers.nearby },
  { value: "social", label: "Connections", icon: APP_ICONS.readers.connections },
  { value: "taste", label: "Similar Taste", icon: APP_ICONS.readers.similarTaste },
  { value: "active", label: "Active", icon: APP_ICONS.readers.active },
];

export default function Readers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<MainTab>("readers");
  const [readerFilter, setReaderFilter] = useState<ReaderFilter>("all");
  const { results, loading } = useUserSearch(searchQuery);
  const { clubs, loading: clubsLoading, createClub, joinClub, leaveClub } = useBookClubs();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { triggerHaptic } = useHapticFeedback();

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
    switch (readerFilter) {
      case "nearby":
        return results.nearby;
      case "social":
        return results.socialConnections;
      case "taste":
        return results.similarTaste;
      case "active":
        return results.activeReaders;
      default:
        return results.all;
    }
  }, [readerFilter, results]);

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
          subtitle="Find readers, follow taste matches, and join book communities"
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

              <div className="hidden gap-3 sm:grid sm:grid-cols-3 lg:w-[28rem]">
                <SummaryPill label="Readers" value={results.all.length} />
                <SummaryPill label="Following" value={results.socialConnections.length} />
                <SummaryPill label="Clubs" value={clubs.length} />
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

                  <div className="overflow-x-auto">
                    <Tabs value={readerFilter} onValueChange={(value) => setReaderFilter(value as ReaderFilter)}>
                      <TabsList className="min-w-max shadow-none">
                        {readerFilters
                          .filter((item) => !isMobile || (item.value !== "social" && item.value !== "taste"))
                          .map(({ value, label, icon: Icon }) => (
                            <TabsTrigger key={value} value={value} className="gap-2 px-3">
                              <Icon className="h-4 w-4" />
                              <span>{label}</span>
                            </TabsTrigger>
                          ))}
                      </TabsList>
                    </Tabs>
                  </div>
                </CardContent>
              </Card>

              {loading ? (
                <Card>
                  <CardContent className="flex min-h-[16rem] items-center justify-center">
                    <LoadingSpinner />
                  </CardContent>
                </Card>
              ) : visibleReaders.length === 0 ? (
                <EmptyDiscoverState
                  icon={APP_ICONS.readers.readers}
                  title={searchQuery ? "No matching readers" : "No readers found"}
                  description={
                    searchQuery
                      ? "Try a different name or clear the search."
                      : "As more people build their reading profiles, they will appear here."
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
                        icon={APP_ICONS.readers.clubs}
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
                        icon={APP_ICONS.readers.discoverClubs}
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

const ReaderCard = ({ user, onOpen }: { user: UserSearchResult; onOpen: () => void }) => (
  <Card className="cursor-pointer" onClick={onOpen}>
    <CardContent className="p-4">
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12 shrink-0 md:h-14 md:w-14">
          <AvatarImage src={user.avatar_url || ""} />
          <AvatarFallback>{getInitials(user.display_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate font-sans text-base font-semibold">
                  {user.display_name || "Anonymous Reader"}
                </h3>
                {user.recommendation_reason && (
                  <Badge variant="secondary" className="text-xs">
                    {user.recommendation_reason}
                  </Badge>
                )}
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
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 font-sans text-sm text-muted-foreground">
            <ReaderMeta icon={APP_ICONS.readers.booksRead} label={`${user.books_read_count} books`} />
            {user.current_streak > 0 && (
              <ReaderMeta icon={APP_ICONS.readers.streak} label={`${user.current_streak} day streak`} />
            )}
            {user.distance_km !== undefined && (
              <ReaderMeta icon={APP_ICONS.readers.distance} label={`${Math.round(user.distance_km)}km away`} />
            )}
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
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

const SummaryPill = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-md border border-border bg-card px-3 py-2">
    <p className="font-sans text-xs text-muted-foreground">{label}</p>
    <p className="font-sans text-lg font-semibold leading-none">{value}</p>
  </div>
);

const EmptyDiscoverState = ({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) => (
  <Card>
    <CardContent className="flex min-h-[16rem] flex-col items-center justify-center p-8 text-center">
      <Icon className="mb-4 h-10 w-10 text-muted-foreground" />
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm font-sans text-sm text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
);
