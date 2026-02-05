import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Shield } from "lucide-react";
import type { User } from "@/types";

interface PrivacySettingsProps {
  user: User;
}

export const PrivacySettings = ({ user }: PrivacySettingsProps) => {
  // TODO: Implement privacy settings
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Privacy Settings</h2>
        <p className="text-muted-foreground mt-1">
          Control your privacy and data sharing preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Profile Visibility
          </CardTitle>
          <CardDescription>
            Control who can see your profile and reading activity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Public Profile</Label>
              <p className="text-sm text-muted-foreground">
                Allow others to find and view your profile
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Show Reading Activity</Label>
              <p className="text-sm text-muted-foreground">
                Display your reading activity on your profile
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Show Location</Label>
              <p className="text-sm text-muted-foreground">
                Allow others to see your location for reader discovery
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Sharing</CardTitle>
          <CardDescription>
            Control how your data is used
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Analytics</Label>
              <p className="text-sm text-muted-foreground">
                Help improve the app by sharing anonymous usage data
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
