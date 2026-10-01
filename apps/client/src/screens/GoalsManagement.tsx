import { GoalManager } from "@/components/GoalManager";
import { useAuth } from "@/hooks/useAuth";
import { LoadingRegion } from "@/components/loading/LoadingRegion";
import { GoalsSkeleton } from "@/components/skeletons/ReadingRouteSkeletons";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { useUIEnvironmentValue } from "@/hooks/useUIEnvironment";
import { ReaderSignInPrompt } from "@/components/auth/ReaderSignInPrompt";
import { useAuthReturnArrival } from "@/hooks/useAuthReturnArrival";

const GoalsManagement = () => {
  const { user, loading } = useAuth();
  const pathname = useAuthReturnArrival(!loading && Boolean(user));
  const compactNavigation = useUIEnvironmentValue((environment) => environment.windowClass !== "expanded");

  return (
    <MobileLayout>
      {compactNavigation && <MobileHeader title="Reading Goals" />}
      <main className="app-page">
        {loading ? <LoadingRegion loading label="Loading reading goals"><GoalsSkeleton /></LoadingRegion>
          : user ? <GoalManager key={user.id} userId={user.id} /> : <ReaderSignInPrompt
            destination={pathname} title="Sign in to your reading goals"
            description="Make room for your next chapter. Sign in to see your goals and reading progress, or return home to explore Brack." />}
      </main>
    </MobileLayout>
  );
};

export default GoalsManagement;
