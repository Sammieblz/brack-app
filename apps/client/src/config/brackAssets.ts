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

export const BRACK_LIFETIME_INK_ICON_IMAGE = "/brack-currency/lifetime_ink_icon.webp";
export const BRACK_GOLD_LEAVES_ICON_IMAGE = "/brack-currency/gold_leaves_icon.webp";

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

const achievementBadgeImage = (fileName: string) => `/achievement-badges/${fileName}.png`;

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

export const BRACK_CURRENCY_IMAGES = {
  ink: BRACK_LIFETIME_INK_ICON_IMAGE,
  goldLeaves: BRACK_GOLD_LEAVES_ICON_IMAGE,
} as const;

export const BRACK_ACHIEVEMENT_BADGE_IMAGES = {
  "first-book": BRACK_ACHIEVEMENT_FIRST_BOOK_IMAGE,
  "First Book": BRACK_ACHIEVEMENT_FIRST_BOOK_IMAGE,
  "bookworm": BRACK_ACHIEVEMENT_BOOKWORM_IMAGE,
  Bookworm: BRACK_ACHIEVEMENT_BOOKWORM_IMAGE,
  "century-reader": BRACK_ACHIEVEMENT_CENTURY_READER_IMAGE,
  "Century Reader": BRACK_ACHIEVEMENT_CENTURY_READER_IMAGE,
  "marathon-reader": BRACK_ACHIEVEMENT_MARATHON_READER_IMAGE,
  "Marathon Reader": BRACK_ACHIEVEMENT_MARATHON_READER_IMAGE,
  "speed-reader": BRACK_ACHIEVEMENT_SPEED_READER_IMAGE,
  "Speed Reader": BRACK_ACHIEVEMENT_SPEED_READER_IMAGE,
  "genre-explorer": BRACK_ACHIEVEMENT_GENRE_EXPLORER_IMAGE,
  "Genre Explorer": BRACK_ACHIEVEMENT_GENRE_EXPLORER_IMAGE,
  "night-owl": BRACK_ACHIEVEMENT_NIGHT_OWL_IMAGE,
  "Night Owl": BRACK_ACHIEVEMENT_NIGHT_OWL_IMAGE,
  "early-bird": BRACK_ACHIEVEMENT_EARLY_BIRD_IMAGE,
  "Early Bird": BRACK_ACHIEVEMENT_EARLY_BIRD_IMAGE,
  "consistent-reader": BRACK_ACHIEVEMENT_CONSISTENT_READER_IMAGE,
  "Consistent Reader": BRACK_ACHIEVEMENT_CONSISTENT_READER_IMAGE,
  "dedicated-reader": BRACK_ACHIEVEMENT_DEDICATED_READER_IMAGE,
  "Dedicated Reader": BRACK_ACHIEVEMENT_DEDICATED_READER_IMAGE,

  "shelf-starter": achievementBadgeImage("shelf_starter"),
  "home-library": achievementBadgeImage("home_library"),
  "shelf-keeper": achievementBadgeImage("shelf_keeper"),
  "grand-library": achievementBadgeImage("grand_library"),
  "first-finish": achievementBadgeImage("first_finish"),
  "chapter-closer": achievementBadgeImage("chapter_closer"),
  "reading-veteran": achievementBadgeImage("reading_veteran"),
  "bibliophile": achievementBadgeImage("bibliophile"),
  "three-day-spark": achievementBadgeImage("three_day_spark"),
  "fortnight-focus": achievementBadgeImage("fortnight_focus"),
  "season-reader": achievementBadgeImage("season_reader"),
  "hundred-day-habit": achievementBadgeImage("hundred_day_habit"),
  "yearbound": achievementBadgeImage("year_bound"),
  "first-hour": achievementBadgeImage("first_hour"),
  "ten-hour-reader": achievementBadgeImage("ten_hour_reader"),
  "deep-focus": achievementBadgeImage("deep_focus"),
  "long-haul": achievementBadgeImage("long_haul"),
  "hundred-hour-reader": achievementBadgeImage("hundred_hour_reader"),
  "page-turner": achievementBadgeImage("page_turner"),
  "margin-maker": achievementBadgeImage("margin_maker"),
  "thousand-pages": achievementBadgeImage("thousand_pages"),
  "page-voyager": achievementBadgeImage("page_voyager"),
  "five-thousand-pages": achievementBadgeImage("five_thousand_pages"),
  "ten-thousand-pages": achievementBadgeImage("ten_thousand_pages"),
  "genre-hopper": achievementBadgeImage("genre_hopper"),
  "wide-horizons": achievementBadgeImage("wide_horizons"),
  "author-acquaintance": achievementBadgeImage("author_acquaintance"),
  "author-atlas": achievementBadgeImage("author_atlas"),
  "series-reader": achievementBadgeImage("series_reader"),
  "list-maker": achievementBadgeImage("list_maker"),
  "curator": achievementBadgeImage("curator"),
  "first-review": achievementBadgeImage("first_review"),
  "thoughtful-critic": achievementBadgeImage("thoughtful_critic"),
  "goal-setter": achievementBadgeImage("goal_setter"),
  "goal-getter": achievementBadgeImage("goal_getter"),
  "quest-begun": achievementBadgeImage("quest_begun"),
  "quest-runner": achievementBadgeImage("quest_runner"),
  "quest-master": achievementBadgeImage("quest_master"),
  "league-debut": achievementBadgeImage("league_debut"),
  "podium-reader": achievementBadgeImage("podium_reader"),
  "first-edition-champion": achievementBadgeImage("first_edition_champion"),

  "Shelf Starter": achievementBadgeImage("shelf_starter"),
  "Home Library": achievementBadgeImage("home_library"),
  "Shelf Keeper": achievementBadgeImage("shelf_keeper"),
  "Grand Library": achievementBadgeImage("grand_library"),
  "First Finish": achievementBadgeImage("first_finish"),
  "Chapter Closer": achievementBadgeImage("chapter_closer"),
  "Reading Veteran": achievementBadgeImage("reading_veteran"),
  "Bibliophile": achievementBadgeImage("bibliophile"),
  "Three-Day Spark": achievementBadgeImage("three_day_spark"),
  "Fortnight Focus": achievementBadgeImage("fortnight_focus"),
  "Season Reader": achievementBadgeImage("season_reader"),
  "Hundred-Day Habit": achievementBadgeImage("hundred_day_habit"),
  "Yearbound": achievementBadgeImage("year_bound"),
  "First Hour": achievementBadgeImage("first_hour"),
  "Ten-Hour Reader": achievementBadgeImage("ten_hour_reader"),
  "Deep Focus": achievementBadgeImage("deep_focus"),
  "Long Haul": achievementBadgeImage("long_haul"),
  "Hundred-Hour Reader": achievementBadgeImage("hundred_hour_reader"),
  "Page Turner": achievementBadgeImage("page_turner"),
  "Margin Maker": achievementBadgeImage("margin_maker"),
  "Thousand Pages": achievementBadgeImage("thousand_pages"),
  "Page Voyager": achievementBadgeImage("page_voyager"),
  "Five Thousand Pages": achievementBadgeImage("five_thousand_pages"),
  "Ten Thousand Pages": achievementBadgeImage("ten_thousand_pages"),
  "Genre Hopper": achievementBadgeImage("genre_hopper"),
  "Wide Horizons": achievementBadgeImage("wide_horizons"),
  "Author Acquaintance": achievementBadgeImage("author_acquaintance"),
  "Author Atlas": achievementBadgeImage("author_atlas"),
  "Series Reader": achievementBadgeImage("series_reader"),
  "List Maker": achievementBadgeImage("list_maker"),
  "Curator": achievementBadgeImage("curator"),
  "First Review": achievementBadgeImage("first_review"),
  "Thoughtful Critic": achievementBadgeImage("thoughtful_critic"),
  "Goal Setter": achievementBadgeImage("goal_setter"),
  "Goal Getter": achievementBadgeImage("goal_getter"),
  "Quest Begun": achievementBadgeImage("quest_begun"),
  "Quest Runner": achievementBadgeImage("quest_runner"),
  "Quest Master": achievementBadgeImage("quest_master"),
  "League Debut": achievementBadgeImage("league_debut"),
  "Podium Reader": achievementBadgeImage("podium_reader"),
  "First Edition Champion": achievementBadgeImage("first_edition_champion"),
} as const;
