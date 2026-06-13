import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Refresh, Star, Camera } from "iconoir-react";
import { useToast } from "@/hooks/use-toast";
import { APP_ICONS } from "@/config/iconography";
import { searchBooks } from "@/services/api";
import type { Book } from "@/types";
import type { GoogleBookResult } from "@/types/googleBooks";
import { findExistingLibraryBook } from "@/utils/bookIdentity";

interface BookSearchProps {
  onSelectBook: (book: GoogleBookResult) => void;
  onQuickAdd?: (book: GoogleBookResult) => Promise<void>;
  initialQuery?: string;
  existingBooks?: Book[];
  onViewExisting?: (book: Book) => void;
}

export const BookSearch = ({
  onSelectBook,
  onQuickAdd,
  initialQuery,
  existingBooks = [],
  onViewExisting,
}: BookSearchProps) => {
  const [searchQuery, setSearchQuery] = useState(initialQuery || "");
  const [results, setResults] = useState<GoogleBookResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingBookId, setAddingBookId] = useState<string | null>(null);
  const [fromCoverScan, setFromCoverScan] = useState(false);
  const { toast } = useToast();

  // Auto-search when initialQuery is provided
  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      setFromCoverScan(true);
      handleSearch(undefined, initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const handleSearch = async (e?: React.FormEvent, queryOverride?: string) => {
    e?.preventDefault();
    
    const query = queryOverride || searchQuery;
    
    if (!query.trim()) {
      toast({
        title: "Search required",
        description: "Please enter a book title, author, or ISBN",
        variant: "destructive",
      });
      return;
    }

    setSearching(true);
    try {
      const data = await searchBooks<GoogleBookResult>({ query, maxResults: 20 });

      if (data?.books) {
        setResults(data.books);
        if (data.books.length === 0) {
          toast({
            title: "No results",
            description: "Try a different search term",
          });
        }
      } else {
        // Handle case where data exists but no books array
        setResults([]);
        toast({
          title: "No results",
          description: "No books found for your search.",
        });
      }
    } catch (error: unknown) {
      handleSearchError(error);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchError = (error: unknown) => {
    console.error("Search function error:", error);

    if (process.env.NODE_ENV === 'development') {
      const errorForLog = error as Record<string, unknown>;
      console.error("Error details:", {
        type: typeof error,
        keys: error ? Object.keys(errorForLog) : [],
        status: errorForLog?.status,
        statusCode: errorForLog?.statusCode,
        code: errorForLog?.code,
        context: errorForLog?.context,
      });
    }

    interface ErrorWithContext {
      context?: { status?: number; message?: string };
      status?: number;
      statusCode?: number;
      code?: number;
      message?: string;
      error?: { message?: string } | string;
    }

    const errorObj = error as ErrorWithContext;
    let errorStatus: number | null = null;
    if (errorObj?.context?.status) {
      errorStatus = errorObj.context.status;
    } else if (errorObj?.status) {
      errorStatus = errorObj.status;
    } else if (errorObj?.statusCode) {
      errorStatus = errorObj.statusCode;
    } else if (errorObj?.code && typeof errorObj.code === 'number') {
      errorStatus = errorObj.code;
    }

    let errorMessage = "Unknown error";
    if (errorObj?.message) {
      errorMessage = String(errorObj.message);
    } else if (errorObj?.context?.message) {
      errorMessage = String(errorObj.context.message);
    } else if (errorObj?.error) {
      if (typeof errorObj.error === 'string') {
        errorMessage = errorObj.error;
      } else if (errorObj.error?.message) {
        errorMessage = String(errorObj.error.message);
      } else {
        errorMessage = JSON.stringify(errorObj.error);
      }
    }

    const errorString = String(error);
    const errorMessageLower = errorMessage.toLowerCase();
    const errorStringLower = errorString.toLowerCase();
    const isRateLimit = errorStatus === 429 ||
      /429/.test(errorMessage) ||
      /429/.test(errorString) ||
      /too many requests/i.test(errorMessage) ||
      /too many requests/i.test(errorString) ||
      /rate limit/i.test(errorMessage) ||
      /rate limit/i.test(errorString) ||
      errorMessageLower.includes('too many') ||
      errorStringLower.includes('too many');

    if (isRateLimit) {
      toast({
        title: "Too many requests",
        description: "Please wait a moment before searching again.",
        variant: "destructive",
      });
      return;
    }

    if (errorStatus === 400 || errorMessage.includes('required') || errorMessage.includes('invalid')) {
      toast({
        title: "Invalid search",
        description: errorMessage.includes('required') || errorMessage.includes('invalid')
          ? errorMessage
          : "Please check your search query and try again.",
        variant: "destructive",
      });
      return;
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('took too long')) {
      toast({
        title: "Request timeout",
        description: "The search took too long. Please try again with a different query.",
        variant: "destructive",
      });
      return;
    }

    if ((errorStatus !== null && errorStatus >= 500) || errorMessage.includes('service') || errorMessage.includes('unavailable')) {
      toast({
        title: "Service unavailable",
        description: "The search service is temporarily unavailable. Please try again later.",
        variant: "destructive",
      });
      return;
    }

    const userMessage = errorMessage.length > 100
      ? "Unable to search books. Please try again."
      : errorMessage;

    toast({
      title: "Search failed",
      description: userMessage,
      variant: "destructive",
    });
  };

  const handleQuickAdd = async (book: GoogleBookResult) => {
    if (!onQuickAdd) return;
    
    setAddingBookId(book.googleBooksId);
    try {
      await onQuickAdd(book);
    } catch (error: unknown) {
      toast({
        title: "Failed to add book",
        description: error instanceof Error ? error.message : 'Failed to add book',
        variant: "destructive",
      });
    } finally {
      setAddingBookId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cover Scan Indicator */}
      {fromCoverScan && (
        <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <Camera className="h-4 w-4 text-primary" />
          <p className="text-sm text-primary font-medium">Results from cover scan</p>
        </div>
      )}
      
      {/* Search Form */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, author, or ISBN..."
            className="pl-10"
          />
        </div>
        <Button type="submit" disabled={searching}>
          {searching ? (
            <>
              <Refresh className="mr-2 h-4 w-4 animate-spin" />
              Searching...
            </>
          ) : (
            "Search"
          )}
        </Button>
      </form>

      {/* Search Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground sticky top-0 bg-background/95 backdrop-blur z-10 py-2">
            Found {results.length} results
          </p>
          <div
            className="space-y-2 overflow-y-auto overscroll-contain pr-2"
            style={{ maxHeight: "min(32rem, calc(var(--app-viewport-height, 100dvh) - 18rem))" }}
          >
            {results.map((book) => (
              <SearchResultCard
                key={book.googleBooksId}
                book={book}
                existingBook={findExistingLibraryBook(book, existingBooks)}
                adding={addingBookId === book.googleBooksId}
                onSelectBook={onSelectBook}
                onQuickAdd={onQuickAdd ? handleQuickAdd : undefined}
                onViewExisting={onViewExisting}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface SearchResultCardProps {
  book: GoogleBookResult;
  existingBook: Book | null;
  adding: boolean;
  onSelectBook: (book: GoogleBookResult) => void;
  onQuickAdd?: (book: GoogleBookResult) => Promise<void>;
  onViewExisting?: (book: Book) => void;
}

const SearchResultCard = ({
  book,
  existingBook,
  adding,
  onSelectBook,
  onQuickAdd,
  onViewExisting,
}: SearchResultCardProps) => {
  return (
    <Card className="cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    {/* Book Cover */}
                    <div className="flex flex-shrink-0 justify-center sm:block">
                      {book.cover_url ? (
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="w-16 h-24 object-cover rounded shadow-sm"
                        />
                      ) : (
                        <div className="w-16 h-24 bg-gradient-primary rounded flex items-center justify-center">
                          <APP_ICONS.dashboard.coverFallback className="h-8 w-8 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Book Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif font-semibold text-foreground truncate">
                        {book.title}
                      </h3>
                      {book.author && (
                        <p className="font-serif text-sm text-muted-foreground truncate">
                          by {book.author}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2 mt-2">
                        {book.average_rating && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <Star className="h-3 w-3 fill-current" />
                            {book.average_rating.toFixed(1)}
                            {book.ratings_count && ` (${book.ratings_count})`}
                          </Badge>
                        )}
                        {book.genre && (
                          <Badge variant="secondary" className="text-xs">
                            {book.genre}
                          </Badge>
                        )}
                        {book.pages && (
                          <Badge variant="outline" className="text-xs">
                            {book.pages} pages
                          </Badge>
                        )}
                        {book.chapters && (
                          <Badge variant="outline" className="text-xs">
                            {book.chapters} chapters
                          </Badge>
                        )}
                        {book.published_date && (
                          <Badge variant="outline" className="text-xs">
                            {book.published_date.split("-")[0]}
                          </Badge>
                        )}
                        {existingBook && (
                          <Badge className="text-xs bg-primary text-primary-foreground">
                            In Library
                          </Badge>
                        )}
                      </div>

                      {book.description && (
                        <p className="font-serif text-xs text-muted-foreground mt-2 line-clamp-2">
                          {book.description}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 sm:w-24 sm:flex-col sm:justify-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => existingBook && onViewExisting ? onViewExisting(existingBook) : onSelectBook(book)}
                        className="flex-1 sm:flex-none"
                      >
                        {existingBook ? "Open" : "Select"}
                      </Button>
                      {onQuickAdd && (
                        <Button
                          size="sm"
                          onClick={() => onQuickAdd(book)}
                          disabled={Boolean(existingBook) || adding}
                          className="flex-1 sm:flex-none"
                        >
                          {adding ? (
                            <Refresh className="h-4 w-4 animate-spin" />
                          ) : existingBook ? (
                            "Added"
                          ) : (
                            <>
                              <Plus className="mr-1 h-3 w-3" />
                              Add
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
    </Card>
  );
};
