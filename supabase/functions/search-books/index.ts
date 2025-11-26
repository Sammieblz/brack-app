import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/rateLimit.ts";
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

const limiterConfig = {
  name: "search-books",
  limit: 30, // requests
  windowMs: 60_000, // per minute
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const limited = rateLimit(req, limiterConfig);
  if (limited) return limited;

  try {
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

    // Build Google Books API URL
    const encodedQuery = encodeURIComponent(trimmedQuery);
    const apiUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodedQuery}&maxResults=${maxResults}&printType=books`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.error("Google Books API error:", response.status, await response.text());
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
        title: volumeInfo.title,
        author: volumeInfo.authors?.join(", ") || null,
        isbn: isbn13 || isbn10 || null,
        genre: volumeInfo.categories?.[0] || null,
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
  } catch (error) {
    console.error("Error in search-books function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
