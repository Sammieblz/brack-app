import { APP_ICONS, type AppIcon } from "@/config/iconography";

export type NavSection = "overview" | "books" | "progress" | "community" | "account";

export interface NavGroup {
  section: Exclude<NavSection, "account">;
  label: string;
}

export interface NavItem {
  label: string;
  path: string;
  icon: AppIcon;
  section: NavSection;
  matchPaths: string[];
  showInMobileNav?: boolean;
  feature?: "social";
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Home",
    path: "/dashboard",
    icon: APP_ICONS.nav.home,
    section: "overview",
    matchPaths: ["/dashboard"],
    showInMobileNav: true,
  },
  {
    label: "Library",
    path: "/my-books",
    icon: APP_ICONS.nav.library,
    section: "books",
    matchPaths: ["/my-books", "/books", "/book", "/edit-book", "/add-book", "/scan", "/scan-barcode", "/scan-cover"],
    showInMobileNav: true,
  },
  {
    label: "Lists",
    path: "/lists",
    icon: APP_ICONS.nav.lists,
    section: "books",
    matchPaths: ["/lists", "/book-lists"],
    showInMobileNav: true,
  },
  {
    label: "Analytics",
    path: "/analytics",
    icon: APP_ICONS.nav.analytics,
    section: "progress",
    matchPaths: ["/analytics", "/history"],
  },
  {
    label: "Goals",
    path: "/goals-management",
    icon: APP_ICONS.nav.goals,
    section: "progress",
    matchPaths: ["/goals-management"],
  },
  {
    label: "Achievements",
    path: "/achievements",
    icon: APP_ICONS.nav.achievements,
    section: "progress",
    matchPaths: ["/achievements"],
  },
  {
    label: "Feed",
    path: "/feed",
    icon: APP_ICONS.nav.feed,
    section: "community",
    matchPaths: ["/feed"],
    showInMobileNav: true,
    feature: "social",
  },
  {
    label: "Readers",
    path: "/readers",
    icon: APP_ICONS.nav.readers,
    section: "community",
    matchPaths: ["/readers", "/users"],
    showInMobileNav: true,
    feature: "social",
  },
  {
    label: "Clubs",
    path: "/clubs",
    icon: APP_ICONS.nav.clubs,
    section: "community",
    matchPaths: ["/clubs"],
    feature: "social",
  },
  {
    label: "Messages",
    path: "/messages",
    icon: APP_ICONS.nav.messages,
    section: "community",
    matchPaths: ["/messages"],
    feature: "social",
  },
  {
    label: "Reviews",
    path: "/reviews",
    icon: APP_ICONS.nav.reviews,
    section: "community",
    matchPaths: ["/reviews"],
    feature: "social",
  },
  {
    label: "Settings",
    path: "/settings",
    icon: APP_ICONS.nav.settings,
    section: "account",
    matchPaths: ["/settings"],
  },
];

export const NAV_GROUPS: NavGroup[] = [
  { section: "overview", label: "Overview" },
  { section: "books", label: "Books" },
  { section: "progress", label: "Progress" },
  { section: "community", label: "Community" },
];

const matchesDynamicPath = (pathname: string, matchPath: string) => {
  const pathnameSegments = pathname.split("/").filter(Boolean);
  const matchSegments = matchPath.split("/").filter(Boolean);

  if (pathnameSegments.length !== matchSegments.length) return false;

  return matchSegments.every((segment, index) => (
    segment.startsWith(":") || segment === pathnameSegments[index]
  ));
};

export const isNavItemActive = (pathname: string, item: NavItem) =>
  item.matchPaths.some((matchPath) => {
    if (matchPath.includes(":")) return matchesDynamicPath(pathname, matchPath);
    if (matchPath === pathname) return true;
    return pathname.startsWith(`${matchPath}/`);
  });

const isFeatureAvailable = (item: NavItem, socialEnabled: boolean) =>
  item.feature !== "social" || socialEnabled;

export const getNavItemsBySection = (
  section: NavSection,
  socialEnabled = true,
) =>
  NAV_ITEMS.filter(
    (item) => item.section === section && isFeatureAvailable(item, socialEnabled),
  );

export const getMobileNavItems = (socialEnabled = true) =>
  NAV_ITEMS.filter(
    (item) => item.showInMobileNav && isFeatureAvailable(item, socialEnabled),
  );
