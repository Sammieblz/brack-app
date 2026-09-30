import { SettingsTaskProvider } from "@/contexts/SettingsTaskProvider";
import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SupportPageLink } from "@/components/SupportPageLink";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { PersonalInfo } from "@/components/settings/PersonalInfo";
import { AppPreferences } from "@/components/settings/AppPreferences";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { PrivacySettings } from "@/components/settings/PrivacySettings";
import { ReadingProfileSettings } from "@/components/settings/ReadingProfileSettings";
import { DataBackupSettings } from "@/components/settings/DataBackupSettings";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRegisterSettingsSignOut, useSettingsLeave, useSettingsTask } from "@/contexts/SettingsTaskContext";
import { useUIEnvironmentValue } from "@/hooks/useUIEnvironment";
import { MobileDialog } from "@/components/ui/mobile-dialog";
import { LoadingRegion } from "@/components/loading/LoadingRegion";
import { AccountSettingsSkeleton, PersonalInfoSkeleton, PreferenceSettingsSkeleton, ProfileFormSkeleton, ReadingHabitsSkeleton } from "@/components/skeletons/SettingsSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
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
    component: () => null
  },
];

const getSettingsSection = (value: string | null): SettingsSection | null =>
  sections.some((section) => section.id === value) ? (value as SettingsSection) : null;

const SettingsContent = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const leave = useSettingsLeave();
  const compactNavigation = useUIEnvironmentValue((environment) => environment.windowClass !== "expanded");
  const { triggerHaptic } = useHapticFeedback();
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const signOutTriggerRef = useRef<HTMLButtonElement>(null);
  const activeSection = getSettingsSection(searchParams.get('section'));
  const selectedSection = sections.find(section => section.id === activeSection && section.id !== 'support');
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const categoryButtons = useRef(new Map<string, HTMLButtonElement>());
  const previousSection = useRef(activeSection);
  const signingOut = useRef(false);
  const mounted = useRef(false);
  const [signOutPending, setSignOutPending] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  useRegisterSettingsSignOut(() => { setSignOutError(null); setShowSignOutDialog(true); });
  useSettingsTask({ dirty: false, pending: signOutPending });
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);
  useEffect(() => {
    if (activeSection === 'support') navigate('/support', { replace: true });
  }, [activeSection, navigate]);
  // Selection changes move focus; width-only changes never replace/focus the editor.
  useLayoutEffect(() => {
    if (previousSection.current === activeSection) return;
    if (activeSection) editorHeading.current?.focus();
    else if (previousSection.current) categoryButtons.current.get(previousSection.current)?.focus();
    previousSection.current = activeSection;
  }, [activeSection]);

  const setSection = (section: SettingsSection | null) => {
    triggerHaptic("light");
    const next = new URLSearchParams(searchParams);
    if (section) next.set('section', section);
    else next.delete('section');
    setSearchParams(next, { replace: true });
  };
  const handleSectionChange = (section: SettingsSection) => {
    if (section !== activeSection) void leave(() => setSection(section));
  };

  const handleSignOut = async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    setSignOutPending(true);
    setSignOutError(null);
    try {
      await signOut();
      if (!mounted.current) return;
      toast({ title: "Signed out", description: "You have been successfully signed out." });
      navigate("/auth");
    } catch {
      if (mounted.current) setSignOutError("Failed to sign out. Please try again.");
    } finally {
      signingOut.current = false;
      if (mounted.current) setSignOutPending(false);
    }
  };

  if (!user && !authLoading) {
    return null;
  }

  const sectionContent = (section: (typeof sections)[number]) => {
    if (user && !authLoading) return <React.Fragment key={user.id}>{section.component(user)}</React.Fragment>;
    if (section.id === "profile") return <ProfileFormSkeleton />;
    if (section.id === "personal") return <PersonalInfoSkeleton />;
    if (section.id === "reading") return <Card><CardContent className="space-y-6 p-6"><h2 className="font-display text-2xl font-semibold">Reading Habits</h2><ReadingHabitsSkeleton /></CardContent></Card>;
    if (section.id === "notifications") return <PreferenceSettingsSkeleton />;
    if (section.id === "privacy") return <PreferenceSettingsSkeleton privacy />;
    if (section.id === "app") return <AppPreferences />;
    if (section.id === "data") return <div aria-hidden="true" className="pointer-events-none space-y-6"><h2 className="font-display text-2xl font-bold">Data &amp; Backup</h2>{["Export reading data", "Import and merge"].map(title => <Card key={title}><CardContent className="space-y-4 p-6"><h3 className="font-display text-lg font-semibold">{title}</h3><Skeleton className="h-12 w-full" /><Skeleton className="h-11 min-h-[44px] w-full" /></CardContent></Card>)}</div>;
    return <AccountSettingsSkeleton />;
  };

  return (
    <MobileLayout>
      {compactNavigation && <MobileHeader title={selectedSection?.label ?? "Settings"}
        back={selectedSection ? { label: "All settings", ariaLabel: "All settings", onBack: () => setSection(null) } : undefined} />}
      
      <LoadingRegion loading={authLoading} label="Loading settings" className="app-page-narrow min-w-0 overflow-x-hidden">
        {!compactNavigation && (
          <div className="mb-6">
            <h1 className="font-display text-3xl font-bold">Settings</h1>
            <p className="font-sans text-muted-foreground mt-1">
              Manage your account and preferences
            </p>
          </div>
        )}

        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav aria-label="Settings categories" className={cn("min-w-0 rounded-xl border bg-card p-2", selectedSection && "hidden lg:block")}>
            {sections.map(section => section.id === 'support' ? (
              <SupportPageLink key={section.id} beforeNavigate={leave}
                className="flex min-h-16 items-center gap-3 rounded-lg px-3 py-3 focus-visible:ring-2 focus-visible:ring-ring">
                <AppIcon icon={section.icon} variant="inline" size="md" className="shrink-0 text-primary" />
                <span className="min-w-0"><span className="block font-medium">{section.label}</span><span className="block text-xs text-muted-foreground">{section.description}</span></span>
              </SupportPageLink>
            ) : (
              <button key={section.id} type="button" aria-label={section.label}
                aria-current={activeSection === section.id ? "page" : undefined}
                ref={node => { if (node) categoryButtons.current.set(section.id, node); else categoryButtons.current.delete(section.id); }}
                onClick={() => handleSectionChange(section.id)}
                className={cn("flex min-h-16 w-full items-center gap-3 rounded-lg px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  activeSection === section.id ? "bg-primary/[0.12] text-primary" : "hover:bg-muted/60")}>
                <AppIcon icon={section.icon} variant="inline" size="md" className="shrink-0 text-primary" />
                <span className="min-w-0"><span className="block font-medium">{section.label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{section.description}</span></span>
              </button>
            ))}
          </nav>
          <section aria-labelledby="settings-editor-title" className={cn("min-w-0", !selectedSection && "hidden lg:block")}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 id="settings-editor-title" ref={editorHeading} tabIndex={-1} className="min-w-0 font-display text-xl font-semibold focus:outline-none">{selectedSection?.label ?? "Choose a category"}</h2>
            </div>
            {selectedSection ? <React.Fragment key={selectedSection.id}>{sectionContent(selectedSection)}</React.Fragment>
              : <p className="text-muted-foreground">Manage your account, reading preferences and app appearance.</p>}
          </section>
        </div>

        <nav aria-label="Help and legal" className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="font-medium text-muted-foreground">Help &amp; legal</span>
          <SupportPageLink beforeNavigate={leave} section="faqs" className="inline-flex min-h-11 items-center text-primary underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring">FAQs</SupportPageLink>
          <SupportPageLink beforeNavigate={leave} section="known-issues" className="inline-flex min-h-11 items-center text-primary underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring">Known issues</SupportPageLink>
          <SupportPageLink beforeNavigate={leave} section="contact" className="inline-flex min-h-11 items-center text-primary underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring">Contact</SupportPageLink>
          <SupportPageLink beforeNavigate={leave} section="terms" className="inline-flex min-h-11 items-center text-primary underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring">Terms</SupportPageLink>
          <SupportPageLink beforeNavigate={leave} section="privacy" className="inline-flex min-h-11 items-center text-primary underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring">Privacy notice</SupportPageLink>
        </nav>

        {/* Sign Out Button */}
        <Card className="mt-6 border-primary/25 bg-primary/[0.03]">
          <CardContent className="p-4">
            <Button
              variant="outline"
              disabled={authLoading}
              ref={signOutTriggerRef}
              aria-haspopup="dialog"
              aria-expanded={showSignOutDialog}
              className="w-full border-primary/35 bg-primary/10 text-primary hover:border-primary/50 hover:bg-primary/15 hover:text-primary focus-visible:ring-primary/40"
              onClick={() => {
                triggerHaptic("medium");
                void leave(() => { setSignOutError(null); setShowSignOutDialog(true); });
              }}
            >
              <AppIcon icon={APP_ICONS.common.signOut} variant="action" className="mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </LoadingRegion>

      {/* Sign Out Confirmation Dialog */}
      <MobileDialog
        returnFocusRef={signOutTriggerRef}
        open={showSignOutDialog}
        onOpenChange={open => { if (!signingOut.current) setShowSignOutDialog(open); }}
        title="Sign Out"
        description="Are you sure you want to sign out? You'll need to sign in again to access your account."
        showClose={false}
        footer={<>
          <Button variant="outline" disabled={signOutPending} onClick={() => setShowSignOutDialog(false)}>Cancel</Button>
          <Button variant="destructive" disabled={signOutPending} onClick={handleSignOut}>{signOutPending ? "Signing out..." : "Sign Out"}</Button>
        </>}
      >
        {signOutError && <p role="alert" className="text-sm text-destructive">{signOutError}</p>}
        {signOutPending && <p role="status">Signing out...</p>}
      </MobileDialog>
    </MobileLayout>
  );
};

const Settings = () => {
  const { user, loading } = useAuth();
  return <SettingsTaskProvider key={`${user?.id ?? 'guest'}:${loading}`}><SettingsContent /></SettingsTaskProvider>;
};

export default Settings;
