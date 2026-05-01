export const BRACK_LOGO_IMAGE = "/brack-logo.png";

export const BRACK_ICON_DARK_IMAGE = "/brack-icon-transparent-bg-dark.png";
export const BRACK_ICON_LIGHT_IMAGE = "/brack-icon-transparent-bg-light.png";

export const BRACK_LOGO_DARK_TEXT_IMAGE = "/brack-logo-transparent-bg-dark-text.png";
export const BRACK_LOGO_WHITE_TEXT_IMAGE = "/brack-logo-transparent-bg-white-text.png";
export const BRACK_LOGO_ORANGE_TEXT_IMAGE = "/brack-logo-transparent-bg-orange-text.png";

export const BRACK_FAVICON_SVG = "/brack-favicon/favicon.svg";
export const BRACK_FAVICON_96_IMAGE = "/brack-favicon/favicon-96x96.png";
export const BRACK_APPLE_TOUCH_ICON_IMAGE = "/brack-favicon/apple-touch-icon.png";
export const BRACK_WEB_MANIFEST_192_IMAGE = "/brack-favicon/web-app-manifest-192x192.png";
export const BRACK_WEB_MANIFEST_512_IMAGE = "/brack-favicon/web-app-manifest-512x512.png";

export const BRACK_GOALS_IMAGE = "/brack-trophy/brack-goals.png";
export const BRACK_TROPHY_IMAGE = "/brack-trophy/brack-trophy.png";

export const BRACK_STREAK_HAPPY_IMAGE = "/brack-streak/brack-streak-image-happy.png";
export const BRACK_STREAK_SAD_IMAGE = "/brack-streak/brack-streak-image-sad.png";

export const BRACK_ACHIEVEMENT_FIRST_BOOK_IMAGE = "/achievement-badges/achievement_first_book.png";
export const BRACK_ACHIEVEMENT_BOOKWORM_IMAGE = "/achievement-badges/achievement_book_worm.png";
export const BRACK_ACHIEVEMENT_CENTURY_READER_IMAGE = "/achievement-badges/achievement_century_reader.png";
export const BRACK_ACHIEVEMENT_MARATHON_READER_IMAGE = "/achievement-badges/achievement_marathon_reader.png";
export const BRACK_ACHIEVEMENT_SPEED_READER_IMAGE = "/achievement-badges/achievement_speed_reader.png";
export const BRACK_ACHIEVEMENT_GENRE_EXPLORER_IMAGE = "/achievement-badges/achievement_genre_explorer.png";
export const BRACK_ACHIEVEMENT_NIGHT_OWL_IMAGE = "/achievement-badges/achievement_night_owl.png";
export const BRACK_ACHIEVEMENT_EARLY_BIRD_IMAGE = "/achievement-badges/achievement_early_bird.png";
export const BRACK_ACHIEVEMENT_CONSISTENT_READER_IMAGE = "/achievement-badges/achievement_consistent_reader.png";
export const BRACK_ACHIEVEMENT_DEDICATED_READER_IMAGE = "/achievement-badges/achievement_dedicated_reader.png";

export const BRACK_LOGO_IMAGES = {
  icon: {
    light: BRACK_ICON_DARK_IMAGE,
    dark: BRACK_ICON_LIGHT_IMAGE,
    mask: BRACK_ICON_DARK_IMAGE,
  },
  full: {
    light: BRACK_LOGO_DARK_TEXT_IMAGE,
    dark: BRACK_LOGO_WHITE_TEXT_IMAGE,
    orange: BRACK_LOGO_ORANGE_TEXT_IMAGE,
    mask: BRACK_LOGO_DARK_TEXT_IMAGE,
  },
} as const;

export const BRACK_FAVICON_IMAGES = {
  svg: BRACK_FAVICON_SVG,
  favicon96: BRACK_FAVICON_96_IMAGE,
  appleTouchIcon: BRACK_APPLE_TOUCH_ICON_IMAGE,
  webManifest192: BRACK_WEB_MANIFEST_192_IMAGE,
  webManifest512: BRACK_WEB_MANIFEST_512_IMAGE,
} as const;

export const BRACK_STREAK_IMAGES = {
  happy: BRACK_STREAK_HAPPY_IMAGE,
  sad: BRACK_STREAK_SAD_IMAGE,
} as const;

export const BRACK_ACHIEVEMENT_BADGE_IMAGES = {
  "First Book": BRACK_ACHIEVEMENT_FIRST_BOOK_IMAGE,
  Bookworm: BRACK_ACHIEVEMENT_BOOKWORM_IMAGE,
  "Century Reader": BRACK_ACHIEVEMENT_CENTURY_READER_IMAGE,
  "Marathon Reader": BRACK_ACHIEVEMENT_MARATHON_READER_IMAGE,
  "Speed Reader": BRACK_ACHIEVEMENT_SPEED_READER_IMAGE,
  "Genre Explorer": BRACK_ACHIEVEMENT_GENRE_EXPLORER_IMAGE,
  "Night Owl": BRACK_ACHIEVEMENT_NIGHT_OWL_IMAGE,
  "Early Bird": BRACK_ACHIEVEMENT_EARLY_BIRD_IMAGE,
  "Consistent Reader": BRACK_ACHIEVEMENT_CONSISTENT_READER_IMAGE,
  "Dedicated Reader": BRACK_ACHIEVEMENT_DEDICATED_READER_IMAGE,
} as const;
