import { BookListManager } from "@/components/BookListManager";
import { useAuth } from "@/hooks/useAuth";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";
import { BookListGridSkeleton } from "@/components/skeletons/BookListCardSkeleton";
import { LoadingRegion } from "@/components/loading/LoadingRegion";

const BookLists = () => {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();

  if (loading) {
    return (
      <MobileLayout>
        {isMobile && <MobileHeader title="Book Lists" />}
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
      {isMobile && <MobileHeader title="Book Lists" />}
      <main className="app-page">
        <BookListManager key={user.id} userId={user.id} />
      </main>
    </MobileLayout>
  );
};

export default BookLists;
