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
import { ArrowLeft, BookOpen, Camera, Search, PenTool } from "lucide-react";
import { toast } from "sonner";
import { GENRES } from "@/constants";
import type { Book } from "@/types";
import type { GoogleBookResult } from "@/types/googleBooks";

const AddBook = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("search");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Get ISBN from URL params if present
  const isbnFromUrl = searchParams.get('isbn') || '';
  
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

      const { error } = await supabase
        .from('books')
        .insert(bookData);

      if (error) throw error;

      toast.success("Book added successfully!");
      navigate("/dashboard");
    } catch (error: any) {
      console.error('Error adding book:', error);
      toast.error(error.message || "Failed to add book");
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

  return (
    <div className="min-h-screen bg-gradient-background flex items-center justify-center p-4">
      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="border-border/50 hover:shadow-soft transition-all duration-300"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center space-x-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">Add Book</span>
          </div>
        </div>

        {/* Form Card */}
        <Card className="bg-gradient-card shadow-medium border-0 animate-scale-in">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-bold text-foreground">
              Add a New Book
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="search" className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Search Books
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex items-center gap-2">
                  <PenTool className="h-4 w-4" />
                  Manual Entry
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
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Enter book title"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="author">Author</Label>
                    <Input
                      id="author"
                      value={formData.author}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      placeholder="Enter author name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="isbn">ISBN</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="isbn"
                        value={formData.isbn}
                        onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                        placeholder="Enter ISBN"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleScanISBN}
                        className="border-border/50 hover:shadow-soft transition-all duration-300 px-3"
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="genre">Genre</Label>
                    <Select value={formData.genre} onValueChange={(value) => setFormData({ ...formData, genre: value })}>
                      <SelectTrigger>
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
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pages">Page Count</Label>
                    <Input
                      id="pages"
                      type="number"
                      value={formData.pages}
                      onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                      placeholder="Enter page count"
                      min="1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="chapters">Chapter Count</Label>
                    <Input
                      id="chapters"
                      type="number"
                      value={formData.chapters}
                      onChange={(e) => setFormData({ ...formData, chapters: e.target.value })}
                      placeholder="Enter chapter count"
                      min="1"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-gradient-primary hover:shadow-glow transition-all duration-300 text-white font-medium"
                    disabled={loading}
                  >
                    {loading ? "Adding Book..." : "Save Book"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AddBook;
