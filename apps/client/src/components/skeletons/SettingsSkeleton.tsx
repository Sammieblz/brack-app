import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const SettingsFieldSkeleton = ({ label, multiline = false }: { label: string; multiline?: boolean }) => (
  <div className="space-y-2"><Label>{label}</Label><Skeleton className={multiline ? "h-[calc(6em+1.125rem)] w-full text-sm" : "h-11 min-h-[44px] w-full"} /></div>
);

export const ProfileFormSkeleton = () => (
  <div aria-hidden="true" className="pointer-events-none space-y-6" data-skeleton="profile-form">
    <Card><CardHeader><CardTitle>Social Profile</CardTitle><CardDescription>How others see your profile</CardDescription></CardHeader><CardContent>
      <div className="mb-4 flex items-center gap-4"><Skeleton className="h-16 w-16 shrink-0 rounded-full" /><div className="min-w-0 flex-1"><Skeleton className="h-7 w-1/2" /><Skeleton className="mt-1 h-5 w-3/4" /></div></div>
      <div className="flex gap-6 border-t pt-4">{["Followers", "Following"].map(label => <div key={label}><Skeleton className="h-8 w-12" /><div className="font-sans text-sm text-muted-foreground">{label}</div></div>)}<Skeleton className="ml-auto h-5 w-20" /></div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Profile Picture</CardTitle><CardDescription>Update your profile picture to personalize your account</CardDescription></CardHeader><CardContent className="flex flex-col items-center gap-4 sm:flex-row"><Skeleton className="h-20 w-20 shrink-0 rounded-full" /><Skeleton className="h-11 min-h-[44px] w-full sm:w-36" /></CardContent></Card>
    <Card><CardHeader><CardTitle>Display Name</CardTitle><CardDescription>This is how your name appears to other users</CardDescription></CardHeader><CardContent><SettingsFieldSkeleton label="Display Name" /></CardContent></Card>
    <Card><CardHeader><CardTitle>Bio</CardTitle><CardDescription>Tell others about yourself and your reading interests</CardDescription></CardHeader><CardContent><SettingsFieldSkeleton label="Bio" multiline /></CardContent></Card>
    <div className="flex justify-end"><Skeleton className="h-11 min-h-[44px] w-32" /></div>
  </div>
);

export const PersonalInfoSkeleton = () => (
  <div aria-hidden="true" className="pointer-events-none space-y-6" data-skeleton="personal-info">
    <div><h2 className="font-display text-2xl font-bold">Personal Information</h2><p className="mt-1 font-sans text-muted-foreground">Manage your personal details and location</p></div>
    <Card><CardHeader><CardTitle>Name</CardTitle></CardHeader><CardContent><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><SettingsFieldSkeleton label="First Name" /><SettingsFieldSkeleton label="Last Name" /></div></CardContent></Card>
    <Card><CardHeader><CardTitle>Contact Information</CardTitle></CardHeader><CardContent className="space-y-4"><SettingsFieldSkeleton label="Phone Number" /><SettingsFieldSkeleton label="Date of Birth" /></CardContent></Card>
    <Card><CardHeader><CardTitle>Location</CardTitle><CardDescription>Add your location to discover readers near you</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><SettingsFieldSkeleton label="City" /><SettingsFieldSkeleton label="Country" /></div><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><SettingsFieldSkeleton label="Latitude" /><SettingsFieldSkeleton label="Longitude" /></div><Skeleton className="h-11 min-h-[44px] w-44" /><Skeleton className="h-16 w-full" /></CardContent></Card>
    <div className="flex justify-end"><Skeleton className="h-11 min-h-[44px] w-32" /></div>
  </div>
);

export const ReadingHabitsSkeleton = () => (
  <div aria-hidden="true" className="pointer-events-none grid grid-cols-2 gap-4" data-skeleton="reading-habits">
    {["Avg. days per book", "Avg. book length", "Books (6 months)", "Books (1 year)", "Session length", "Preferred time"].map(label => <div key={label}><p className="font-sans text-sm text-muted-foreground">{label}</p><Skeleton className="h-7 w-20" /></div>)}
  </div>
);

export const AccountSettingsSkeleton = () => (
  <div aria-hidden="true" className="pointer-events-none space-y-6">
    <div><h2 className="font-display text-2xl font-bold">Account Settings</h2><p className="mt-1 font-sans text-muted-foreground">Manage your account information and security</p></div>
    <Card><CardHeader><CardTitle>Email Address</CardTitle><CardDescription>Your email address cannot be changed. Contact support if you need to update it.</CardDescription></CardHeader><CardContent><SettingsFieldSkeleton label="Email" /></CardContent></Card>
    <Card><CardHeader><CardTitle>Password</CardTitle><CardDescription>Change your password to keep your account secure</CardDescription></CardHeader><CardContent className="space-y-4"><SettingsFieldSkeleton label="Current Password" /><SettingsFieldSkeleton label="New Password" /><SettingsFieldSkeleton label="Confirm Password" /><Skeleton className="h-11 min-h-[44px] w-36" /></CardContent></Card>
  </div>
);

export const PreferenceSettingsSkeleton = ({ privacy = false }: { privacy?: boolean }) => {
  const groups = privacy ? [
    { title: "Profile Visibility", description: "Profile and activity visibility now affects Feed, Readers, and shared posts.", rows: [["Public Profile", "Allow readers to find and view your profile."], ["Show Reading Activity", "Include your reading updates in mutual-friend Activity feeds."], ["Show Location", "Allow your saved location to be used for nearby reader discovery."]] },
    { title: "Reader Journey & Rankings", description: "Ink and quests remain available even when public competition is disabled.", rows: [["Join Reader Leagues", "Enter optional weekly leagues using qualifying reading activity. New opt-ins start next week."], ["Show Journey on Profile", "Let eligible readers see your level and league rank."]] },
  ] : [
    { title: "Push Notifications", rows: [["Push Notifications", "Receive push notifications on your device"], ["Badge Unlocks", "New badges earned through your Reader Journey"], ["Quest Updates", "Quest reminders and completion summaries"], ["Rank Movement", "Important changes in your weekly league position"], ["Weekly Results", "Final Reader League rank and promotion result"], ["Gold Leaves", "Notify me when a rare Gold Leaf is earned"], ["Messages", "Notify me when I receive new messages"], ["New Followers", "Notify me when someone follows me"], ["Book Clubs", "Notify me about book club updates"], ["Goal Milestones", "Notify me when I reach reading goals"], ["Streak Reminders", "Remind me to maintain my reading streak"], ["Reading Reminders", "Daily reminders to read"]], description: undefined },
  ];
  return <div aria-hidden="true" className="pointer-events-none space-y-6">
    <div><h2 className="font-display text-2xl font-bold">{privacy ? "Privacy Settings" : "Notification Preferences"}</h2><p className="mt-1 font-sans text-muted-foreground">{privacy ? "Control who can see you, your activity, and your social interactions." : "Control how and when you receive notifications"}</p></div>
    {groups.map(group => <Card key={group.title}><CardHeader><CardTitle>{group.title}</CardTitle>{group.description && <CardDescription>{group.description}</CardDescription>}</CardHeader><CardContent className="space-y-6"><div className="space-y-4">{group.rows.map(([label, description]) => <div key={label} className="flex items-center justify-between gap-4"><div className="space-y-0.5"><Label>{label}</Label><p className="font-sans text-sm text-muted-foreground">{description}</p></div><Skeleton className="h-6 w-11 shrink-0 rounded-full" /></div>)}</div>{!privacy && <><div className="border-t pt-4"><Label className="mb-3 block">Quiet Hours</Label><div className="grid grid-cols-2 gap-4"><SettingsFieldSkeleton label="Start" /><SettingsFieldSkeleton label="End" /></div><p className="mt-2 font-sans text-xs text-muted-foreground">Notifications will be silenced during these hours</p></div><Skeleton className="h-11 min-h-[44px] w-full" /></>}</CardContent></Card>)}
  </div>;
};
