import { BookListManager } from "@/components/BookListManager";
import { useAuth } from "@/hooks/useAuth";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { useUIEnvironmentValue } from "@/hooks/useUIEnvironment";
import { BookListGridSkeleton } from "@/components/skeletons/BookListCardSkeleton";
import { LoadingRegion } from "@/components/loading/LoadingRegion";

const BookLists = () => {
  const { user, loading } = useAuth();
  const compactNavigation = useUIEnvironmentValue((environment) => environment.windowClass !== "expanded");

  if (loading) {
    return (
      <MobileLayout>
        {compactNavigation && <MobileHeader title="Book Lists" />}
        <main className="app-page">
          <LoadingRegion loading label="Loading your book lists">
            <BookListGridSkeleton />
          </LoadingRegion>
        </main>
      </MobileLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <MobileLayout>
      {compactNavigation && <MobileHeader title="Book Lists" />}
      <main className="app-page">
        <BookListManager key={user.id} userId={user.id} />
      </main>
    </MobileLayout>
  );
};

export default BookLists;
