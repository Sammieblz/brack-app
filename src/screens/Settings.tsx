import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { PersonalInfo } from "@/components/settings/PersonalInfo";
import { AppPreferences } from "@/components/settings/AppPreferences";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { PrivacySettings } from "@/components/settings/PrivacySettings";
import { SupportContact } from "@/components/settings/SupportContact";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileAlertDialog } from "@/components/ui/mobile-dialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Settings as SettingsIcon, User, Shield, Bell, Palette, HelpCircle, LogOut } from "lucide-react";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

type SettingsSection = 
  | 'account' 
  | 'profile' 
  | 'personal' 
  | 'app' 
  | 'notifications' 
  | 'privacy' 
  | 'support';

const sections: Array<{
  id: SettingsSection;
  label: string;
  icon: typeof SettingsIcon;
  description: string;
  component: (user: { id: string }) => React.ReactNode;
}> = [
  { 
    id: 'account', 
    label: 'Account', 
    icon: SettingsIcon, 
    description: 'Email, password, subscription',
    component: (user) => <AccountSettings user={user} />
  },
  { 
    id: 'profile', 
    label: 'Profile', 
    icon: User, 
    description: 'Display name, bio, avatar',
    component: (user) => <ProfileSettings user={user} />
  },
  { 
    id: 'personal', 
    label: 'Personal Info', 
    icon: Shield, 
    description: 'Name, location, preferences',
    component: (user) => <PersonalInfo user={user} />
  },
  { 
    id: 'app', 
    label: 'App Preferences', 
    icon: Palette, 
    description: 'Theme, colors, behavior',
    component: () => <AppPreferences />
  },
  { 
    id: 'notifications', 
    label: 'Notifications', 
    icon: Bell, 
    description: 'Push notifications, quiet hours',
    component: (user) => <NotificationSettings user={user} />
  },
  { 
    id: 'privacy', 
    label: 'Privacy', 
    icon: Shield, 
    description: 'Visibility, data sharing',
    component: (user) => <PrivacySettings user={user} />
  },
  { 
    id: 'support', 
    label: 'Support & Help', 
    icon: HelpCircle, 
    description: 'FAQs, contact, feedback',
    component: () => <SupportContact />
  },
];

const Settings = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { triggerHaptic } = useHapticFeedback();
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
      navigate("/auth");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to sign out. Please try again.",
      });
    }
    setShowSignOutDialog(false);
  };

  if (authLoading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner size="lg" text="Loading settings..." />
        </div>
      </MobileLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <MobileLayout>
      {isMobile && <MobileHeader title="Settings" showBack />}
      
      <div className="container max-w-4xl mx-auto p-4 md:p-6">
        {!isMobile && (
          <div className="mb-6">
            <h1 className="font-display text-3xl font-bold">Settings</h1>
            <p className="font-sans text-muted-foreground mt-1">
              Manage your account and preferences
            </p>
          </div>
        )}

        <Accordion type="single" collapsible className="w-full space-y-2">
          {sections.map((section) => {
            const Icon = section.icon;
            
            return (
              <AccordionItem 
                key={section.id} 
                value={section.id}
                className="border rounded-lg px-4 bg-card"
              >
                <AccordionTrigger 
                  className="hover:no-underline py-4"
                  onClick={() => triggerHaptic("light")}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-sans font-medium">{section.label}</div>
                      <div className="font-sans text-xs text-muted-foreground mt-0.5">
                        {section.description}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4 pt-0">
                  <div className="pt-2">
                    {section.component(user)}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {/* Sign Out Button */}
        <Card className="mt-6 border-destructive/50">
          <CardContent className="p-4">
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => {
                triggerHaptic("medium");
                setShowSignOutDialog(true);
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Sign Out Confirmation Dialog */}
      <MobileAlertDialog
        open={showSignOutDialog}
        onOpenChange={setShowSignOutDialog}
        title="Sign Out"
        description="Are you sure you want to sign out? You'll need to sign in again to access your account."
        cancelText="Cancel"
        confirmText="Sign Out"
        onConfirm={handleSignOut}
        variant="destructive"
      />
    </MobileLayout>
  );
};

export default Settings;
