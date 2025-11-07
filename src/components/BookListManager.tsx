import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBookLists } from "@/hooks/useBookLists";
import { useToast } from "@/hooks/use-toast";
import { Plus, BookMarked, Trash2, Edit2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface BookListManagerProps {
  userId: string;
}

export const BookListManager = ({ userId }: BookListManagerProps) => {
  const { lists, loading, createList, updateList, deleteList } = useBookLists(userId);
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingList, setEditingList] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");

  const handleCreate = async () => {
    if (!newListName.trim()) {
      toast({
        variant: "destructive",
        title: "Name required",
        description: "Please enter a name for your list",
      });
      return;
    }

    const result = await createList(newListName, newListDescription);
    if (result) {
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
    await deleteList(listId);
    toast({
      title: "List deleted",
      description: `"${listName}" has been deleted`,
    });
  };

  const handleUpdate = async (listId: string) => {
    if (!newListName.trim()) return;
    
    await updateList(listId, { name: newListName, description: newListDescription });
    toast({
      title: "List updated",
      description: "Your list has been updated successfully",
    });
    setEditingList(null);
    setNewListName("");
    setNewListDescription("");
  };

  if (loading) return <div>Loading lists...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">My Book Lists</h2>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {lists.map((list) => (
          <Card key={list.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <BookMarked className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{list.name}</CardTitle>
                </div>
                <Badge variant="secondary">{list.book_count || 0} books</Badge>
              </div>
              {list.description && (
                <CardDescription>{list.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
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
                      className="flex-1"
                      onClick={() => {
                        setEditingList(list.id);
                        setNewListName(list.name);
                        setNewListDescription(list.description || "");
                      }}
                    >
                      <Edit2 className="mr-2 h-4 w-4" />
                      Edit
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

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4" />
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

      {lists.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookMarked className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-4">
              You haven't created any lists yet
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First List
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
