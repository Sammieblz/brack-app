import { Settings, User, Shield, Bell, Palette, HelpCircle, LogOut, Mail, Lock, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

export type SettingsSection = 
  | 'account' 
  | 'profile' 
  | 'personal' 
  | 'app' 
  | 'notifications' 
  | 'privacy' 
  | 'support';

interface SettingsNavProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  onSignOut: () => void;
}

const sections: Array<{
  id: SettingsSection;
  label: string;
  icon: typeof Settings;
  description?: string;
}> = [
  { id: 'account', label: 'Account', icon: Lock, description: 'Email, password, subscription' },
  { id: 'profile', label: 'Profile', icon: User, description: 'Display name, bio, avatar' },
  { id: 'personal', label: 'Personal Info', icon: Shield, description: 'Name, location, preferences' },
  { id: 'app', label: 'App Preferences', icon: Palette, description: 'Theme, colors, behavior' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Push notifications, quiet hours' },
  { id: 'privacy', label: 'Privacy', icon: Shield, description: 'Visibility, data sharing' },
  { id: 'support', label: 'Support & Help', icon: HelpCircle, description: 'FAQs, contact, feedback' },
];

export const SettingsNav = ({ activeSection, onSectionChange, onSignOut }: SettingsNavProps) => {
  const { triggerHaptic } = useHapticFeedback();

  return (
    <div className="space-y-2">
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.id;
        
        return (
          <Card
            key={section.id}
            className={cn(
              "cursor-pointer transition-all touch-manipulation",
              isActive && "ring-2 ring-primary",
              "hover:bg-accent active:scale-[0.98]"
            )}
            onClick={() => {
              triggerHaptic("light");
              onSectionChange(section.id);
            }}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn(
                  "font-sans font-medium",
                  isActive && "text-primary"
                )}>
                  {section.label}
                </div>
                {section.description && (
                  <div className="font-sans text-xs text-muted-foreground mt-0.5">
                    {section.description}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Sign Out Button */}
      <Card className="mt-6 border-destructive/50">
        <CardContent className="p-4">
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => {
              triggerHaptic("medium");
              onSignOut();
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>

      {/* Account Management */}
      <Card className="mt-4 border-muted">
        <CardContent className="p-4 space-y-2">
          <div className="font-sans text-sm font-medium mb-3">Account Management</div>
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            onClick={() => {
              triggerHaptic("light");
              // TODO: Implement export data
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Export My Data
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            onClick={() => {
              triggerHaptic("light");
              // TODO: Implement clear cache
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Cache
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-destructive"
            onClick={() => {
              triggerHaptic("medium");
              // TODO: Implement delete account
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
