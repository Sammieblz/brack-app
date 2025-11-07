import { Navbar } from "@/components/Navbar";
import { BookListManager } from "@/components/BookListManager";
import { useAuth } from "@/hooks/useAuth";
import LoadingSpinner from "@/components/LoadingSpinner";

const BookLists = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto p-6">
        <BookListManager userId={user.id} />
      </main>
    </div>
  );
};

export default BookLists;
