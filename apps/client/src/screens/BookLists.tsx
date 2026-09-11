import { BookListManager } from "@/components/BookListManager";
import { useAuth } from "@/hooks/useAuth";
import LoadingSpinner from "@/components/LoadingSpinner";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";

const BookLists = () => {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();

  if (loading) {
    return <LoadingSpinner />;
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
