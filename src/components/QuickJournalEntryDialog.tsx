import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Quote, FileText } from "lucide-react";
import { useJournalEntries } from "@/hooks/useJournalEntries";
import { useToast } from "@/hooks/use-toast";

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
  const { addEntry } = useJournalEntries(bookId);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

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
      });

      toast({
        title: "Journal entry saved!",
        description: "Your entry has been added successfully.",
      });

      // Reset form
      setTitle("");
      setContent("");
      setPageReference("");
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
