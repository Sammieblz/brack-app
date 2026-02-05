import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BookOpen } from "lucide-react";
import type { Book } from "@/types";

interface QuickProgressWidgetProps {
  book: Book;
  onUpdate: () => void;
}

export const QuickProgressWidget = ({ book, onUpdate }: QuickProgressWidgetProps) => {
  const [currentPage, setCurrentPage] = useState(book.current_page?.toString() || "0");
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      const pageNum = parseInt(currentPage) || 0;
      const updates: Record<string, unknown> = { current_page: pageNum };
      
      // Auto-mark as completed if reached last page
      if (book.pages && pageNum >= book.pages && book.status !== 'completed') {
        updates.status = 'completed';
        updates.date_finished = new Date().toISOString().split('T')[0];
      }
      
      // Auto-set date_started if not set
      if (!book.date_started && pageNum > 0) {
        updates.date_started = new Date().toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from('books')
        .update(updates)
        .eq('id', book.id);

      if (error) throw error;

      toast({
        title: "Progress updated",
        description: `You're now on page ${pageNum}`,
      });
      
      onUpdate();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update progress",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Card className="bg-gradient-card">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Quick Progress Update
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <Label htmlFor="quick-page">Current Page</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="quick-page"
                type="number"
                value={currentPage}
                onChange={(e) => setCurrentPage(e.target.value)}
                min="0"
                max={book.pages || undefined}
                className="flex-1"
              />
              <Button onClick={handleUpdate} disabled={updating}>
                {updating ? 'Updating...' : 'Update'}
              </Button>
            </div>
          </div>
          {book.pages && (
            <p className="text-sm text-muted-foreground">
              {Math.round((parseInt(currentPage) / book.pages) * 100)}% complete
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
