import { BookListManager } from "@/components/BookListManager";
import { useAuth } from "@/hooks/useAuth";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { useUIEnvironmentValue } from "@/hooks/useUIEnvironment";
import { BookListGridSkeleton } from "@/components/skeletons/BookListCardSkeleton";
import { LoadingRegion } from "@/components/loading/LoadingRegion";
import { ReaderSignInPrompt } from "@/components/auth/ReaderSignInPrompt";
import { useAuthReturnArrival } from "@/hooks/useAuthReturnArrival";

const BookLists = () => {
  const { user, loading } = useAuth();
  const pathname = useAuthReturnArrival(!loading && Boolean(user));
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

  return (
    <MobileLayout>
      {compactNavigation && <MobileHeader title="Book Lists" />}
      <main className="app-page">
        {user ? <BookListManager key={user.id} userId={user.id} showTitle={!compactNavigation} /> : <ReaderSignInPrompt
          destination={pathname} title="Sign in to your book lists"
          description="Keep your collections together. Sign in to open your lists, or return home to explore Brack." />}
      </main>
    </MobileLayout>
  );
};

export default BookLists;
