import { useEffect, useMemo, useState, type ComponentType } from "react";
import { BookClubCard } from "@/components/clubs/BookClubCard";
import { CreateClubDialog } from "@/components/clubs/CreateClubDialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import { MobileHeader } from "@/components/MobileHeader";
import { MobileLayout } from "@/components/MobileLayout";
import { NativeHeader } from "@/components/NativeHeader";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { APP_ICONS } from "@/config/iconography";
import { useBookClubs, type BookClub } from "@/hooks/useBookClubs";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type SectionKey =
  | "myClubs"
  | "suggested"
  | "nearby"
  | "popular"
  | "newest"
  | "invites"
  | "pendingRequests";

const sectionMeta: Record<
  SectionKey,
  {
    label: string;
    description: string;
    icon: ComponentType<{ className?: string }>;
  }
> = {
  myClubs: {
    label: "My Clubs",
    description: "Groups you belong to",
    icon: APP_ICONS.readers.myClubs,
  },
  suggested: {
    label: "Suggested",
    description: "Ranked by genres, connections, and activity",
    icon: APP_ICONS.readers.suggestions,
  },
  nearby: {
    label: "Nearby",
    description: "Clubs using your saved location",
    icon: APP_ICONS.readers.nearby,
  },
  popular: {
    label: "Popular",
    description: "Active public and previewable private clubs",
    icon: APP_ICONS.readers.discoverClubs,
  },
  newest: {
    label: "New",
    description: "Recently created clubs",
    icon: APP_ICONS.dashboard.recentActivity,
  },
  invites: {
    label: "Invites",
    description: "Private club invitations waiting for you",
    icon: APP_ICONS.settings.sendMessage,
  },
  pendingRequests: {
    label: "Requests",
    description: "Clubs reviewing your join request",
    icon: APP_ICONS.bookDetail.logProgress,
  },
};

const BookClubs = () => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeSection, setActiveSection] = useState<SectionKey>("suggested");
  const isMobile = useIsMobile();

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const {
    home,
    sections,
    loading,
    createClub,
    joinClub,
    leaveClub,
    requestClub,
    respondInvite,
    fetchClubs,
  } = useBookClubs({ searchQuery: debouncedQuery });

  const createAction = <CreateClubDialog compact={isMobile} onCreateClub={createClub} />;
  const showingSearch = debouncedQuery.length > 0;
  const activeItems = showingSearch ? home.searchResults : sections[activeSection];
  const activeMeta = showingSearch
    ? {
        label: "Search Results",
        description: "Ranked by relevance, relationship, and club activity",
        icon: APP_ICONS.common.search,
      }
    : sectionMeta[activeSection];

  const statCards = useMemo(
    () => [
      {
        label: "My clubs",
        value: home.summary.my_clubs,
        icon: APP_ICONS.readers.myClubs,
      },
      {
        label: "Suggestions",
        value: home.summary.suggested,
        icon: APP_ICONS.readers.suggestions,
      },
      {
        label: "Nearby",
        value: home.summary.nearby,
        icon: APP_ICONS.readers.nearby,
      },
      {
        label: "Invites",
        value: home.summary.invites,
        icon: APP_ICONS.settings.sendMessage,
      },
    ],
    [home.summary],
  );

  return (
    <MobileLayout>
      {isMobile ? (
        <MobileHeader title="Book Clubs" action={createAction} />
      ) : (
        <NativeHeader
          title="Book Clubs"
          subtitle="Find the right room for your next shared read"
          action={createAction}
          showUtilityActions
        />
      )}

      <PullToRefresh onRefresh={fetchClubs}>
        <main className="app-page">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => (
              <SummaryCard key={card.label} {...card} />
            ))}
          </section>

          <Card className="mt-5 border-border/70">
            <CardContent className="space-y-4 p-3 sm:p-4">
              <div className="relative">
                <APP_ICONS.common.search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search clubs by name, genre, tag, region, or current book"
                  className="h-12 rounded-full pl-11"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {(Object.keys(sectionMeta) as SectionKey[]).map((key) => {
                  const Icon = sectionMeta[key].icon;
                  const count = sections[key].length;
                  return (
                    <Button
                      key={key}
                      type="button"
                      variant={activeSection === key && !showingSearch ? "default" : "outline"}
                      className="shrink-0 gap-2 rounded-full"
                      onClick={() => {
                        setActiveSection(key);
                        if (query) setQuery("");
                      }}
                    >
                      <Icon className="h-4 w-4" />
                      {sectionMeta[key].label}
                      <Badge variant="secondary" className="ml-1 h-5 rounded-full px-2">
                        {count}
                      </Badge>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <section className="mt-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <activeMeta.icon className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-2xl font-semibold">{activeMeta.label}</h2>
                </div>
                <p className="mt-1 font-sans text-sm text-muted-foreground">{activeMeta.description}</p>
              </div>
              {showingSearch && (
                <Button variant="ghost" onClick={() => setQuery("")}>
                  Clear search
                </Button>
              )}
            </div>

            {loading ? (
              <Card>
                <CardContent className="flex min-h-[18rem] items-center justify-center">
                  <LoadingSpinner />
                </CardContent>
              </Card>
            ) : (
              <ClubGrid
                clubs={activeItems}
                emptyIcon={activeMeta.icon}
                emptyTitle={showingSearch ? "No clubs matched your search" : `No ${activeMeta.label.toLowerCase()} yet`}
                emptyDescription={
                  showingSearch
                    ? "Try a genre, city, current book, or shorter club name."
                    : getEmptyDescription(activeSection)
                }
                onJoin={joinClub}
                onLeave={leaveClub}
                onRequestJoin={requestClub}
                onAcceptInvite={(inviteId) => respondInvite(inviteId, "accept")}
                onDeclineInvite={(inviteId) => respondInvite(inviteId, "decline")}
              />
            )}
          </section>
        </main>
      </PullToRefresh>
    </MobileLayout>
  );
};

const SummaryCard = ({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) => (
  <Card>
    <CardContent className="flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="font-sans text-2xl font-semibold leading-none">{value}</p>
        <p className="mt-1 truncate font-sans text-sm text-muted-foreground">{label}</p>
      </div>
    </CardContent>
  </Card>
);

const ClubGrid = ({
  clubs,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyDescription,
  onJoin,
  onLeave,
  onRequestJoin,
  onAcceptInvite,
  onDeclineInvite,
}: {
  clubs: BookClub[];
  emptyIcon: ComponentType<{ className?: string }>;
  emptyTitle: string;
  emptyDescription: string;
  onJoin: (clubId: string) => Promise<void>;
  onLeave: (clubId: string) => Promise<void>;
  onRequestJoin: (clubId: string, message?: string) => Promise<void>;
  onAcceptInvite: (inviteId: string) => Promise<void>;
  onDeclineInvite: (inviteId: string) => Promise<void>;
}) => {
  if (clubs.length === 0) {
    return (
      <Card>
        <CardContent className="flex min-h-[20rem] flex-col items-center justify-center p-8 text-center">
          <EmptyIcon className="mb-4 h-10 w-10 text-muted-foreground" />
          <h3 className="font-display text-xl font-semibold">{emptyTitle}</h3>
          <p className="mt-2 max-w-sm font-sans text-sm text-muted-foreground">{emptyDescription}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("grid gap-4 md:grid-cols-2 2xl:grid-cols-3")}>
      {clubs.map((club, index) => (
        <BookClubCard
          key={club.id}
          club={club}
          variant={index === 0 ? "featured" : "default"}
          onJoin={onJoin}
          onLeave={onLeave}
          onRequestJoin={onRequestJoin}
          onAcceptInvite={onAcceptInvite}
          onDeclineInvite={onDeclineInvite}
        />
      ))}
    </div>
  );
};

const getEmptyDescription = (section: SectionKey) => {
  switch (section) {
    case "myClubs":
      return "Join a public club, request a private club, or create a focused group for your next read.";
    case "nearby":
      return "Add your city and enable location visibility in Settings to unlock regional discovery.";
    case "invites":
      return "Private club invitations will appear here when admins invite you.";
    case "pendingRequests":
      return "When you request access to a private club, you can track it here.";
    default:
      return "Create a richer club profile with genres, tags, and a region so Brack can suggest it to the right readers.";
  }
};

export default BookClubs;
