import { useEffect, useRef, type MouseEvent, type RefObject } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, User } from "iconoir-react";
import { Dialog } from "@/components/ui/dialog";
import {
  AdaptiveDialogBody, AdaptiveDialogContent, AdaptiveDialogDescription,
  AdaptiveDialogHeader, AdaptiveDialogTitle,
} from "@/components/ui/adaptive-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingRegion } from "@/components/loading/LoadingRegion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useAuth } from "@/hooks/useAuth";
import { useFollowing } from "@/hooks/useFollowing";
import { useConversations } from "@/hooks/useConversations";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { getInitials } from "@/lib/avatarUtils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ThemeAwareLogo } from "@/components/ThemeAwareLogo";
import { cn } from "@/lib/utils";
import { getMobileNavItems, getNavItemsBySection, isNavItemActive, type NavItem } from "@/config/navigation";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useSettingsLinkNavigation } from "@/hooks/useSettingsLinkNavigation";
import { useSettingsSignOut } from "@/contexts/SettingsTaskContext";

interface ProfileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

const linkClassName = "flex min-h-11 min-w-0 items-center gap-3 rounded-lg px-3 py-3 font-sans text-sm font-medium outline-offset-2 hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

/** The existing profile drawer now serves as the shell's visible destination menu. */
export const ProfileDrawer = ({ open, onOpenChange, returnFocusRef }: ProfileDrawerProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, isLoading } = useProfileContext();
  const { user, signOut } = useAuth();
  const { followersCount, followingCount } = useFollowing(user?.id || null);
  const { conversations } = useConversations();
  const { triggerHaptic } = useHapticFeedback();
  const { socialEnabled } = useFeatureFlags();
  const handleSettingsLink = useSettingsLinkNavigation();
  const settingsSignOut = useSettingsSignOut();
  const navigated = useRef(false);
  const openedLocation = useRef(location.key);
  const unreadCount = conversations.reduce((sum, conversation) => sum + (conversation.unread_count || 0), 0);
  const primaryItems = getMobileNavItems(socialEnabled);
  const primaryPaths = new Set(primaryItems.map((item) => item.path));
  const readingItems = (["overview", "books", "progress"] as const)
    .flatMap((section) => getNavItemsBySection(section, socialEnabled))
    .filter((item) => !primaryPaths.has(item.path));
  const communityItems = getNavItemsBySection("community", socialEnabled)
    .filter((item) => !primaryPaths.has(item.path));
  const accountItems = getNavItemsBySection("account", socialEnabled);

  useEffect(() => {
    if (open && location.key !== openedLocation.current) {
      navigated.current = true;
      onOpenChange(false);
    }
    openedLocation.current = location.key;
  }, [location.key, open, onOpenChange]);

  const handleDestination = (event: MouseEvent<HTMLAnchorElement>) => {
    // Keep native link behavior and the current menu for modifier/new-tab actions.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (handleSettingsLink(event, () => {
      navigated.current = true;
      triggerHaptic("selection");
      onOpenChange(false);
    })) return;
    navigated.current = true;
    triggerHaptic("selection");
    onOpenChange(false);
  };

  const handleSignOut = async () => {
    triggerHaptic("medium");
    if (settingsSignOut) {
      await settingsSignOut(() => { navigated.current = true; onOpenChange(false); });
      return;
    }
    await signOut();
    navigated.current = true;
    navigate("/");
    onOpenChange(false);
  };

  const renderLink = (item: NavItem, primary = false) => {
    const Icon = item.icon;
    const active = isNavItemActive(location.pathname, item);
    const messages = item.path === "/messages" && unreadCount > 0;
    return <Link key={item.path} to={item.path} onClick={handleDestination}
      aria-current={active ? "page" : undefined}
      className={cn(linkClassName, primary && "border border-border/70", active && "border-primary/40 bg-primary/10 text-foreground")}>
      <Icon className={cn("size-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
      <span className="min-w-0 flex-1 break-words">{item.label}</span>
      {messages && <Badge variant="secondary" className="shrink-0 px-2">
        <span aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>
        <span className="sr-only">{unreadCount} unread</span>
      </Badge>}
    </Link>;
  };

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Reader";

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <AdaptiveDialogContent size="regular"
      onOpenAutoFocus={() => { navigated.current = false; openedLocation.current = location.key; }}
      onCloseAutoFocus={(event) => {
        if (navigated.current) { event.preventDefault(); return; }
        if (returnFocusRef?.current?.isConnected) {
          event.preventDefault();
          returnFocusRef.current.focus();
          return;
        }
        // Expanded layouts can replace Menu with a persistent sidebar while this
        // task stays open. Give focus a visible page destination in that case.
        const fallback = document.querySelector<HTMLElement>("[data-app-scroll-container] h1")
          ?? document.querySelector<HTMLElement>("[data-app-scroll-container]");
        if (fallback) {
          event.preventDefault();
          if (!fallback.hasAttribute("tabindex")) fallback.tabIndex = -1;
          fallback.focus();
        }
      }}>
      <AdaptiveDialogHeader>
        <div className="flex items-center gap-3">
          <ThemeAwareLogo variant="icon" size="size-8" />
          <AdaptiveDialogTitle className="font-display text-xl">Your reading space</AdaptiveDialogTitle>
        </div>
        <AdaptiveDialogDescription>Find your books, reading progress and community.</AdaptiveDialogDescription>
      </AdaptiveDialogHeader>
      <AdaptiveDialogBody>
        <nav aria-label="Main navigation" className="space-y-5">
          <div role="group" className="grid gap-2" aria-label="Primary destinations"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 10rem), 1fr))" }}>
            {primaryItems.map((item) => renderLink(item, true))}
          </div>
          {[
            { name: "Reading", items: readingItems },
            { name: "Community", items: communityItems },
          ].filter((group) => group.items.length > 0).map((group) => <section key={group.name} aria-label={group.name} className="border-t border-border/70 pt-4">
            <h3 className="px-3 pb-1 font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.name}</h3>
            <div>{group.items.map((item) => renderLink(item))}</div>
          </section>)}
          <section aria-label="Account" className="border-t border-border/70 pt-4">
            <h3 className="px-3 pb-1 font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account</h3>
            <Link to="/profile" onClick={handleDestination} aria-current={location.pathname === "/profile" ? "page" : undefined}
              className={cn(linkClassName, location.pathname === "/profile" && "bg-primary/10")}>
              <User className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>Profile</span>
            </Link>
            {accountItems.map((item) => renderLink(item))}
          </section>
        </nav>
        <div className="mt-5 space-y-4 border-t border-border/70 pt-4">
          <LoadingRegion loading={isLoading && !profile} label="Loading profile">
            {isLoading && !profile ? <div className="flex items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-full" /><Skeleton className="h-5 w-32" />
            </div> : <div className="flex items-center gap-3 px-3">
              <Avatar className="size-9 shrink-0">
                <AvatarImage src={profile?.avatar_url || undefined} alt="" />
                <AvatarFallback name={displayName}>{getInitials(displayName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 font-sans">
                <p className="break-words text-sm font-medium">{displayName}</p>
                {socialEnabled && <p className="text-xs text-muted-foreground">{followingCount} following · {followersCount} followers</p>}
              </div>
            </div>}
          </LoadingRegion>
          <div className="flex flex-wrap items-center justify-between gap-2 px-3">
            <span className="font-sans text-sm text-muted-foreground">Appearance</span>
            <ThemeToggle variant="inline" />
          </div>
          <Button type="button" variant="ghost" disableHaptic onClick={handleSignOut} className="h-auto min-h-11 w-full justify-start gap-3 whitespace-normal text-foreground hover:bg-destructive/10">
            <LogOut className="size-5 shrink-0" aria-hidden="true" />Sign out
          </Button>
        </div>
      </AdaptiveDialogBody>
    </AdaptiveDialogContent>
  </Dialog>;
};
