import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useBookLists } from "@/hooks/useBookLists";
import { useToast } from "@/hooks/use-toast";
import { ListPlus } from "lucide-react";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

interface AddToListDialogProps {
  bookId: string;
  userId: string;
  trigger?: React.ReactNode;
}

export const AddToListDialog = ({ bookId, userId, trigger }: AddToListDialogProps) => {
  const { lists, addBookToList, removeBookFromList } = useBookLists(userId);
  const { toast } = useToast();
  const { triggerHaptic } = useHapticFeedback();
  const [open, setOpen] = useState(false);
  const [bookLists, setBookLists] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const loadBookLists = async () => {
    setLoading(true);
    try {
      const { data } = await import("@/integrations/supabase/client").then(m => m.supabase
        .from('book_list_items')
        .select('list_id')
        .eq('book_id', bookId)
      );
      
      if (data) {
        setBookLists(new Set(data.map(item => item.list_id)));
      }
    } catch (error) {
      console.error('Error loading book lists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      loadBookLists();
    }
  };

  const toggleList = async (listId: string, isChecked: boolean) => {
    try {
      if (isChecked) {
        await addBookToList(listId, bookId);
        setBookLists(prev => new Set(prev).add(listId));
        triggerHaptic('success');
        toast({
          title: "Added to list",
          description: "Book has been added to the list",
        });
      } else {
        await removeBookFromList(listId, bookId);
        setBookLists(prev => {
          const newSet = new Set(prev);
          newSet.delete(listId);
          return newSet;
        });
        triggerHaptic('medium');
        toast({
          title: "Removed from list",
          description: "Book has been removed from the list",
        });
      }
    } catch (error: unknown) {
      triggerHaptic('error');
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update list",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <ListPlus className="h-4 w-4 mr-2" />
            Add to List
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to Lists</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading lists...</p>
          ) : lists.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-4">
                You haven't created any lists yet
              </p>
              <Button onClick={() => {
                setOpen(false);
                window.location.href = '/lists';
              }}>
                Create a List
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {lists.map((list) => (
                <div key={list.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={list.id}
                    checked={bookLists.has(list.id)}
                    onCheckedChange={(checked) => toggleList(list.id, checked as boolean)}
                  />
                  <label
                    htmlFor={list.id}
                    className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    <div>
                      <p>{list.name}</p>
                      {list.description && (
                        <p className="text-xs text-muted-foreground mt-1">{list.description}</p>
                      )}
                    </div>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
