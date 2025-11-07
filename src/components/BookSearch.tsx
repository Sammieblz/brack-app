import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, BookOpen, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { GoogleBookResult } from "@/types/googleBooks";

interface BookSearchProps {
  onSelectBook: (book: GoogleBookResult) => void;
  onQuickAdd?: (book: GoogleBookResult) => Promise<void>;
}

export const BookSearch = ({ onSelectBook, onQuickAdd }: BookSearchProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<GoogleBookResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingBookId, setAddingBookId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      toast({
        title: "Search required",
        description: "Please enter a book title, author, or ISBN",
        variant: "destructive",
      });
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("search-books", {
        body: { query: searchQuery, maxResults: 20 },
      });

      if (error) throw error;

      if (data?.books) {
        setResults(data.books);
        if (data.books.length === 0) {
          toast({
            title: "No results",
            description: "Try a different search term",
          });
        }
      }
    } catch (error: any) {
      console.error("Search error:", error);
      toast({
        title: "Search failed",
        description: error.message || "Unable to search books. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const handleQuickAdd = async (book: GoogleBookResult) => {
    if (!onQuickAdd) return;
    
    setAddingBookId(book.googleBooksId);
    try {
      await onQuickAdd(book);
      toast({
        title: "Book added!",
        description: `${book.title} has been added to your library`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to add book",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAddingBookId(null);
    }
  };

  return (
    <div className="space-y-4">
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
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
          <p className="text-sm text-muted-foreground">
            Found {results.length} results
          </p>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
            {results.map((book) => (
              <Card
                key={book.googleBooksId}
                className="bg-gradient-card hover:shadow-soft transition-all cursor-pointer"
              >
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    {/* Book Cover */}
                    <div className="flex-shrink-0">
                      {book.cover_url ? (
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="w-16 h-24 object-cover rounded shadow-sm"
                        />
                      ) : (
                        <div className="w-16 h-24 bg-gradient-primary rounded flex items-center justify-center">
                          <BookOpen className="h-8 w-8 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Book Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">
                        {book.title}
                      </h3>
                      {book.author && (
                        <p className="text-sm text-muted-foreground truncate">
                          by {book.author}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2 mt-2">
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
                      </div>

                      {book.description && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {book.description}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2 justify-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSelectBook(book)}
                      >
                        Select
                      </Button>
                      {onQuickAdd && (
                        <Button
                          size="sm"
                          onClick={() => handleQuickAdd(book)}
                          disabled={addingBookId === book.googleBooksId}
                        >
                          {addingBookId === book.googleBooksId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
