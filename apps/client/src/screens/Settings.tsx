import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { PersonalInfo } from "@/components/settings/PersonalInfo";
import { AppPreferences } from "@/components/settings/AppPreferences";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { PrivacySettings } from "@/components/settings/PrivacySettings";
import { SupportContact } from "@/components/settings/SupportContact";
import { ReadingProfileSettings } from "@/components/settings/ReadingProfileSettings";
import { DataBackupSettings } from "@/components/settings/DataBackupSettings";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileAlertDialog } from "@/components/ui/mobile-dialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppIcon } from "@/components/ui/app-icon";
import { APP_ICONS, type AppIcon as AppIconType } from "@/config/iconography";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { cn } from "@/lib/utils";

type SettingsSection = 
  | 'account' 
  | 'profile' 
  | 'personal' 
  | 'reading'
  | 'data'
  | 'app' 
  | 'notifications' 
  | 'privacy' 
  | 'support';

const sections: Array<{
  id: SettingsSection;
  label: string;
  icon: AppIconType;
  description: string;
  component: (user: { id: string }) => React.ReactNode;
}> = [
  {
    id: 'account', 
    label: 'Account', 
    icon: APP_ICONS.settings.account,
    description: 'Email, password, subscription',
    component: (user) => <AccountSettings user={user} />
  },
  { 
    id: 'profile', 
    label: 'Profile', 
    icon: APP_ICONS.settings.profile,
    description: 'Display name, bio, avatar',
    component: (user) => <ProfileSettings user={user} />
  },
  { 
    id: 'personal', 
    label: 'Personal Info', 
    icon: APP_ICONS.settings.personal,
    description: 'Name, location, preferences',
    component: (user) => <PersonalInfo user={user} />
  },
  {
    id: 'reading',
    label: 'Reading Profile',
    icon: APP_ICONS.settings.readingProfile,
    description: 'Taste, pace, learning signals',
    component: (user) => <ReadingProfileSettings user={user} />
  },
  {
    id: 'data',
    label: 'Data & Backup',
    icon: APP_ICONS.settings.dataBackup,
    description: 'Export, import, restore',
    component: (user) => <DataBackupSettings user={user} />
  },
  { 
    id: 'app', 
    label: 'App Preferences', 
    icon: APP_ICONS.settings.app,
    description: 'Theme, colors, behavior',
    component: () => <AppPreferences />
  },
  { 
    id: 'notifications', 
    label: 'Notifications', 
    icon: APP_ICONS.settings.notifications,
    description: 'Push notifications, quiet hours',
    component: (user) => <NotificationSettings user={user} />
  },
  { 
    id: 'privacy', 
    label: 'Privacy', 
    icon: APP_ICONS.settings.privacy,
    description: 'Visibility, data sharing',
    component: (user) => <PrivacySettings user={user} />
  },
  { 
    id: 'support', 
    label: 'Support & Help', 
    icon: APP_ICONS.settings.support,
    description: 'FAQs, contact, feedback',
    component: () => <SupportContact />
  },
];

const getSettingsSection = (value: string | null): SettingsSection | null =>
  sections.some((section) => section.id === value) ? (value as SettingsSection) : null;

const Settings = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { triggerHaptic } = useHapticFeedback();
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>(
    () => getSettingsSection(searchParams.get('section')) ?? 'account'
  );

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    setActiveSection(getSettingsSection(searchParams.get('section')) ?? 'account');
  }, [searchParams]);

  const handleSectionChange = (section: SettingsSection) => {
    triggerHaptic("light");
    setActiveSection(section);

    if (section === 'account') {
      setSearchParams({}, { replace: true });
      return;
    }

    setSearchParams({ section }, { replace: true });
  };

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
      {isMobile && <MobileHeader title="Settings" />}
      
      <div className="app-page-narrow min-w-0 overflow-x-hidden">
        {!isMobile && (
          <div className="mb-6">
            <h1 className="font-display text-3xl font-bold">Settings</h1>
            <p className="font-sans text-muted-foreground mt-1">
              Manage your account and preferences
            </p>
          </div>
        )}

        {isMobile ? (
          <Accordion type="single" collapsible defaultValue={activeSection} className="w-full space-y-2">
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
                      <AppIcon icon={Icon} variant="inline" size="md" className="text-primary" />
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
        ) : (
          <div className="app-equal-panel-grid grid min-w-0 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <Card className="app-equal-panel lg:self-stretch">
              <CardContent className="app-equal-panel-scroll p-2">
                {sections.map((section) => {
                  const Icon = section.icon;
                  const active = activeSection === section.id;

                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => handleSectionChange(section.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors",
                        active
                          ? "bg-primary/12 text-primary"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      <AppIcon icon={Icon} variant="inline" size="md" className="shrink-0" />
                      <span className="min-w-0">
                        <span className="block font-sans text-sm font-medium">{section.label}</span>
                        <span className="block truncate font-sans text-xs opacity-80">{section.description}</span>
                      </span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="app-equal-panel min-w-0 overflow-hidden">
              <CardContent className="app-equal-panel-scroll min-w-0 p-6">
                {sections.find((section) => section.id === activeSection)?.component(user)}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Sign Out Button */}
        <Card className="mt-6 border-primary/25 bg-primary/[0.03]">
          <CardContent className="p-4">
            <Button
              variant="outline"
              className="w-full border-primary/35 bg-primary/10 text-primary hover:border-primary/50 hover:bg-primary/15 hover:text-primary focus-visible:ring-primary/40"
              onClick={() => {
                triggerHaptic("medium");
                setShowSignOutDialog(true);
              }}
            >
              <AppIcon icon={APP_ICONS.common.signOut} variant="action" className="mr-2" />
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
