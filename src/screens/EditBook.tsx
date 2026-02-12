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
import { useAuth } from "@/hooks/useAuth";
import { TagManager } from "@/components/TagManager";
import { Save, Upload, Camera, ArrowLeft } from "lucide-react";
import { MobileBackButton } from "@/components/mobile/MobileBackButton";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileInput } from "@/components/mobile/MobileInput";
import { MobileTextarea } from "@/components/mobile/MobileTextarea";
import { cn } from "@/lib/utils";
import { ImagePickerDialog } from "@/components/ImagePickerDialog";
import { useImagePicker } from "@/hooks/useImagePicker";
import { bookOperations } from "@/utils/offlineOperation";
import { validateBookForm, type ValidationError } from "@/utils/formValidation";
import type { Book } from "@/types";

export default function EditBook() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [book, setBook] = useState<Book | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { pickWithPrompt } = useImagePicker();

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
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load book",
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

    // Validate form
    const validationErrors = validateBookForm(book);
    if (validationErrors.length > 0) {
      const errorMap: Record<string, string> = {};
      validationErrors.forEach(err => {
        errorMap[err.field] = err.message;
      });
      setErrors(errorMap);
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fix the errors in the form",
      });
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      await bookOperations.update(id, {
        title: book.title,
        author: book.author,
        genre: book.genre,
        isbn: book.isbn,
        pages: book.pages,
        chapters: book.chapters,
        current_page: book.current_page,
        status: book.status,
        rating: book.rating,
        notes: book.notes,
        cover_url: book.cover_url,
        tags: book.tags,
        date_started: book.date_started,
        date_finished: book.date_finished,
      });

      toast({
        title: "Success",
        description: "Book updated successfully",
      });
      navigate(`/book/${id}`);
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load book",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const uploadImageToStorage = async (imageData: { dataUrl: string; format: string; base64?: string }) => {
    if (!user || !imageData.base64) return;

    setUploading(true);
    try {
      // Convert base64 to blob
      const byteCharacters = atob(imageData.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: `image/${imageData.format}` });

      // Upload to storage
      const fileName = `${user.id}/${Date.now()}.${imageData.format}`;
      const { error: uploadError } = await supabase.storage
        .from('book-covers')
        .upload(fileName, blob, {
          contentType: `image/${imageData.format}`,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('book-covers')
        .getPublicUrl(fileName);

      setBook({ ...book!, cover_url: publicUrl });
      
      toast({
        title: "Success",
        description: "Cover image uploaded successfully",
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleImagePicked = async (image: { dataUrl: string; format: string; base64?: string }) => {
    await uploadImageToStorage(image);
  };

  const handleNativeImagePick = async () => {
    const image = await pickWithPrompt();
    if (image) {
      await uploadImageToStorage(image);
    }
  };

  const isMobile = useIsMobile();

  if (loading) {
    return (
      <MobileLayout>
        {isMobile && <MobileHeader title="Edit Book" showBack />}
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner size="lg" text="Loading book..." />
        </div>
      </MobileLayout>
    );
  }

  if (!book) return null;

  return (
    <MobileLayout>
      {isMobile && <MobileHeader title="Edit Book" showBack />}
      {!isMobile && <Navbar />}
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-2xl pb-24 md:pb-8">
        {!isMobile && (
          <Button
            variant="ghost"
            onClick={() => navigate(`/book/${id}`)}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Book
          </Button>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Edit Book</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <MobileInput
                id="title"
                label="Title *"
                value={book.title}
                onChange={(e) => {
                  setBook({ ...book, title: e.target.value });
                  if (errors.title) setErrors(prev => ({ ...prev, title: '' }));
                }}
                error={errors.title}
                required
              />

              <MobileInput
                id="author"
                label="Author"
                value={book.author || ''}
                onChange={(e) => setBook({ ...book, author: e.target.value })}
              />

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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MobileInput
                  id="pages"
                  label="Total Pages"
                  type="number"
                  inputMode="numeric"
                  value={book.pages || ''}
                  onChange={(e) => {
                    setBook({ ...book, pages: parseInt(e.target.value) || null });
                    if (errors.pages) setErrors(prev => ({ ...prev, pages: '' }));
                  }}
                  error={errors.pages}
                />

                <MobileInput
                  id="chapters"
                  label="Total Chapters"
                  type="number"
                  inputMode="numeric"
                  value={book.chapters || ''}
                  onChange={(e) => setBook({ ...book, chapters: parseInt(e.target.value) || null })}
                />
              </div>

              <MobileInput
                id="current_page"
                label="Current Page"
                type="number"
                inputMode="numeric"
                value={book.current_page || 0}
                onChange={(e) => {
                  setBook({ ...book, current_page: parseInt(e.target.value) || 0 });
                  if (errors.current_page) setErrors(prev => ({ ...prev, current_page: '' }));
                }}
                error={errors.current_page}
              />

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
                    <SelectItem value="1">★ 1 Star</SelectItem>
                    <SelectItem value="2">★★ 2 Stars</SelectItem>
                    <SelectItem value="3">★★★ 3 Stars</SelectItem>
                    <SelectItem value="4">★★★★ 4 Stars</SelectItem>
                    <SelectItem value="5">★★★★★ 5 Stars</SelectItem>
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
                <Label>Cover Image</Label>
                <div className="space-y-3">
                  {book.cover_url && (
                    <img 
                      src={book.cover_url} 
                      alt="Book cover" 
                      className="w-32 h-40 object-cover rounded border"
                    />
                  )}
                  <div className="flex gap-2">
                    <Input
                      id="cover_url"
                      value={book.cover_url || ''}
                      onChange={(e) => setBook({ ...book, cover_url: e.target.value })}
                      placeholder="Or paste image URL..."
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowImagePicker(true)}
                      disabled={uploading}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      {uploading ? 'Uploading...' : 'Choose Image'}
                    </Button>
                    <ImagePickerDialog
                      open={showImagePicker}
                      onOpenChange={setShowImagePicker}
                      onImagePicked={handleImagePicked}
                      title="Choose Cover Image"
                      description="Take a photo or select from your library"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="tags">Tags</Label>
                <TagManager 
                  tags={book.tags || []}
                  onChange={(newTags) => setBook({ ...book, tags: newTags })}
                />
              </div>

              <MobileTextarea
                id="notes"
                label="Notes"
                value={book.notes || ''}
                onChange={(e) => setBook({ ...book, notes: e.target.value })}
                rows={6}
                placeholder="Add your thoughts, quotes, or annotations..."
              />

              {/* Sticky save button for mobile */}
              <div className={cn(
                "flex gap-2 pt-4",
                isMobile && "fixed bottom-20 left-0 right-0 p-4 bg-background border-t z-40"
              )}>
                <Button type="submit" disabled={saving} className="flex-1 min-h-[44px]">
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                {!isMobile && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/book/${id}`)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
}
