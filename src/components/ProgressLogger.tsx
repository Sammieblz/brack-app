import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { updateBookStatusIfNeeded } from "@/utils/bookStatus";
import { toast } from "@/hooks/use-toast";
import { Loader2, Camera, X } from "lucide-react";
import { ImagePickerDialog } from "@/components/ImagePickerDialog";
import { useImagePicker } from "@/hooks/useImagePicker";
import { useAuth } from "@/hooks/useAuth";

interface ProgressLoggerProps {
  bookId: string;
  bookTitle: string;
  currentPage?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const ProgressLogger = ({ 
  bookId, 
  bookTitle, 
  currentPage = 0,
  open, 
  onOpenChange,
  onSuccess 
}: ProgressLoggerProps) => {
  const [pageNumber, setPageNumber] = useState(currentPage || 0);
  const [chapterNumber, setChapterNumber] = useState<number | undefined>();
  const [paragraphNumber, setParagraphNumber] = useState<number | undefined>();
  const [timeSpent, setTimeSpent] = useState<number | undefined>();
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleImagePicked = async (image: { dataUrl: string; format: string; base64?: string }) => {
    if (!user || !image.base64) return;

    setUploadingPhoto(true);
    try {
      // Convert base64 to blob
      const byteCharacters = atob(image.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: `image/${image.format}` });

      // Upload to storage
      const fileName = `progress-${Date.now()}.${image.format}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('progress-photos')
        .upload(filePath, blob, {
          contentType: `image/${image.format}`,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('progress-photos')
        .getPublicUrl(filePath);

      setPhotoUrl(urlData.publicUrl);
      setPhotoPreview(image.dataUrl);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to upload photo",
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUrl(null);
    setPhotoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pageNumber || pageNumber <= 0) {
      toast({
        title: "Invalid page number",
        description: "Please enter a valid page number",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('log-progress', {
        body: {
          book_id: bookId,
          page_number: pageNumber,
          chapter_number: chapterNumber || null,
          paragraph_number: paragraphNumber || null,
          notes: notes || null,
          log_type: 'manual',
          time_spent_minutes: timeSpent || null,
          photo_url: photoUrl || null,
        },
      });

      if (error) throw error;

      toast({
        title: "Progress logged!",
        description: `Updated to page ${pageNumber}${data.progress.status === 'completed' ? ' - Book completed!' : ''}`,
      });

      // Update book status if needed
      await updateBookStatusIfNeeded(bookId);

      // Reset form
      setPageNumber(currentPage || 0);
      setChapterNumber(undefined);
      setParagraphNumber(undefined);
      setTimeSpent(undefined);
      setNotes("");
      setPhotoUrl(null);
      setPhotoPreview(null);
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error logging progress:', error);
      toast({
        title: "Failed to log progress",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Log Reading Progress</DialogTitle>
          <DialogDescription>
            Track your progress in "{bookTitle}"
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="page">Page Number *</Label>
            <Input
              id="page"
              type="number"
              min="1"
              value={pageNumber || ''}
              onChange={(e) => setPageNumber(parseInt(e.target.value))}
              placeholder="Current page"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="chapter">Chapter (optional)</Label>
            <Input
              id="chapter"
              type="number"
              min="1"
              value={chapterNumber || ''}
              onChange={(e) => setChapterNumber(e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="Chapter number"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="paragraph">Paragraph (optional)</Label>
            <Input
              id="paragraph"
              type="number"
              min="1"
              value={paragraphNumber || ''}
              onChange={(e) => setParagraphNumber(e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="Paragraph number"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Time Spent (minutes, optional)</Label>
            <Input
              id="time"
              type="number"
              min="1"
              value={timeSpent || ''}
              onChange={(e) => setTimeSpent(e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="Reading time in minutes"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any thoughts or notes..."
              rows={3}
            />
          </div>

          {/* Photo Attachment */}
          <div>
            <Label>Photo (optional)</Label>
            {photoPreview ? (
              <div className="relative mt-2">
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-lg border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={handleRemovePhoto}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowImagePicker(true)}
                disabled={uploadingPhoto}
                className="w-full mt-2"
              >
                <Camera className="h-4 w-4 mr-2" />
                {uploadingPhoto ? "Uploading..." : "Add Photo"}
              </Button>
            )}
            <ImagePickerDialog
              open={showImagePicker}
              onOpenChange={setShowImagePicker}
              onImagePicked={handleImagePicked}
              title="Add Photo to Progress Log"
              description="Take a photo or select from your library"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log Progress
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
