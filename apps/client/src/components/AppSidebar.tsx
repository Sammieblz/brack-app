import { Link, useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeAwareLogo } from "@/components/ThemeAwareLogo";
import { AppIcon } from "@/components/ui/app-icon";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getInitials } from "@/lib/avatarUtils";
import { NAV_GROUPS, getNavItemsBySection, isNavItemActive, type NavItem } from "@/config/navigation";
import { APP_ICONS } from "@/config/iconography";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

const renderNavGroup = (label: string, items: NavItem[], pathname: string) => (
  <SidebarGroup className="px-2 py-1.5">
    <SidebarGroupLabel>{label}</SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        {items.map((item) => {
          const Icon = item.icon;
          const active = isNavItemActive(pathname, item);

          return (
            <SidebarMenuItem key={item.path}>
              <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                <Link to={item.path}>
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
);

export const AppSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile } = useProfileContext();
  const { resolvedTheme, setThemeMode } = useTheme();
  const { triggerHaptic } = useHapticFeedback();
  const { setOpen } = useSidebar();
  const isDarkMode = resolvedTheme === "dark";

  const displayName =
    profile?.display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Reader";

  const handleSignOut = async () => {
    triggerHaptic("medium");
    await signOut();
    navigate("/");
  };

  const handleThemeToggle = () => {
    triggerHaptic("selection");
    void setThemeMode(isDarkMode ? "light" : "dark");
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="px-2 py-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <SidebarMenuButton
            asChild
            size="lg"
            tooltip="Dashboard"
            className="min-w-0 flex-1 rounded-lg group-data-[collapsible=icon]:hidden"
          >
            <Link to="/dashboard" className="min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md p-1.5 text-primary">
                <ThemeAwareLogo
                  variant="icon"
                  tone="theme"
                  size="h-full w-full"
                />
              </div>
              <div className="min-w-0">
                <div className="truncate font-display text-base font-bold">Brack</div>
                <div className="truncate text-xs text-sidebar-foreground/65">Reading tracker</div>
              </div>
            </Link>
          </SidebarMenuButton>

          <button
            type="button"
            aria-label="Open sidebar"
            title="Open sidebar"
            onClick={() => setOpen(true)}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md p-1.5 text-primary transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:flex"
          >
            <ThemeAwareLogo
              variant="icon"
              tone="theme"
              size="h-full w-full"
              className="drop-shadow-sm"
            />
          </button>

          <SidebarTrigger className="shrink-0 group-data-[collapsible=icon]:hidden" />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1 group-data-[collapsible=icon]:px-0">
        {NAV_GROUPS.map((group, index) => (
          <div key={group.section}>
            {index > 0 && <SidebarSeparator />}
            {renderNavGroup(group.label, getNavItemsBySection(group.section), location.pathname)}
          </div>
        ))}
      </SidebarContent>

      <SidebarFooter className="px-2 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Profile" isActive={location.pathname === "/profile"}>
              <Link to="/profile">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
                  <AvatarFallback name={displayName} className="text-[10px]">
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{displayName}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {getNavItemsBySection("account").map((item) => {
            const Icon = item.icon;
            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.label}
                  isActive={isNavItemActive(location.pathname, item)}
                >
                  <Link to={item.path}>
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}

          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
              onClick={handleThemeToggle}
              aria-pressed={isDarkMode}
            >
              {isDarkMode ? (
                <AppIcon icon={APP_ICONS.common.themeLight} variant="action" className="text-primary" />
              ) : (
                <AppIcon icon={APP_ICONS.common.themeDark} variant="action" className="text-primary" />
              )}
              <span>{isDarkMode ? "Light mode" : "Dark mode"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Sign out" onClick={handleSignOut}>
              <AppIcon icon={APP_ICONS.common.signOut} variant="action" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};
