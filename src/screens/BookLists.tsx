import { Navbar } from "@/components/Navbar";
import { BookListManager } from "@/components/BookListManager";
import { useAuth } from "@/hooks/useAuth";
import LoadingSpinner from "@/components/LoadingSpinner";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useState } from "react";

const BookLists = () => {
  const { user, loading } = useAuth();
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
    <div className="min-h-screen bg-background">
      <Navbar />
      <PullToRefresh onRefresh={handleRefresh}>
        <main className="container mx-auto p-6">
          <BookListManager key={refreshKey} userId={user.id} />
        </main>
      </PullToRefresh>
    </div>
  );
};

export default BookLists;
