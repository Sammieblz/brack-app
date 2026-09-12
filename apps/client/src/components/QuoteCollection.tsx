import { useCallback, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Quote, Book, ShareIos, Search } from "iconoir-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { shareService } from "@/services/shareService";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { fetchUserQuoteEntries, type QuoteEntry } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingRegion } from "@/components/loading/LoadingRegion";

interface QuoteCollectionProps {
  userId: string;
}

export const QuoteCollection = ({ userId }: QuoteCollectionProps) => {
  const [quotes, setQuotes] = useState<QuoteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const fetchQuotes = useCallback(async () => {
    try {
      setLoading(true);
      setQuotes(await fetchUserQuoteEntries(userId));
    } catch (error: unknown) {
      console.error('Error fetching quotes:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load quotes",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, userId]);

  useEffect(() => {
    void fetchQuotes();
  }, [fetchQuotes]);

  const handleShareQuote = async (quote: typeof quotes[0]) => {
    try {
      const quoteText = quote.title 
        ? `"${quote.content}"\n\n— ${quote.title}${quote.book_title ? `, ${quote.book_title}` : ''}`
        : `"${quote.content}"${quote.book_title ? `\n\n— ${quote.book_title}` : ''}`;
      
      await shareService.share({
        title: "Reading Quote",
        text: quoteText,
      });
    } catch (error) {
      console.error('Error sharing quote:', error);
    }
  };

  const filteredQuotes = quotes.filter(quote => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      quote.content.toLowerCase().includes(query) ||
      quote.title?.toLowerCase().includes(query) ||
      quote.book_title?.toLowerCase().includes(query) ||
      quote.book_author?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center">
            <Quote className="h-5 w-5 mr-2" />
            My Quotes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingRegion loading label="Loading your quotes" className="space-y-4" containerClassName="w-full">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} aria-hidden="true" className="rounded-lg border border-border/70 p-4">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="mt-3 h-5 w-full" />
                <Skeleton className="mt-2 h-5 w-4/5" />
                <Skeleton className="mt-4 h-3 w-2/5" />
              </div>
            ))}
          </LoadingRegion>
        </CardContent>
      </Card>
    );
  }

  if (quotes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center">
            <Quote className="h-5 w-5 mr-2" />
            My Quotes
          </CardTitle>
          <CardDescription className="font-sans">Your favorite quotes from books</CardDescription>
        </CardHeader>
        <CardContent>
          <PremiumEmptyState
            asset="emptyQuotes"
            title="No quotes saved yet"
            description="Add quotes while reading to build your collection."
            variant="plain"
            size="compact"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display flex items-center justify-between">
          <div className="flex items-center">
            <Quote className="h-5 w-5 mr-2" />
            My Quotes ({quotes.length})
          </div>
        </CardTitle>
        <CardDescription className="font-sans">Your favorite quotes from books</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search quotes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Quotes List */}
        <div className="space-y-4">
          {filteredQuotes.length === 0 ? (
            <PremiumEmptyState
              asset="noResults"
              title="No quotes match your search"
              description="Try another phrase, book title, or author."
              variant="plain"
              size="compact"
            />
          ) : (
            filteredQuotes.map((quote) => (
              <div
                key={quote.id}
                className="p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {quote.title && (
                      <p className="font-serif text-sm font-semibold mb-2">{quote.title}</p>
                    )}
                    <p className="font-serif text-base italic mb-3">"{quote.content}"</p>
                    <div className="font-sans flex items-center gap-2 text-xs text-muted-foreground">
                      {quote.book_title && (
                        <>
                          <Book className="h-3 w-3" />
                          <span className="font-serif">
                            {quote.book_title}
                            {quote.book_author && ` by ${quote.book_author}`}
                          </span>
                        </>
                      )}
                      {quote.page_reference && (
                        <span className="ml-2">• Page {quote.page_reference}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleShareQuote(quote)}
                    className="flex-shrink-0"
                  >
                    <ShareIos className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
