import { BookListManager } from "@/components/BookListManager";
import { useAuth } from "@/hooks/useAuth";
import LoadingSpinner from "@/components/LoadingSpinner";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useState } from "react";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";

const BookLists = () => {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();
  const [refreshKey, setRefreshKey] = useState(0);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return null;
  }

  const handleRefresh = async () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <MobileLayout>
      {isMobile && <MobileHeader title="Book Lists" showBack />}
      <PullToRefresh onRefresh={handleRefresh}>
        <main className="container mx-auto p-4 md:p-6">
          <BookListManager key={refreshKey} userId={user.id} />
        </main>
      </PullToRefresh>
    </MobileLayout>
  );
};

export default BookLists;
