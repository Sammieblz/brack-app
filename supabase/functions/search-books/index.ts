import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/appEndpoint.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/errorHandler.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { parseJsonBody, requireFields } from "../_shared/validation.ts";

interface GoogleBooksVolume {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
    pageCount?: number;
    categories?: string[];
    averageRating?: number;
    ratingsCount?: number;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
}

interface OpenLibraryDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  publisher?: string[];
  isbn?: string[];
  subject?: string[];
  cover_i?: number;
  number_of_pages_median?: number;
  ratings_average?: number;
  ratings_count?: number;
}

interface SearchRequest {
  query?: string;
  maxResults?: number;
}

type SearchBook = Record<string, unknown>;

const limiterConfig = {
  name: "search-books",
  limit: 30,
  windowMs: 60_000,
};

const normalizeIsbn = (value: string) => value.toUpperCase().replace(/[^0-9X]/g, "");

const isValidIsbn10 = (value: string) => {
  if (!/^\d{9}[\dX]$/.test(value)) return false;
  const total = value.split("").reduce((sum, character, index) => {
    const digit = character === "X" ? 10 : Number(character);
    return sum + digit * (10 - index);
  }, 0);
  return total % 11 === 0;
};

const isValidIsbn13 = (value: string) => {
  if (!/^\d{13}$/.test(value)) return false;
  const total = value
    .slice(0, 12)
    .split("")
    .reduce((sum, character, index) => sum + Number(character) * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (total % 10)) % 10 === Number(value[12]);
};

const extractIsbn = (query: string) => {
  const candidate = normalizeIsbn(query.replace(/^isbn:/i, ""));
  if (isValidIsbn13(candidate) || isValidIsbn10(candidate)) return candidate;
  const embedded = query.match(/(?:97[89][\d\-\s]{10,}|[\dX][\dX\-\s]{8,})/i)?.[0];
  if (!embedded) return null;
  const normalized = normalizeIsbn(embedded);
  return isValidIsbn13(normalized) || isValidIsbn10(normalized) ? normalized : null;
};

const normalizeGenre = (value?: string | null): string | null => {
  const raw = value?.trim();
  if (!raw) return null;
  const normalized = raw.toLowerCase().replace(/\s+/g, " ");
  const firstSegment = normalized.split("/")[0]?.trim();
  const aliases: Record<string, string> = {
    art: "Art & Photography",
    biography: "Biography & Memoir",
    "biography & autobiography": "Biography & Memoir",
    business: "Business & Economics",
    "business & economics": "Business & Economics",
    "comics & graphic novels": "Comics & Graphic Novels",
    computers: "Computers & Technology",
    cooking: "Cooking & Food",
    drama: "Drama",
    education: "Education",
    fantasy: "Fantasy",
    fiction: "Fiction",
    "graphic novels": "Graphic Novels",
    health: "Health & Wellness",
    "health & fitness": "Health & Wellness",
    history: "History",
    horror: "Horror",
    humor: "Humor",
    "juvenile fiction": "Juvenile Fiction",
    "juvenile nonfiction": "Juvenile Nonfiction",
    mystery: "Mystery",
    "non-fiction": "Non-Fiction",
    nonfiction: "Non-Fiction",
    philosophy: "Philosophy",
    poetry: "Poetry",
    "political science": "Politics & Social Sciences",
    psychology: "Psychology",
    reference: "Reference",
    religion: "Religion & Spirituality",
    romance: "Romance",
    science: "Science & Nature",
    "science fiction": "Science Fiction",
    "self-help": "Self-Help",
    "social science": "Politics & Social Sciences",
    "sports & recreation": "Sports & Outdoors",
    technology: "Computers & Technology",
    thriller: "Thriller",
    travel: "Travel",
    "young adult fiction": "Young Adult",
    "young adult nonfiction": "Young Adult",
  };
  return aliases[normalized] || aliases[firstSegment] || "Other";
};

const fetchWithTimeout = async (url: string, timeoutMs = 9_000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const searchGoogleBooks = async (query: string, maxResults: number): Promise<SearchBook[]> => {
  const apiKey = Deno.env.get("GOOGLE_BOOKS_API_KEY");
  const apiUrl = new URL("https://www.googleapis.com/books/v1/volumes");
  apiUrl.searchParams.set("q", query);
  apiUrl.searchParams.set("maxResults", String(maxResults));
  apiUrl.searchParams.set("printType", "books");
  if (apiKey) apiUrl.searchParams.set("key", apiKey);

  const response = await fetchWithTimeout(apiUrl.toString());
  if (!response.ok) {
    const error = new Error(`Google Books API returned ${response.status}`) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  return ((data.items || []) as GoogleBooksVolume[]).map((item) => {
    const volumeInfo = item.volumeInfo;
    const isbn13 = volumeInfo.industryIdentifiers?.find((id) => id.type === "ISBN_13")?.identifier;
    const isbn10 = volumeInfo.industryIdentifiers?.find((id) => id.type === "ISBN_10")?.identifier;
    return {
      googleBooksId: item.id,
      source_provider: "google_books",
      source_id: item.id,
      title: volumeInfo.title,
      author: volumeInfo.authors?.join(", ") || null,
      isbn: isbn13 || isbn10 || null,
      genre: normalizeGenre(volumeInfo.categories?.[0] || null),
      pages: volumeInfo.pageCount || null,
      chapters: null,
      cover_url:
        volumeInfo.imageLinks?.thumbnail?.replace("http://", "https://") ||
        volumeInfo.imageLinks?.smallThumbnail?.replace("http://", "https://") ||
        null,
      description: volumeInfo.description || null,
      publisher: volumeInfo.publisher || null,
      published_date: volumeInfo.publishedDate || null,
      average_rating: volumeInfo.averageRating || null,
      ratings_count: volumeInfo.ratingsCount || null,
    };
  });
};

const searchOpenLibrary = async (
  query: string,
  maxResults: number,
  isbn: string | null
): Promise<SearchBook[]> => {
  const fields = [
    "key",
    "title",
    "author_name",
    "first_publish_year",
    "publisher",
    "isbn",
    "subject",
    "cover_i",
    "number_of_pages_median",
    "ratings_average",
    "ratings_count",
  ].join(",");
  const apiUrl = new URL("https://openlibrary.org/search.json");
  if (isbn) apiUrl.searchParams.set("isbn", isbn);
  else apiUrl.searchParams.set("q", query);
  apiUrl.searchParams.set("limit", String(maxResults));
  apiUrl.searchParams.set("fields", fields);

  const response = await fetchWithTimeout(apiUrl.toString());
  if (!response.ok) throw new Error(`Open Library API returned ${response.status}`);
  const data = await response.json();
  const docs = Array.isArray(data.docs) ? (data.docs as OpenLibraryDoc[]) : [];

  return docs.filter((doc) => doc.title).map((doc) => {
    const sourceId = doc.key || doc.isbn?.[0] || crypto.randomUUID();
    return {
      googleBooksId: sourceId,
      source_provider: "open_library",
      source_id: sourceId,
      title: doc.title,
      author: doc.author_name?.join(", ") || null,
      isbn: isbn || doc.isbn?.find((value) => isValidIsbn13(normalizeIsbn(value))) || doc.isbn?.[0] || null,
      genre: normalizeGenre(doc.subject?.[0] || null),
      pages: doc.number_of_pages_median || null,
      chapters: null,
      cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      description: null,
      publisher: doc.publisher?.[0] || null,
      published_date: doc.first_publish_year ? String(doc.first_publish_year) : null,
      average_rating: doc.ratings_average || null,
      ratings_count: doc.ratings_count || null,
    };
  });
};

const createCacheKey = async (query: string, maxResults: number) => {
  const bytes = new TextEncoder().encode(`${query.toLowerCase()}:${maxResults}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const serviceClient = createServiceClient();
    const limited = await enforceRateLimit(req, serviceClient, limiterConfig);
    if (limited) return limited;

    const parsed = await parseJsonBody<SearchRequest>(req);
    if (parsed.error) return parsed.error;
    const requiredError = requireFields(parsed.data, ["query"]);
    if (requiredError) return requiredError;

    const trimmedQuery = parsed.data.query?.trim() ?? "";
    if (!trimmedQuery || trimmedQuery.length > 200) {
      return new Response(
        JSON.stringify({ error: !trimmedQuery ? "Search query is required" : "Search query too long" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const maxResults = Math.min(Math.max(1, Number(parsed.data.maxResults) || 10), 40);
    const isbn = extractIsbn(trimmedQuery);
    const providerQuery = isbn ? `isbn:${isbn}` : trimmedQuery;
    const cacheKey = await createCacheKey(providerQuery, maxResults);
    const now = new Date();

    const { data: cached } = await serviceClient
      .from("book_metadata_cache")
      .select("*")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (cached && Date.parse(cached.expires_at) > now.getTime()) {
      return new Response(
        JSON.stringify({
          books: cached.payload,
          provider: cached.provider,
          cached: true,
          stale: false,
          isbn,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let books: SearchBook[] = [];
    let provider = "google_books";
    let providerError: string | null = null;

    try {
      books = await searchGoogleBooks(providerQuery, maxResults);
    } catch (error) {
      providerError = error instanceof Error ? error.message : "Google Books failed";
    }

    if (books.length === 0) {
      try {
        books = await searchOpenLibrary(trimmedQuery, maxResults, isbn);
        provider = "open_library";
      } catch (error) {
        providerError = [providerError, error instanceof Error ? error.message : "Open Library failed"]
          .filter(Boolean)
          .join("; ");
      }
    }

    if (books.length === 0 && cached) {
      return new Response(
        JSON.stringify({
          books: cached.payload,
          provider: cached.provider,
          cached: true,
          stale: true,
          isbn,
          provider_error: providerError,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (books.length === 0 && providerError) {
      return new Response(
        JSON.stringify({
          error: "Book providers are temporarily unavailable",
          code: "providers_unavailable",
          retryable: true,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const expiresAt = new Date(now.getTime() + (isbn ? 7 : 1) * 24 * 60 * 60 * 1000).toISOString();
    const { error: cacheError } = await serviceClient.from("book_metadata_cache").upsert({
      cache_key: cacheKey,
      query: trimmedQuery,
      isbn,
      provider,
      payload: books,
      fetched_at: now.toISOString(),
      expires_at: expiresAt,
      last_error: providerError,
    });
    if (cacheError) console.warn("Book metadata cache write failed", cacheError.message);

    return new Response(
      JSON.stringify({
        books,
        provider,
        cached: false,
        stale: false,
        isbn,
        provider_error: providerError,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return createErrorResponse(error, 500, req.headers.get("origin"), {
      function: "search-books",
    });
  }
});
