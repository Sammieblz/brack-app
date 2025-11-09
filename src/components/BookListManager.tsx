import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBookLists } from "@/hooks/useBookLists";
import { useToast } from "@/hooks/use-toast";
import { Plus, BookMarked, Trash2, Edit2, Copy, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BookListCardSkeleton } from "./skeletons/BookListCardSkeleton";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

interface BookListManagerProps {
  userId: string;
}

export const BookListManager = ({ userId }: BookListManagerProps) => {
  const navigate = useNavigate();
  const { lists, loading, loadingMore, hasMore, loadMore, createList, updateList, deleteList, duplicateList } = useBookLists(userId);
  const { toast } = useToast();
  const { triggerHaptic } = useHapticFeedback();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingList, setEditingList] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");

  const loadMoreRef = useInfiniteScroll({
    hasMore,
    loading: loadingMore,
    onLoadMore: loadMore,
  });

  const handleCreate = async () => {
    if (!newListName.trim()) {
      triggerHaptic('error');
      toast({
        variant: "destructive",
        title: "Name required",
        description: "Please enter a name for your list",
      });
      return;
    }

    const result = await createList(newListName, newListDescription);
    if (result) {
      triggerHaptic('success');
      toast({
        title: "List created",
        description: `"${newListName}" has been created successfully`,
      });
      setIsCreateOpen(false);
      setNewListName("");
      setNewListDescription("");
    }
  };

  const handleDelete = async (listId: string, listName: string) => {
    triggerHaptic('medium');
    await deleteList(listId);
    triggerHaptic('success');
    toast({
      title: "List deleted",
      description: `"${listName}" has been deleted`,
    });
  };

  const handleUpdate = async (listId: string) => {
    if (!newListName.trim()) return;
    
    await updateList(listId, { name: newListName, description: newListDescription });
    triggerHaptic('success');
    toast({
      title: "List updated",
      description: "Your list has been updated successfully",
    });
    setEditingList(null);
    setNewListName("");
    setNewListDescription("");
  };

  const handleDuplicate = async (listId: string, listName: string) => {
    const newList = await duplicateList(listId);
    if (newList) {
      triggerHaptic('success');
      toast({
        title: "List duplicated",
        description: `"${listName}" has been copied to "${newList.name}"`,
      });
    } else {
      triggerHaptic('error');
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to duplicate the list",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">My Book Lists</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <BookListCardSkeleton />
          <BookListCardSkeleton />
          <BookListCardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <h2 className="text-xl sm:text-2xl font-bold">My Book Lists</h2>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="h-11 w-full sm:w-auto touch-manipulation">
              <Plus className="mr-2 h-4 w-4" />
              Create List
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New List</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="list-name">List Name</Label>
                <Input
                  id="list-name"
                  placeholder="e.g., Summer Reading, Favorites"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="list-description">Description (Optional)</Label>
                <Textarea
                  id="list-description"
                  placeholder="What's this list about?"
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                />
              </div>
              <Button onClick={handleCreate} className="w-full">Create List</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {lists.map((list) => (
          <Card 
            key={list.id}
            className="cursor-pointer hover:shadow-lg transition-shadow touch-manipulation"
            onClick={() => navigate(`/lists/${list.id}`)}
          >
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <BookMarked className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                  <CardTitle className="text-base sm:text-lg line-clamp-2">{list.name}</CardTitle>
                </div>
                <Badge variant="secondary" className="text-xs whitespace-nowrap">{list.book_count || 0} books</Badge>
              </div>
              {list.description && (
                <CardDescription className="text-xs sm:text-sm line-clamp-2">{list.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
              <div className="flex flex-col sm:flex-row gap-2" onClick={(e) => e.stopPropagation()}>
                <Dialog open={editingList === list.id} onOpenChange={(open) => {
                  if (!open) {
                    setEditingList(null);
                    setNewListName("");
                    setNewListDescription("");
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-10 touch-manipulation"
                      onClick={() => {
                        setEditingList(list.id);
                        setNewListName(list.name);
                        setNewListDescription(list.description || "");
                      }}
                    >
                      <Edit2 className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="text-xs sm:text-sm">Edit</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit List</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-list-name">List Name</Label>
                        <Input
                          id="edit-list-name"
                          value={newListName}
                          onChange={(e) => setNewListName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-list-description">Description</Label>
                        <Textarea
                          id="edit-list-description"
                          value={newListDescription}
                          onChange={(e) => setNewListDescription(e.target.value)}
                        />
                      </div>
                      <Button onClick={() => handleUpdate(list.id)} className="w-full">
                        Save Changes
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 px-3 sm:px-4 touch-manipulation"
                  onClick={() => handleDuplicate(list.id, list.name)}
                  title="Duplicate list"
                >
                  <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="ml-2 text-xs sm:text-sm hidden sm:inline">Copy</span>
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-10 px-3 touch-manipulation">
                      <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete List</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{list.name}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(list.id, list.name)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {hasMore && lists.length > 0 && (
        <div ref={loadMoreRef} className="py-8 flex justify-center">
          {loadingMore && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading more lists...</span>
            </div>
          )}
        </div>
      )}

      {lists.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12 px-4">
            <BookMarked className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
            <p className="text-sm sm:text-base text-muted-foreground text-center mb-4">
              You haven't created any lists yet
            </p>
            <Button 
              onClick={() => setIsCreateOpen(true)}
              className="h-11 touch-manipulation"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Your First List
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
