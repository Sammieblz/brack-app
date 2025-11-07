import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save } from "lucide-react";
import type { Book } from "@/types";

export default function EditBook() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [book, setBook] = useState<Book | null>(null);

  useEffect(() => {
    loadBook();
  }, [id]);

  const loadBook = async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setBook(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      navigate('/my-books');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!book) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('books')
        .update({
          title: book.title,
          author: book.author,
          genre: book.genre,
          isbn: book.isbn,
          pages: book.pages,
          current_page: book.current_page,
          status: book.status,
          rating: book.rating,
          notes: book.notes,
          cover_url: book.cover_url,
          tags: book.tags,
          date_started: book.date_started,
          date_finished: book.date_finished,
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Book updated successfully",
      });
      navigate(`/book/${id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <LoadingSpinner />
      </div>
    );
  }

  if (!book) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Button
          variant="ghost"
          onClick={() => navigate(`/book/${id}`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Book
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Edit Book</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={book.title}
                  onChange={(e) => setBook({ ...book, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="author">Author</Label>
                <Input
                  id="author"
                  value={book.author || ''}
                  onChange={(e) => setBook({ ...book, author: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="genre">Genre</Label>
                  <Input
                    id="genre"
                    value={book.genre || ''}
                    onChange={(e) => setBook({ ...book, genre: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="isbn">ISBN</Label>
                  <Input
                    id="isbn"
                    value={book.isbn || ''}
                    onChange={(e) => setBook({ ...book, isbn: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pages">Total Pages</Label>
                  <Input
                    id="pages"
                    type="number"
                    value={book.pages || ''}
                    onChange={(e) => setBook({ ...book, pages: parseInt(e.target.value) || null })}
                  />
                </div>

                <div>
                  <Label htmlFor="current_page">Current Page</Label>
                  <Input
                    id="current_page"
                    type="number"
                    value={book.current_page || 0}
                    onChange={(e) => setBook({ ...book, current_page: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={book.status}
                  onValueChange={(value) => setBook({ ...book, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reading">Currently Reading</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="to_read">Want to Read</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="rating">Rating (1-5)</Label>
                <Select
                  value={book.rating?.toString() || ''}
                  onValueChange={(value) => setBook({ ...book, rating: value ? parseInt(value) : null })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No rating</SelectItem>
                    <SelectItem value="1">⭐ 1 Star</SelectItem>
                    <SelectItem value="2">⭐⭐ 2 Stars</SelectItem>
                    <SelectItem value="3">⭐⭐⭐ 3 Stars</SelectItem>
                    <SelectItem value="4">⭐⭐⭐⭐ 4 Stars</SelectItem>
                    <SelectItem value="5">⭐⭐⭐⭐⭐ 5 Stars</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date_started">Date Started</Label>
                  <Input
                    id="date_started"
                    type="date"
                    value={book.date_started || ''}
                    onChange={(e) => setBook({ ...book, date_started: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="date_finished">Date Finished</Label>
                  <Input
                    id="date_finished"
                    type="date"
                    value={book.date_finished || ''}
                    onChange={(e) => setBook({ ...book, date_finished: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="cover_url">Cover Image URL</Label>
                <Input
                  id="cover_url"
                  value={book.cover_url || ''}
                  onChange={(e) => setBook({ ...book, cover_url: e.target.value })}
                  placeholder="https://example.com/book-cover.jpg"
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={book.notes || ''}
                  onChange={(e) => setBook({ ...book, notes: e.target.value })}
                  rows={6}
                  placeholder="Add your thoughts, quotes, or annotations..."
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={saving} className="flex-1">
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/book/${id}`)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
