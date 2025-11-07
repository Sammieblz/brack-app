import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { updateBookStatusIfNeeded } from "@/utils/bookStatus";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

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
  const [loading, setLoading] = useState(false);

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
