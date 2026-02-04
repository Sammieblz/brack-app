import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Quote, BookOpen, Share2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { shareService } from "@/services/shareService";
import LoadingSpinner from "./LoadingSpinner";
import type { JournalEntry } from "@/hooks/useJournalEntries";

interface QuoteCollectionProps {
  userId: string;
}

export const QuoteCollection = ({ userId }: QuoteCollectionProps) => {
  const [quotes, setQuotes] = useState<(JournalEntry & { book_title?: string; book_author?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchQuotes();
  }, [userId]);

  const fetchQuotes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('journal_entries')
        .select(`
          *,
          books:book_id (
            title,
            author
          )
        `)
        .eq('user_id', userId)
        .eq('entry_type', 'quote')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const quotesWithBooks = (data || []).map((entry: any) => ({
        ...entry,
        book_title: entry.books?.title,
        book_author: entry.books?.author,
      }));

      setQuotes(quotesWithBooks);
    } catch (error: any) {
      console.error('Error fetching quotes:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load quotes",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleShareQuote = async (quote: typeof quotes[0]) => {
    try {
      const quoteText = quote.title 
        ? `"${quote.content}"\n\n— ${quote.title}${quote.book_title ? `, ${quote.book_title}` : ''}`
        : `"${quote.content}"${quote.book_title ? `\n\n— ${quote.book_title}` : ''}`;
      
      await shareService.shareReadingQuote(quoteText);
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
          <CardTitle className="flex items-center">
            <Quote className="h-5 w-5 mr-2" />
            My Quotes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (quotes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Quote className="h-5 w-5 mr-2" />
            My Quotes
          </CardTitle>
          <CardDescription>Your favorite quotes from books</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Quote className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground mb-4">
              No quotes saved yet
            </p>
            <p className="text-xs text-muted-foreground">
              Add quotes while reading to build your collection
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Quote className="h-5 w-5 mr-2" />
            My Quotes ({quotes.length})
          </div>
        </CardTitle>
        <CardDescription>Your favorite quotes from books</CardDescription>
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
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                No quotes match your search
              </p>
            </div>
          ) : (
            filteredQuotes.map((quote) => (
              <div
                key={quote.id}
                className="p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {quote.title && (
                      <p className="text-sm font-semibold mb-2">{quote.title}</p>
                    )}
                    <p className="text-base italic mb-3">"{quote.content}"</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {quote.book_title && (
                        <>
                          <BookOpen className="h-3 w-3" />
                          <span>
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
                    <Share2 className="h-4 w-4" />
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
