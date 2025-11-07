import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { BookOpen, Calendar, Clock, FileText, Search } from "lucide-react";
import { format } from "date-fns";

interface ProgressLog {
  id: string;
  book_id: string;
  page_number: number;
  chapter_number: number | null;
  paragraph_number: number | null;
  notes: string | null;
  logged_at: string;
  log_type: 'manual' | 'timer_based' | 'automatic';
  time_spent_minutes: number | null;
  books: {
    title: string;
    author: string | null;
    cover_url: string | null;
  };
}

interface JournalEntry {
  id: string;
  book_id: string;
  entry_type: 'note' | 'quote' | 'reflection';
  title: string | null;
  content: string;
  page_reference: number | null;
  tags: string[] | null;
  created_at: string;
  books: {
    title: string;
    author: string | null;
    cover_url: string | null;
  };
}

export default function ReadingHistory() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [progressLogs, setProgressLogs] = useState<ProgressLog[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchData();
  }, [user, authLoading, navigate]);

  const fetchData = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Fetch progress logs with book details
      const { data: logsData, error: logsError } = await supabase
        .from('progress_logs')
        .select(`
          id,
          book_id,
          page_number,
          chapter_number,
          paragraph_number,
          notes,
          logged_at,
          log_type,
          time_spent_minutes,
          books (
            title,
            author,
            cover_url
          )
        `)
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false });

      if (logsError) {
        console.error('Error fetching logs:', logsError);
      }

      // Fetch journal entries with book details
      const { data: journalData, error: journalError } = await supabase
        .from('journal_entries')
        .select(`
          id,
          book_id,
          entry_type,
          title,
          content,
          page_reference,
          tags,
          created_at,
          books (
            title,
            author,
            cover_url
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (journalError) {
        console.error('Error fetching journals:', journalError);
      }

      setProgressLogs((logsData as any) || []);
      setJournalEntries((journalData as any) || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = progressLogs.filter(log => {
    if (!log.books) return false;
    const searchLower = searchQuery.toLowerCase();
    return (
      log.books.title?.toLowerCase().includes(searchLower) ||
      log.notes?.toLowerCase().includes(searchLower)
    );
  });

  const filteredJournals = journalEntries.filter(entry => {
    if (!entry.books) return false;
    const searchLower = searchQuery.toLowerCase();
    return (
      entry.books.title?.toLowerCase().includes(searchLower) ||
      entry.title?.toLowerCase().includes(searchLower) ||
      entry.content?.toLowerCase().includes(searchLower) ||
      entry.tags?.some(tag => tag.toLowerCase().includes(searchLower))
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Reading History</h1>
          <p className="text-muted-foreground">View all your progress logs and journal entries</p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by book title, notes, or tags..."
              className="pl-10"
            />
          </div>
        </div>

        <Tabs defaultValue="logs" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="logs">
              Progress Logs ({filteredLogs.length})
            </TabsTrigger>
            <TabsTrigger value="journals">
              Journal Entries ({filteredJournals.length})
            </TabsTrigger>
          </TabsList>

          {/* Progress Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            {filteredLogs.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No progress logs found</p>
                </CardContent>
              </Card>
            ) : (
              filteredLogs.map((log) => (
                <Card 
                  key={log.id}
                  className="hover:shadow-soft transition-all cursor-pointer"
                  onClick={() => navigate(`/book/${log.book_id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {/* Book Cover */}
                      <div className="flex-shrink-0">
                        {log.books.cover_url ? (
                          <img
                            src={log.books.cover_url}
                            alt={log.books.title}
                            className="w-16 h-24 object-cover rounded shadow-sm"
                          />
                        ) : (
                          <div className="w-16 h-24 bg-gradient-primary rounded flex items-center justify-center">
                            <BookOpen className="h-8 w-8 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Log Details */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{log.books.title}</h3>
                        {log.books.author && (
                          <p className="text-sm text-muted-foreground truncate">
                            by {log.books.author}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="outline">
                            Page {log.page_number}
                          </Badge>
                          {log.chapter_number && (
                            <Badge variant="outline">
                              Chapter {log.chapter_number}
                            </Badge>
                          )}
                          {log.time_spent_minutes && (
                            <Badge variant="secondary">
                              <Clock className="h-3 w-3 mr-1" />
                              {log.time_spent_minutes} min
                            </Badge>
                          )}
                          <Badge variant="secondary" className="capitalize">
                            {log.log_type.replace('_', ' ')}
                          </Badge>
                        </div>

                        {log.notes && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {log.notes}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(log.logged_at), 'PPp')}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Journal Entries Tab */}
          <TabsContent value="journals" className="space-y-4">
            {filteredJournals.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No journal entries found</p>
                </CardContent>
              </Card>
            ) : (
              filteredJournals.map((entry) => (
                <Card 
                  key={entry.id}
                  className="hover:shadow-soft transition-all cursor-pointer"
                  onClick={() => navigate(`/book/${entry.book_id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="capitalize">
                            {entry.entry_type}
                          </Badge>
                          {entry.page_reference && (
                            <Badge variant="outline">
                              Page {entry.page_reference}
                            </Badge>
                          )}
                        </div>
                        {entry.title && (
                          <CardTitle className="text-lg">{entry.title}</CardTitle>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4">
                      {/* Book Cover */}
                      <div className="flex-shrink-0">
                        {entry.books.cover_url ? (
                          <img
                            src={entry.books.cover_url}
                            alt={entry.books.title}
                            className="w-12 h-16 object-cover rounded shadow-sm"
                          />
                        ) : (
                          <div className="w-12 h-16 bg-gradient-primary rounded flex items-center justify-center">
                            <BookOpen className="h-6 w-6 text-white" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{entry.books.title}</p>
                        {entry.books.author && (
                          <p className="text-xs text-muted-foreground truncate">
                            by {entry.books.author}
                          </p>
                        )}

                        <p className="text-sm mt-3 line-clamp-3">{entry.content}</p>

                        {entry.tags && entry.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {entry.tags.map((tag, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(entry.created_at), 'PPp')}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
