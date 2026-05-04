import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Menu, Xmark } from "iconoir-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { APP_ICONS } from "@/config/iconography";
import { fetchProfile } from "@/services/api";

export const Navbar = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { triggerHaptic } = useHapticFeedback();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      
      const data = await fetchProfile(user.id);
      
      if (data?.avatar_url) {
        setAvatarUrl(data.avatar_url);
      }
    };

    loadProfile();
  }, [user]);

  const handleSignOut = async () => {
    try {
      triggerHaptic('medium');
      await signOut();
      triggerHaptic('success');
      toast.success("Signed out successfully");
      navigate("/");
    } catch (error: unknown) {
      triggerHaptic('error');
      toast.error("Error signing out");
    }
  };

  const displayName = user?.user_metadata?.full_name || 
                      user?.user_metadata?.name || 
                      user?.email?.split('@')[0] || 
                      'Reader';

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: APP_ICONS.nav.home },
    { to: "/books", label: "My Books", icon: APP_ICONS.nav.library },
    { to: "/lists", label: "Lists", icon: APP_ICONS.nav.lists },
    { to: "/goals-management", label: "Goals", icon: APP_ICONS.nav.goals },
    { to: "/analytics", label: "Analytics", icon: APP_ICONS.nav.analytics },
    { to: "/clubs", label: "Clubs", icon: APP_ICONS.nav.clubs },
    { to: "/readers", label: "Readers", icon: APP_ICONS.nav.readers },
    { to: "/messages", label: "Messages", icon: APP_ICONS.nav.messages },
  ];

  const getNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-300 ${
      isActive 
        ? "bg-primary/20 text-primary border border-primary/30" 
        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
    }`;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <APP_ICONS.nav.library className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <span className="font-display text-base sm:text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              BookTracker
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => (
                <NavLink 
                  key={item.to} 
                  to={item.to} 
                  className={getNavLinkClass}
                  onClick={() => triggerHaptic('selection')}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="font-sans">{item.label}</span>
                </NavLink>
              ))}
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-11 w-11 rounded-full touch-manipulation">
                  <Avatar className="h-9 w-9 sm:h-10 sm:w-10 border-2 border-primary/20">
                    <AvatarImage src={avatarUrl || undefined} alt={displayName} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                className="w-56 mt-2 bg-background/95 backdrop-blur-sm border border-border/50" 
                align="end"
              >
                <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
                  <APP_ICONS.nav.settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                  <APP_ICONS.common.signOut className="mr-2 h-4 w-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-11 w-11 touch-manipulation"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <Xmark className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-sm">
            <div className="px-2 pt-2 pb-safe space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-4 py-3.5 rounded-lg text-base font-medium transition-colors touch-manipulation ${
                      isActive
                        ? "bg-primary/20 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`
                  }
                  onClick={() => {
                    triggerHaptic('selection');
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span className="font-sans">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
