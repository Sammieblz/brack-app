import { useParams, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { useBookLists } from "@/hooks/useBookLists";
import { useListBooks } from "@/hooks/useListBooks";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2 } from "lucide-react";
import { BookCard } from "@/components/BookCard";
import { AddBooksToListDialog } from "@/components/AddBooksToListDialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const BookListDetail = () => {
  const { listId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { lists, removeBookFromList } = useBookLists(user?.id);
  const { books, loading: booksLoading, refetch } = useListBooks(listId);
  const { toast } = useToast();

  const list = lists.find(l => l.id === listId);

  if (authLoading || booksLoading) {
    return <LoadingSpinner />;
  }

  if (!user || !list) {
    navigate('/lists');
    return null;
  }

  const handleRemoveBook = async (bookId: string) => {
    try {
      await removeBookFromList(listId!, bookId);
      await refetch();
      toast({
        title: "Book removed",
        description: "Book has been removed from the list",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to remove book",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto p-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/lists')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Lists
          </Button>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">{list.name}</h1>
              {list.description && (
                <p className="text-muted-foreground">{list.description}</p>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                {books.length} {books.length === 1 ? 'book' : 'books'}
              </p>
            </div>
            
            <AddBooksToListDialog
              listId={listId!}
              userId={user.id}
              onBooksAdded={refetch}
            />
          </div>
        </div>

        {books.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              No books in this list yet
            </p>
            <AddBooksToListDialog
              listId={listId!}
              userId={user.id}
              onBooksAdded={refetch}
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {books.map((book) => (
              <div key={book.id} className="relative group">
                <BookCard
                  book={book}
                  onClick={() => navigate(`/book/${book.id}`)}
                  userId={user.id}
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove from list?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove "{book.title}" from this list. The book will still be in your library.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleRemoveBook(book.id)}>
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default BookListDetail;
