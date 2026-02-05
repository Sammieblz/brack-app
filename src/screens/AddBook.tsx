import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookSearch } from "@/components/BookSearch";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Camera, Search, PenTool } from "lucide-react";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileInput } from "@/components/mobile/MobileInput";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { bookOperations } from "@/utils/offlineOperation";
import { GENRES } from "@/constants";
import type { Book } from "@/types";
import type { GoogleBookResult } from "@/types/googleBooks";

const AddBook = () => {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("search");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Get ISBN from URL params if present
  const isbnFromUrl = searchParams.get('isbn') || '';
  // Get search query from URL params (from cover scan)
  const searchFromUrl = searchParams.get('search') || '';
  
  const [formData, setFormData] = useState({
    title: "",
    author: "",
    isbn: isbnFromUrl,
    genre: "",
    pages: "",
    chapters: "",
    cover_url: "",
  });

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUser(user);
    };
    
    getUser();
  }, [navigate]);

  // Update ISBN when URL param changes
  useEffect(() => {
    if (isbnFromUrl) {
      setFormData(prev => ({ ...prev, isbn: isbnFromUrl }));
      // Switch to manual entry tab if ISBN is provided
      setActiveTab("manual");
    }
  }, [isbnFromUrl]);

  // Switch to search tab if search query is provided (from cover scan)
  useEffect(() => {
    if (searchFromUrl) {
      setActiveTab("search");
    }
  }, [searchFromUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    try {
      const bookData: Omit<Book, 'id' | 'created_at' | 'updated_at' | 'deleted_at'> = {
        user_id: user.id,
        title: formData.title,
        author: formData.author || null,
        isbn: formData.isbn || null,
        genre: formData.genre || null,
        pages: formData.pages ? parseInt(formData.pages) : null,
        chapters: formData.chapters ? parseInt(formData.chapters) : null,
        status: 'to_read',
        cover_url: formData.cover_url || null,
        description: null,
        tags: null,
        metadata: {},
        current_page: 0,
        date_started: null,
        date_finished: null,
        rating: null,
        notes: null
      };

      await bookOperations.create(bookData);

      toast.success("Book added successfully!");
      navigate("/dashboard");
    } catch (error: unknown) {
      console.error('Error adding book:', error);
      toast.error(error instanceof Error ? error.message : "Failed to add book");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBook = (book: GoogleBookResult) => {
    setFormData({
      title: book.title,
      author: book.author || "",
      isbn: book.isbn || "",
      genre: book.genre || "",
      pages: book.pages?.toString() || "",
      chapters: book.chapters?.toString() || "",
      cover_url: book.cover_url || "",
    });
    setActiveTab("manual");
    toast.success("Book details loaded! Review and save.");
  };

  const handleQuickAdd = async (book: GoogleBookResult) => {
    if (!user) return;
    
    const bookData: Omit<Book, 'id' | 'created_at' | 'updated_at' | 'deleted_at'> = {
      user_id: user.id,
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      genre: book.genre,
      pages: book.pages,
      chapters: book.chapters,
      status: 'to_read',
      cover_url: book.cover_url,
      description: book.description,
      tags: null,
      metadata: {},
      current_page: 0,
      date_started: null,
      date_finished: null,
      rating: null,
      notes: null
    };

    const { error } = await supabase
      .from('books')
      .insert(bookData);

    if (error) throw error;

    navigate("/dashboard");
  };

  const handleScanISBN = () => {
    navigate("/scan");
  };

  const handleScanCover = () => {
    navigate("/scan-cover");
  };

  const isMobile = useIsMobile();

  return (
    <MobileLayout>
      {isMobile && <MobileHeader title="Add Book" showBack />}
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-md">

        {/* Form Card */}
        <Card className="bg-gradient-card shadow-medium border-0 animate-scale-in">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-bold text-foreground">
              Add a New Book
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 h-12">
                <TabsTrigger value="search" className="flex items-center gap-2 min-h-[44px]">
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">Search Books</span>
                  <span className="sm:hidden">Search</span>
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex items-center gap-2 min-h-[44px]">
                  <PenTool className="h-4 w-4" />
                  <span className="hidden sm:inline">Manual Entry</span>
                  <span className="sm:hidden">Manual</span>
                </TabsTrigger>
              </TabsList>

              {/* Search Tab */}
              <TabsContent value="search" className="space-y-4">
                <BookSearch 
                  onSelectBook={handleSelectBook}
                  onQuickAdd={handleQuickAdd}
                />
              </TabsContent>

              {/* Manual Entry Tab */}
              <TabsContent value="manual">
                <form onSubmit={handleSubmit} className="space-y-4 pb-24 md:pb-4">
                  <MobileInput
                    id="title"
                    label="Title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter book title"
                    required
                  />

                  <MobileInput
                    id="author"
                    label="Author"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    placeholder="Enter author name"
                  />

                  <div className="space-y-2">
                    <Label htmlFor="isbn">ISBN</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="isbn"
                        value={formData.isbn}
                        onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                        placeholder="Enter ISBN"
                        className="flex-1 min-h-[44px]"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleScanISBN}
                        className="border-border/50 hover:shadow-soft transition-all duration-300 px-3 min-h-[44px]"
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="genre">Genre</Label>
                    <Select value={formData.genre} onValueChange={(value) => setFormData({ ...formData, genre: value })}>
                      <SelectTrigger className="min-h-[44px]">
                        <SelectValue placeholder="Select a genre" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENRES.map((genre) => (
                          <SelectItem key={genre} value={genre}>
                            {genre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* Quick Genre Actions */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {GENRES.slice(0, 6).map((genre) => (
                        <Button
                          key={genre}
                          type="button"
                          variant={formData.genre === genre ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFormData({ ...formData, genre })}
                          className="text-xs min-h-[36px]"
                        >
                          {genre}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <MobileInput
                    id="pages"
                    label="Page Count"
                    type="number"
                    inputMode="numeric"
                    value={formData.pages}
                    onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                    placeholder="Enter page count"
                    min="1"
                  />

                  <MobileInput
                    id="chapters"
                    label="Chapter Count"
                    type="number"
                    inputMode="numeric"
                    value={formData.chapters}
                    onChange={(e) => setFormData({ ...formData, chapters: e.target.value })}
                    placeholder="Enter chapter count"
                    min="1"
                  />

                  {/* Sticky save button for mobile */}
                  <div className={cn(
                    "pt-4",
                    isMobile && "fixed bottom-20 left-0 right-0 p-4 bg-background border-t z-40 -mx-4"
                  )}>
                    <Button
                      type="submit"
                      className="w-full min-h-[44px] bg-gradient-primary hover:shadow-glow transition-all duration-300 text-white font-medium"
                      disabled={loading}
                    >
                      {loading ? "Adding Book..." : "Save Book"}
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
};

export default AddBook;
