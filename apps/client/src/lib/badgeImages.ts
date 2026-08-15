import type { Badge } from "@/types";
import { BRACK_ACHIEVEMENT_BADGE_IMAGES } from "@/config/brackAssets";

const BADGE_IMAGE_MAP: Record<string, string> = BRACK_ACHIEVEMENT_BADGE_IMAGES;
const BADGE_IMAGE_BASE_PATH = "/achievement-badges";

const slugToFileName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const CODE_FILE_OVERRIDES: Record<string, string> = {
  "first-book": "achievement_first_book",
  bookworm: "achievement_book_worm",
  "century-reader": "achievement_century_reader",
  "marathon-reader": "achievement_marathon_reader",
  "speed-reader": "achievement_speed_reader",
  "genre-explorer": "achievement_genre_explorer",
  "night-owl": "achievement_night_owl",
  "early-bird": "achievement_early_bird",
  "consistent-reader": "achievement_consistent_reader",
  "dedicated-reader": "achievement_dedicated_reader",
  yearbound: "year_bound",
};

const badgeImagePathFromCode = (code: string) =>
  `${BADGE_IMAGE_BASE_PATH}/${CODE_FILE_OVERRIDES[code] || slugToFileName(code)}.webp`;

export function getBadgeImagePath(badge: Badge): string | null {
  if (badge.is_secret && !badge.earned_at) {
    return null;
  }

  const mappedByCode = badge.code ? BADGE_IMAGE_MAP[badge.code] : null;
  if (mappedByCode) return mappedByCode;

  const mappedByTitle = BADGE_IMAGE_MAP[badge.title];
  if (mappedByTitle) return mappedByTitle;

  if (badge.icon_url && badge.icon_url.trim().length > 0) {
    return badge.icon_url;
  }

  if (badge.code) {
    return badgeImagePathFromCode(badge.code);
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

