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
import type { Json } from "@/integrations/supabase/types";
import { Book as BookIcon, Camera, Search, EditPencil, Refresh } from "iconoir-react";
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
import { SuccessCheckmark } from "@/components/animations/SuccessCheckmark";
import { Confetti } from "@/components/animations/Confetti";

const AddBook = () => {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("search");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showSuccess, setShowSuccess] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isFirstBook, setIsFirstBook] = useState(false);
  
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
        metadata: null,
        current_page: 0,
        date_started: null,
        date_finished: null,
        rating: null,
        notes: null
      };

      await bookOperations.create(bookData);

      // Check if this is the first book
      const { data: existingBooks } = await supabase
        .from('books')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('deleted_at', null);
      
      const firstBook = (existingBooks?.length || 0) <= 1;
      setIsFirstBook(firstBook);

      // Show success animation
      setShowSuccess(true);
      if (firstBook) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }

      setTimeout(() => {
        setShowSuccess(false);
        navigate("/dashboard");
      }, 1500);
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
      metadata: null,
      current_page: 0,
      date_started: null,
      date_finished: null,
      rating: null,
      notes: null
    };

    const { error } = await supabase
      .from('books')
      .insert({
        ...bookData,
        metadata: bookData.metadata as Json | null
      });

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
      {showConfetti && <Confetti trigger={showConfetti} />}
      {showSuccess && (
        <div className="fixed inset-0 z-[9999] bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center space-y-4">
            <SuccessCheckmark show={showSuccess} size={64} />
            <p className="font-sans text-xl font-semibold">
              {isFirstBook ? "Your first book! 🎉" : "Book added successfully!"}
            </p>
          </div>
        </div>
      )}
      {isMobile && <MobileHeader title="Add Book" showBack />}
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-md">

        {/* Form Card */}
        <Card className="bg-gradient-card shadow-medium border-0 animate-scale-in">
          <CardHeader className="text-center pb-4">
            <CardTitle className="font-display text-xl font-bold text-foreground flex items-center justify-center gap-2">
              <BookIcon className="h-5 w-5" />
              Add a New Book
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-2 mb-6">
                <TabsTrigger value="search" className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  <span>Search</span>
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex items-center gap-2">
                  <EditPencil className="h-4 w-4" />
                  <span>Manual</span>
                </TabsTrigger>
              </TabsList>

              {/* Search Tab */}
              <TabsContent value="search" className="space-y-4 mt-0">
                <BookSearch 
                  onSelectBook={handleSelectBook}
                  onQuickAdd={handleQuickAdd}
                  initialQuery={searchFromUrl}
                />
              </TabsContent>

              {/* Manual Entry Tab */}
              <TabsContent value="manual" className="mt-0">
                <form id="add-book-form" onSubmit={handleSubmit} className="space-y-5">
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
                    <Label htmlFor="isbn" className="text-sm font-medium">ISBN</Label>
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
                        className="border-border/50 hover:shadow-soft transition-all duration-300 px-3 min-h-[44px] min-w-[44px]"
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="genre" className="text-sm font-medium">Genre</Label>
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
                    <div className="flex flex-wrap gap-2 mt-3">
                      {GENRES.slice(0, 6).map((genre) => (
                        <Button
                          key={genre}
                          type="button"
                          variant={formData.genre === genre ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFormData({ ...formData, genre })}
                          className={cn(
                            "text-xs min-h-[36px] px-3",
                            formData.genre === genre && "bg-primary text-primary-foreground"
                          )}
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

                  {/* Spacer for fixed button */}
                  <div className="h-24 md:h-4" />
                </form>

                {/* Fixed Save Button - Properly positioned above bottom nav */}
                <div className={cn(
                  "fixed left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border/50",
                  isMobile 
                    ? "bottom-[calc(max(env(safe-area-inset-bottom),24px)+72px+16px)] px-4 py-3"
                    : "relative bottom-0 px-0 py-4 border-t-0 bg-transparent"
                )}>
                  <Button
                    type="submit"
                    form="add-book-form"
                    className="w-full min-h-[48px] bg-gradient-primary hover:shadow-glow transition-all duration-300 text-white font-semibold text-base rounded-xl"
                    disabled={loading || !formData.title.trim()}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <Refresh className="h-4 w-4 animate-spin" />
                        Adding Book...
                      </span>
                    ) : (
                      "Save Book"
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
};

export default AddBook;
