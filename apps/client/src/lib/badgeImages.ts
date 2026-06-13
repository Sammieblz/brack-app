import type { Badge } from "@/types";
import { BRACK_ACHIEVEMENT_BADGE_IMAGES } from "@/config/brackAssets";

const BADGE_IMAGE_MAP: Record<string, string> = BRACK_ACHIEVEMENT_BADGE_IMAGES;

export function getBadgeImagePath(badge: Badge): string | null {
  // Prefer explicit mapping by title
  const mapped = BADGE_IMAGE_MAP[badge.title];
  if (mapped) return mapped;

  // Fallback to icon_url from the database if present
  if (badge.icon_url && badge.icon_url.trim().length > 0) {
    return badge.icon_url;
  }

  return null;
}

export function getAbsoluteBadgeImageUrl(badge: Badge): string | null {
  const path = getBadgeImagePath(badge);
  if (!path) return null;

  // If it's already absolute, return as-is
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  if (typeof window === "undefined") {
    return path;
  }

  try {
    const url = new URL(path, window.location.origin);
    return url.toString();
  } catch {
    return path;
  }
}

