import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useBooks } from "@/hooks/useBooks";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "iconoir-react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AddBooksToListDialogProps {
  listId: string;
  userId: string;
  onBooksAdded?: () => void;
}

export const AddBooksToListDialog = ({ listId, userId, onBooksAdded }: AddBooksToListDialogProps) => {
  const { books } = useBooks(userId);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
  const [existingBooks, setExistingBooks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadExistingBooks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, listId]);

  const loadExistingBooks = async () => {
    try {
      const { data } = await supabase
        .from('book_list_items')
        .select('book_id')
        .eq('list_id', listId);
      
      if (data) {
        setExistingBooks(new Set(data.map(item => item.book_id)));
      }
    } catch (error) {
      console.error('Error loading existing books:', error);
    }
  };

  const handleAddBooks = async () => {
    if (selectedBooks.size === 0) return;

    setLoading(true);
    try {
      // Get current max position
      const { data: items } = await supabase
        .from('book_list_items')
        .select('position')
        .eq('list_id', listId)
        .order('position', { ascending: false })
        .limit(1);
      
      let position = items?.[0]?.position || 0;

      // Add all selected books
      const insertData = Array.from(selectedBooks).map(bookId => ({
        list_id: listId,
        book_id: bookId,
        position: ++position
      }));

      const { error } = await supabase
        .from('book_list_items')
        .insert(insertData);

      if (error) throw error;

      toast({
        title: "Books added",
        description: `${selectedBooks.size} book(s) added to the list`,
      });

      setSelectedBooks(new Set());
      setOpen(false);
      onBooksAdded?.();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add books",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleBook = (bookId: string) => {
    setSelectedBooks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookId)) {
        newSet.delete(bookId);
      } else {
        newSet.add(bookId);
      }
      return newSet;
    });
  };

  const availableBooks = books.filter(book => !existingBooks.has(book.id));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Books
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Add Books to List</DialogTitle>
        </DialogHeader>
        
        {availableBooks.length === 0 ? (
          <p className="font-sans text-sm text-muted-foreground text-center py-6">
            All your books are already in this list
          </p>
        ) : (
          <>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {availableBooks.map((book) => (
                  <div key={book.id} className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                    <Checkbox
                      id={book.id}
                      checked={selectedBooks.has(book.id)}
                      onCheckedChange={() => toggleBook(book.id)}
                    />
                    <label
                      htmlFor={book.id}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="flex items-start space-x-3">
                        {book.cover_url && (
                          <img
                            src={book.cover_url}
                            alt={book.title}
                            className="w-12 h-16 object-cover rounded"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-serif font-medium">{book.title}</p>
                          {book.author && (
                            <p className="font-serif text-sm text-muted-foreground">{book.author}</p>
                          )}
                          {book.genre && (
                            <p className="font-sans text-xs text-muted-foreground mt-1">{book.genre}</p>
                          )}
                        </div>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="flex justify-between items-center pt-4 border-t">
              <p className="font-sans text-sm text-muted-foreground">
                {selectedBooks.size} book(s) selected
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddBooks} 
                  disabled={selectedBooks.size === 0 || loading}
                >
                  Add {selectedBooks.size > 0 && `(${selectedBooks.size})`}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
