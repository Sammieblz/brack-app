import type { ComponentType } from "react";
import {
  Activity,
  Book,
  BookStack,
  ChatBubble,
  Group,
  Home,
  List,
  Settings,
  Star,
  StatsReport,
  Trophy,
  User,
} from "iconoir-react";

export type NavSection = "overview" | "books" | "progress" | "community" | "account";

export interface NavGroup {
  section: Exclude<NavSection, "account">;
  label: string;
}

export interface NavItem {
  label: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
  section: NavSection;
  matchPaths: string[];
  showInMobileNav?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Home",
    path: "/dashboard",
    icon: Home,
    section: "overview",
    matchPaths: ["/dashboard"],
    showInMobileNav: true,
  },
  {
    label: "Library",
    path: "/my-books",
    icon: Book,
    section: "books",
    matchPaths: ["/my-books", "/books", "/book", "/edit-book", "/add-book", "/scan", "/scan-barcode", "/scan-cover"],
    showInMobileNav: true,
  },
  {
    label: "Lists",
    path: "/lists",
    icon: List,
    section: "books",
    matchPaths: ["/lists", "/book-lists"],
    showInMobileNav: true,
  },
  {
    label: "Analytics",
    path: "/analytics",
    icon: StatsReport,
    section: "progress",
    matchPaths: ["/analytics", "/history"],
  },
  {
    label: "Goals",
    path: "/goals-management",
    icon: Trophy,
    section: "progress",
    matchPaths: ["/goals-management", "/goals"],
  },
  {
    label: "Achievements",
    path: "/achievements",
    icon: Star,
    section: "progress",
    matchPaths: ["/achievements"],
  },
  {
    label: "Feed",
    path: "/feed",
    icon: Activity,
    section: "community",
    matchPaths: ["/feed"],
    showInMobileNav: true,
  },
  {
    label: "Readers",
    path: "/readers",
    icon: User,
    section: "community",
    matchPaths: ["/readers", "/users"],
    showInMobileNav: true,
  },
  {
    label: "Clubs",
    path: "/clubs",
    icon: Group,
    section: "community",
    matchPaths: ["/clubs"],
  },
  {
    label: "Messages",
    path: "/messages",
    icon: ChatBubble,
    section: "community",
    matchPaths: ["/messages"],
  },
  {
    label: "Reviews",
    path: "/reviews",
    icon: BookStack,
    section: "community",
    matchPaths: ["/reviews"],
  },
  {
    label: "Settings",
    path: "/settings",
    icon: Settings,
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

export const getNavItemsBySection = (section: NavSection) =>
  NAV_ITEMS.filter((item) => item.section === section);

export const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((item) => item.showInMobileNav);
