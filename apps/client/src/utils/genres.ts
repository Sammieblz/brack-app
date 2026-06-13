import { GENRES } from "@/constants";

const GENRE_SET = new Set<string>(GENRES);

const ALIASES: Record<string, string> = {
  "art": "Art & Photography",
  "art & photography": "Art & Photography",
  "artists": "Art & Photography",
  "biography": "Biography & Memoir",
  "biography & autobiography": "Biography & Memoir",
  "biography & memoir": "Biography & Memoir",
  "business": "Business & Economics",
  "business & economics": "Business & Economics",
  "comics & graphic novels": "Comics & Graphic Novels",
  "comics & graphic novels / general": "Comics & Graphic Novels",
  "computers": "Computers & Technology",
  "computers & technology": "Computers & Technology",
  "cooking": "Cooking & Food",
  "education": "Education",
  "fiction": "Fiction",
  "fiction / classics": "Classics",
  "fiction / fantasy": "Fantasy",
  "fiction / historical": "Historical Fiction",
  "fiction / horror": "Horror",
  "fiction / literary": "Literary Fiction",
  "fiction / mystery & detective": "Mystery",
  "fiction / romance": "Romance",
  "fiction / science fiction": "Science Fiction",
  "fiction / thrillers": "Thriller",
  "graphic novels": "Graphic Novels",
  "health": "Health & Wellness",
  "health & fitness": "Health & Wellness",
  "history": "History",
  "humor": "Humor",
  "juvenile fiction": "Juvenile Fiction",
  "juvenile nonfiction": "Juvenile Nonfiction",
  "literary criticism": "Literary Fiction",
  "non-fiction": "Non-Fiction",
  "nonfiction": "Non-Fiction",
  "performing arts": "Drama",
  "philosophy": "Philosophy",
  "poetry": "Poetry",
  "political science": "Politics & Social Sciences",
  "psychology": "Psychology",
  "reference": "Reference",
  "religion": "Religion & Spirituality",
  "religion & spirituality": "Religion & Spirituality",
  "science": "Science & Nature",
  "science & nature": "Science & Nature",
  "self-help": "Self-Help",
  "social science": "Politics & Social Sciences",
  "sports & recreation": "Sports & Outdoors",
  "technology": "Computers & Technology",
  "travel": "Travel",
  "true crime": "True Crime",
  "young adult fiction": "Young Adult",
  "young adult nonfiction": "Young Adult",
};

export const normalizeGenre = (value?: string | null): string | null => {
  const raw = value?.trim();
  if (!raw) return null;

  if (GENRE_SET.has(raw)) return raw;

  const primaryCategory = raw.split("/")[0]?.trim();
  if (primaryCategory && GENRE_SET.has(primaryCategory)) return primaryCategory;

  const normalized = raw.toLowerCase().replace(/\s+/g, " ");
  if (ALIASES[normalized]) return ALIASES[normalized];

  const broadMatch = Object.entries(ALIASES).find(([alias]) => normalized.startsWith(alias));
  return broadMatch?.[1] ?? "Other";
};

export const getCuratedGenres = (existingGenres: Array<string | null | undefined> = []) => {
  const normalizedExisting = existingGenres
    .map((genre) => normalizeGenre(genre))
    .filter((genre): genre is string => Boolean(genre));

  return Array.from(new Set<string>([...GENRES, ...normalizedExisting]));
};
