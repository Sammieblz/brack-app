import { GoalManager } from "@/components/GoalManager";
import { useAuth } from "@/hooks/useAuth";
import LoadingSpinner from "@/components/LoadingSpinner";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";

const GoalsManagement = () => {
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
      {isMobile && <MobileHeader title="Reading Goals" showBack />}
      <main className="container mx-auto p-4 md:p-6">
        <GoalManager userId={user.id} />
      </main>
    </MobileLayout>
  );
};

export default GoalsManagement;
