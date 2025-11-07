import { Navbar } from "@/components/Navbar";
import { GoalManager } from "@/components/GoalManager";
import { useAuth } from "@/hooks/useAuth";
import LoadingSpinner from "@/components/LoadingSpinner";

const GoalsManagement = () => {
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
        <GoalManager userId={user.id} />
      </main>
    </div>
  );
};

export default GoalsManagement;
