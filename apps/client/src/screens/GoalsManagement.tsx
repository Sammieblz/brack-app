import { GoalManager } from "@/components/GoalManager";
import { useAuth } from "@/hooks/useAuth";
import { LoadingRegion } from "@/components/loading/LoadingRegion";
import { GoalsSkeleton } from "@/components/skeletons/ReadingRouteSkeletons";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";

const GoalsManagement = () => {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();

  if (!user && !loading) {
    return null;
  }

  return (
    <MobileLayout>
      {isMobile && <MobileHeader title="Reading Goals" />}
      <main className="app-page">
        {user ? <GoalManager key={user.id} userId={user.id} /> : <LoadingRegion loading label="Loading reading goals"><GoalsSkeleton /></LoadingRegion>}
      </main>
    </MobileLayout>
  );
};

export default GoalsManagement;
