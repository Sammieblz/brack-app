import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, User } from "iconoir-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeAwareLogo } from "@/components/ThemeAwareLogo";
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
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useProfileContext } from "@/contexts/ProfileContext";
import { getInitials } from "@/lib/avatarUtils";
import { getNavItemsBySection, isNavItemActive, type NavItem } from "@/config/navigation";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

const renderNavGroup = (label: string, items: NavItem[], pathname: string) => (
  <SidebarGroup>
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
  const { triggerHaptic } = useHapticFeedback();

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

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="p-3">
        <div className="flex items-center gap-2">
          <SidebarMenuButton asChild size="lg" tooltip="Dashboard" className="min-w-0 flex-1">
            <Link to="/dashboard" className="min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 p-1 shadow-sm ring-1 ring-primary/25">
                <ThemeAwareLogo
                  variant="icon"
                  tone="theme"
                  size="h-full w-full"
                  className="drop-shadow-sm"
                />
              </div>
              <div className="min-w-0">
                <div className="truncate font-display text-base font-bold">Brack</div>
                <div className="truncate text-xs text-sidebar-foreground/65">Reading tracker</div>
              </div>
            </Link>
          </SidebarMenuButton>
          <SidebarTrigger className="shrink-0" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {renderNavGroup("Read", getNavItemsBySection("primary"), location.pathname)}
        <SidebarSeparator />
        {renderNavGroup("Community", getNavItemsBySection("social"), location.pathname)}
      </SidebarContent>

      <SidebarFooter className="p-3">
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
            <SidebarMenuButton tooltip="Sign out" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};
