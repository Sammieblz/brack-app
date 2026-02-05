import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JournalEntry } from "@/hooks/useJournalEntries";
import { Badge } from "@/components/ui/badge";
import { X, Camera, Image as ImageIcon } from "lucide-react";
import { ImagePickerDialog } from "@/components/ImagePickerDialog";
import { useImagePicker } from "@/hooks/useImagePicker";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface JournalEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (entry: Omit<JournalEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => void;
  editEntry?: JournalEntry | null;
  bookId: string;
}

export const JournalEntryDialog = ({
  open,
  onOpenChange,
  onSave,
  editEntry,
  bookId,
}: JournalEntryDialogProps) => {
  const [entryType, setEntryType] = useState<'note' | 'quote' | 'reflection'>('note');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pageReference, setPageReference] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (editEntry) {
      setEntryType(editEntry.entry_type);
      setTitle(editEntry.title || '');
      setContent(editEntry.content);
      setPageReference(editEntry.page_reference?.toString() || '');
      setTags(editEntry.tags || []);
      setPhotoUrl(editEntry.photo_url || null);
      setPhotoPreview(editEntry.photo_url || null);
    } else {
      resetForm();
    }
  }, [editEntry, open]);

  const resetForm = () => {
    setEntryType('note');
    setTitle('');
    setContent('');
    setPageReference('');
    setTags([]);
    setTagInput('');
    setPhotoUrl(null);
    setPhotoPreview(null);
  };

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

      // Delete old photo if editing
      if (editEntry?.photo_url) {
        const oldPath = editEntry.photo_url.split('/').slice(-2).join('/');
        await supabase.storage.from('journal-photos').remove([oldPath]);
      }

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

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSave = () => {
    if (!content.trim()) return;

    onSave({
      book_id: bookId,
      entry_type: entryType,
      title: title.trim() || undefined,
      content: content.trim(),
      page_reference: pageReference ? parseInt(pageReference) : undefined,
      tags: tags.length > 0 ? tags : undefined,
      photo_url: photoUrl || undefined,
    });

    onOpenChange(false);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editEntry ? 'Edit' : 'Add'} Journal Entry</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="entry-type">Entry Type</Label>
            <Select value={entryType} onValueChange={(value: string) => setEntryType(value)}>
              <SelectTrigger id="entry-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="note">Note</SelectItem>
                <SelectItem value="quote">Quote</SelectItem>
                <SelectItem value="reflection">Reflection</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title (Optional)</Label>
            <Input
              id="title"
              placeholder="Give your entry a title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              placeholder={
                entryType === 'quote'
                  ? 'Enter the quote...'
                  : entryType === 'reflection'
                  ? 'Share your thoughts and reflections...'
                  : 'Write your notes...'
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[200px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="page-reference">Page Reference (Optional)</Label>
            <Input
              id="page-reference"
              type="number"
              placeholder="Enter page number..."
              value={pageReference}
              onChange={(e) => setPageReference(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (Optional)</Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                placeholder="Add a tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <Button type="button" onClick={handleAddTag} variant="outline">
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => handleRemoveTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Photo Attachment */}
          <div className="space-y-2">
            <Label>Photo (Optional)</Label>
            {photoPreview ? (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-full h-64 object-cover rounded-lg border"
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
                className="w-full"
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!content.trim()}>
            {editEntry ? 'Update' : 'Add'} Entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
