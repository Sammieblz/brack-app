import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Quote, FileText, Camera, X, Image as ImageIcon } from "lucide-react";
import { useJournalEntries } from "@/hooks/useJournalEntries";
import { useToast } from "@/hooks/use-toast";
import { ImagePickerDialog } from "@/components/ImagePickerDialog";
import { useImagePicker } from "@/hooks/useImagePicker";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface QuickJournalEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  bookTitle: string;
  readingTimeMinutes?: number;
}

export const QuickJournalEntryDialog = ({
  open,
  onOpenChange,
  bookId,
  bookTitle,
  readingTimeMinutes,
}: QuickJournalEntryDialogProps) => {
  const [entryType, setEntryType] = useState<'note' | 'quote' | 'reflection'>('note');
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pageReference, setPageReference] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const { addEntry } = useJournalEntries(bookId);
  const { toast } = useToast();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

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
      const fileName = `journal-${Date.now()}.${image.format}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('journal-photos')
        .upload(filePath, blob, {
          contentType: `image/${image.format}`,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('journal-photos')
        .getPublicUrl(filePath);

      setPhotoUrl(urlData.publicUrl);
      setPhotoPreview(image.dataUrl);
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload photo",
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUrl(null);
    setPhotoPreview(null);
  };

  const handleSave = async () => {
    if (!content.trim()) {
      toast({
        variant: "destructive",
        title: "Content required",
        description: "Please enter some content for your journal entry.",
      });
      return;
    }

    setSaving(true);
    try {
      await addEntry({
        entry_type: entryType,
        title: title.trim() || undefined,
        content: content.trim(),
        page_reference: pageReference ? parseInt(pageReference) : undefined,
        photo_url: photoUrl || undefined,
      });

      toast({
        title: "Journal entry saved!",
        description: "Your entry has been added successfully.",
      });

      // Reset form
      setTitle("");
      setContent("");
      setPageReference("");
      setPhotoUrl(null);
      setPhotoPreview(null);
      setEntryType('note');
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving journal entry:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Journal Entry</DialogTitle>
          <DialogDescription>
            Save your thoughts about "{bookTitle}"
            {readingTimeMinutes && ` (${Math.round(readingTimeMinutes)} min read)`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Entry Type Selection */}
          <div>
            <Label className="mb-2 block">Entry Type</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={entryType === 'note' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEntryType('note')}
                className="flex flex-col h-auto py-3"
              >
                <FileText className="h-4 w-4 mb-1" />
                <span className="text-xs">Note</span>
              </Button>
              <Button
                type="button"
                variant={entryType === 'quote' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEntryType('quote')}
                className="flex flex-col h-auto py-3"
              >
                <Quote className="h-4 w-4 mb-1" />
                <span className="text-xs">Quote</span>
              </Button>
              <Button
                type="button"
                variant={entryType === 'reflection' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEntryType('reflection')}
                className="flex flex-col h-auto py-3"
              >
                <BookOpen className="h-4 w-4 mb-1" />
                <span className="text-xs">Reflection</span>
              </Button>
            </div>
          </div>

          {/* Title (optional) */}
          <div>
            <Label htmlFor="title">Title (optional)</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={entryType === 'quote' ? 'Quote source or context' : 'Entry title'}
            />
          </div>

          {/* Content */}
          <div>
            <Label htmlFor="content">
              {entryType === 'quote' ? 'Quote' : entryType === 'reflection' ? 'Reflection' : 'Note'} *
            </Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                entryType === 'quote'
                  ? 'Paste your favorite quote here...'
                  : entryType === 'reflection'
                  ? 'What did you think about this reading session?'
                  : 'Write your notes here...'
              }
              rows={5}
              className="resize-none"
            />
          </div>

          {/* Page Reference */}
          <div>
            <Label htmlFor="page">Page Reference (optional)</Label>
            <Input
              id="page"
              type="number"
              value={pageReference}
              onChange={(e) => setPageReference(e.target.value)}
              placeholder="Page number"
              min="1"
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
              title="Add Photo to Journal Entry"
              description="Take a photo or select from your library"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Skip
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || !content.trim()}
            >
              {saving ? "Saving..." : "Save Entry"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
