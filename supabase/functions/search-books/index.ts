import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/appEndpoint.ts";
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
    industryIdentifiers?: Array<{
      type: string;
      identifier: string;
    }>;
    pageCount?: number;
    categories?: string[];
    averageRating?: number;
    ratingsCount?: number;
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
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

const limiterConfig = {
  name: "search-books",
  limit: 30, // requests
  windowMs: 60_000, // per minute
};

const normalizeGenre = (value?: string | null): string | null => {
  const raw = value?.trim();
  if (!raw) return null;

  const normalized = raw.toLowerCase().replace(/\s+/g, " ");
  const firstSegment = normalized.split("/")[0]?.trim();

  const aliases: Record<string, string> = {
    "art": "Art & Photography",
    "biography": "Biography & Memoir",
    "biography & autobiography": "Biography & Memoir",
    "business": "Business & Economics",
    "business & economics": "Business & Economics",
    "comics & graphic novels": "Comics & Graphic Novels",
    "computers": "Computers & Technology",
    "cooking": "Cooking & Food",
    "drama": "Drama",
    "education": "Education",
    "fantasy": "Fantasy",
    "fiction": "Fiction",
    "graphic novels": "Graphic Novels",
    "health": "Health & Wellness",
    "health & fitness": "Health & Wellness",
    "history": "History",
    "horror": "Horror",
    "humor": "Humor",
    "juvenile fiction": "Juvenile Fiction",
    "juvenile nonfiction": "Juvenile Nonfiction",
    "mystery": "Mystery",
    "non-fiction": "Non-Fiction",
    "nonfiction": "Non-Fiction",
    "performing arts": "Drama",
    "philosophy": "Philosophy",
    "poetry": "Poetry",
    "political science": "Politics & Social Sciences",
    "psychology": "Psychology",
    "reference": "Reference",
    "religion": "Religion & Spirituality",
    "romance": "Romance",
    "science": "Science & Nature",
    "science fiction": "Science Fiction",
    "self-help": "Self-Help",
    "social science": "Politics & Social Sciences",
    "sports & recreation": "Sports & Outdoors",
    "technology": "Computers & Technology",
    "thriller": "Thriller",
    "travel": "Travel",
    "young adult fiction": "Young Adult",
    "young adult nonfiction": "Young Adult",
  };

  return aliases[normalized] || aliases[firstSegment] || "Other";
};

const searchOpenLibrary = async (query: string, maxResults: number) => {
  const encodedQuery = encodeURIComponent(query);
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
  const apiUrl = `https://openlibrary.org/search.json?q=${encodedQuery}&limit=${maxResults}&fields=${fields}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(apiUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Open Library API error: ${response.status}`);
    }

    const data = await response.json();
    const docs = Array.isArray(data.docs) ? data.docs as OpenLibraryDoc[] : [];

    return docs
      .filter((doc) => doc.title)
      .map((doc) => {
        const sourceId = doc.key || doc.isbn?.[0] || doc.title || crypto.randomUUID();
        return {
          googleBooksId: sourceId,
          source_provider: "open_library",
          source_id: sourceId,
          title: doc.title,
          author: doc.author_name?.join(", ") || null,
          isbn: doc.isbn?.[0] || null,
          genre: normalizeGenre(doc.subject?.[0] || null),
          pages: doc.number_of_pages_median || null,
          chapters: null,
          cover_url: doc.cover_i
            ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
            : null,
          description: null,
          publisher: doc.publisher?.[0] || null,
          published_date: doc.first_publish_year
            ? String(doc.first_publish_year)
            : null,
          average_rating: doc.ratings_average || null,
          ratings_count: doc.ratings_count || null,
        };
      });
  } finally {
    clearTimeout(timeoutId);
  }
};

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const limited = await enforceRateLimit(req, createServiceClient(), limiterConfig);
    if (limited) return limited;

    const parsed = await parseJsonBody<{ query?: string; maxResults?: number }>(
      req,
    );
    if (parsed.error) return parsed.error;

    const requiredError = requireFields(parsed.data, ["query"]);
    if (requiredError) return requiredError;

    const { query, maxResults = 10 } = parsed.data;

    const trimmedQuery = query?.trim() ?? "";
    if (trimmedQuery.length === 0) {
      return new Response(JSON.stringify({ error: "Search query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate search query length
    if (trimmedQuery.length > 200) {
      return new Response(JSON.stringify({ error: "Search query too long (max 200 characters)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cap maxResults to prevent excessive API calls
    const maxResultsLimit = Math.min(Math.max(1, maxResults), 40);

    // Build Google Books API URL
    const encodedQuery = encodeURIComponent(trimmedQuery);
    const apiKey = Deno.env.get('GOOGLE_BOOKS_API_KEY');
    const apiUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodedQuery}&maxResults=${maxResultsLimit}&printType=books${apiKey ? `&key=${apiKey}` : ''}`;

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(apiUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

    if (!response.ok) {
      const googleError = await response.text();
      console.error("Google Books API error:", response.status, googleError);

      if (response.status === 403 || response.status === 429 || response.status >= 500) {
        const books = await searchOpenLibrary(trimmedQuery, maxResultsLimit);
        return new Response(JSON.stringify({ books, fallback_provider: "open_library" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ error: "Failed to search books" }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();

    // Transform Google Books data to our format
    const books = (data.items || []).map((item: GoogleBooksVolume) => {
      const volumeInfo = item.volumeInfo;
      const isbn13 = volumeInfo.industryIdentifiers?.find(
        (id) => id.type === "ISBN_13"
      )?.identifier;
      const isbn10 = volumeInfo.industryIdentifiers?.find(
        (id) => id.type === "ISBN_10"
      )?.identifier;

      return {
        googleBooksId: item.id,
        source_provider: "google_books",
        source_id: item.id,
        title: volumeInfo.title,
        author: volumeInfo.authors?.join(", ") || null,
        isbn: isbn13 || isbn10 || null,
        genre: normalizeGenre(volumeInfo.categories?.[0] || null),
        pages: volumeInfo.pageCount || null,
        chapters: null, // Google Books API doesn't provide chapter count
        cover_url: volumeInfo.imageLinks?.thumbnail?.replace("http://", "https://") || 
                   volumeInfo.imageLinks?.smallThumbnail?.replace("http://", "https://") || 
                   null,
        description: volumeInfo.description || null,
        publisher: volumeInfo.publisher || null,
        published_date: volumeInfo.publishedDate || null,
        average_rating: volumeInfo.averageRating || null,
        ratings_count: volumeInfo.ratingsCount || null,
      };
    });

      return new Response(JSON.stringify({ books }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error('Request timeout - Google Books API took too long to respond');
      }
      throw fetchError;
    }
  } catch (error) {
    const { createErrorResponse } = await import("../_shared/errorHandler.ts");
    return createErrorResponse(error, 500, req.headers.get('origin'), {
      function: "search-books",
    });
  }
});
