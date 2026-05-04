import { BookClubCard } from "@/components/clubs/BookClubCard";
import { CreateClubDialog } from "@/components/clubs/CreateClubDialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import { MobileHeader } from "@/components/MobileHeader";
import { MobileLayout } from "@/components/MobileLayout";
import { NativeHeader } from "@/components/NativeHeader";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { APP_ICONS } from "@/config/iconography";
import { useBookClubs } from "@/hooks/useBookClubs";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ComponentType } from "react";

const BookClubs = () => {
  const { clubs, loading, createClub, joinClub, leaveClub, fetchClubs } = useBookClubs();
  const isMobile = useIsMobile();

  const myClubs = clubs.filter((club) => club.user_role);
  const publicClubs = clubs.filter((club) => !club.is_private && !club.user_role);
  const createAction = <CreateClubDialog compact={isMobile} onCreateClub={createClub} />;

  return (
    <MobileLayout>
      {isMobile ? (
        <MobileHeader title="Book Clubs" action={createAction} />
      ) : (
        <NativeHeader
          title="Book Clubs"
          subtitle="Organize conversations around shared reading"
          action={createAction}
          showUtilityActions
        />
      )}

      <PullToRefresh onRefresh={fetchClubs}>
        <main className="app-page">
          <section className="grid grid-cols-3 gap-2 sm:gap-3">
            <SummaryCard icon={APP_ICONS.readers.myClubs} label="My clubs" value={myClubs.length} />
            <SummaryCard icon={APP_ICONS.readers.discoverClubs} label="Discover" value={publicClubs.length} />
            <SummaryCard icon={APP_ICONS.readers.clubs} label="Total clubs" value={clubs.length} />
          </section>

          {loading ? (
            <Card className="mt-5">
              <CardContent className="flex min-h-[18rem] items-center justify-center">
                <LoadingSpinner />
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="my-clubs" className="mt-5">
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
                  <EmptyClubState
                    icon={APP_ICONS.readers.clubs}
                    title="No clubs yet"
                    description="Create a focused reading group or join a public club from Discover."
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
                  <EmptyClubState
                    icon={APP_ICONS.readers.discoverClubs}
                    title="No public clubs"
                    description="Create a public club so other readers can find and join the conversation."
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
    <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary sm:h-10 sm:w-10">
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
      <div className="min-w-0">
        <p className="font-sans text-lg font-semibold leading-none sm:text-2xl">{value}</p>
        <p className="mt-1 truncate font-sans text-xs text-muted-foreground sm:text-sm">{label}</p>
      </div>
    </CardContent>
  </Card>
);

const EmptyClubState = ({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) => (
  <Card>
    <CardContent className="flex min-h-[18rem] flex-col items-center justify-center p-8 text-center">
      <Icon className="mb-4 h-10 w-10 text-muted-foreground" />
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm font-sans text-sm text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
);

export default BookClubs;
