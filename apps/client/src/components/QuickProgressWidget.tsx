import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { Book } from "@/types";
import { updateBookQuickProgress } from "@/services/api";

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
      await updateBookQuickProgress(book, pageNum);

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
        <CardTitle className="font-display text-lg">Quick Progress Update</CardTitle>
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
            <p className="font-sans text-sm text-muted-foreground">
              {Math.round((parseInt(currentPage) / book.pages) * 100)}% complete
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
