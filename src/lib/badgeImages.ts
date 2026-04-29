import type { Badge } from "@/types";

// Relative paths under Vite's public/ directory are served from the root.
const BADGE_IMAGE_MAP: Record<string, string> = {
  "First Book": "/achievement-badges/achievement_first_book.png",
  "Bookworm": "/achievement-badges/achievement_book_worm.png",
  "Century Reader": "/achievement-badges/achievement_century_reader.png",
  "Marathon Reader": "/achievement-badges/achievement_marathon_reader.png",
  "Speed Reader": "/achievement-badges/achievement_speed_reader.png",
  "Genre Explorer": "/achievement-badges/achievement_genre_explorer.png",
  "Night Owl": "/achievement-badges/achievement_night_owl.png",
  "Early Bird": "/achievement-badges/achievement_early_bird.png",
  "Consistent Reader": "/achievement-badges/achievement_consistent_reader.png",
  "Dedicated Reader": "/achievement-badges/achievement_dedicated_reader.png",
};

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

