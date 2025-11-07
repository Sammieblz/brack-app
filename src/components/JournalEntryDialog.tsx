import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JournalEntry } from "@/hooks/useJournalEntries";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

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

  useEffect(() => {
    if (editEntry) {
      setEntryType(editEntry.entry_type);
      setTitle(editEntry.title || '');
      setContent(editEntry.content);
      setPageReference(editEntry.page_reference?.toString() || '');
      setTags(editEntry.tags || []);
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
            <Select value={entryType} onValueChange={(value: any) => setEntryType(value)}>
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
