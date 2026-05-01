import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReadingHabitsSection } from "@/components/ReadingHabitsSection";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { needsSetupPrompt } from "@/services/onboarding";
import { APP_ICONS } from "@/config/iconography";

interface ReadingProfileSettingsProps {
  user: { id: string };
}

export const ReadingProfileSettings = ({ user }: ReadingProfileSettingsProps) => {
  const navigate = useNavigate();
  const { status } = useOnboardingStatus(user.id);
  const shouldPrompt = needsSetupPrompt(status?.onboarding_status);

  return (
    <div className="space-y-4">
      {shouldPrompt && (
        <Card className="border-primary/40 bg-primary/8">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-primary/12 p-2 text-primary">
                <APP_ICONS.dashboard.insights className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold">Finish reading setup</h3>
                <p className="font-sans text-sm text-muted-foreground">
                  Complete the onboarding profile so Brack can personalize goals, suggestions, and discovery.
                </p>
              </div>
            </div>
            <Button onClick={() => navigate("/onboarding?from=settings")}>Resume setup</Button>
          </CardContent>
        </Card>
      )}

      <ReadingHabitsSection userId={user.id} />
    </div>
  );
};
