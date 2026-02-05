import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { useBookLists } from "@/hooks/useBookLists";
import { useListBooks } from "@/hooks/useListBooks";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, GripVertical } from "lucide-react";
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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Book } from "@/types";

interface SortableBookItemProps {
  book: Book;
  userId: string;
  onRemove: (bookId: string) => void;
  onNavigate: (bookId: string) => void;
}

const SortableBookItem = ({ book, userId, onRemove, onNavigate }: SortableBookItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: book.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 bg-background/80 hover:bg-background cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>
      </div>
      <BookCard
        book={book}
        onClick={() => onNavigate(book.id)}
        userId={userId}
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
            <AlertDialogAction onClick={() => onRemove(book.id)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const BookListDetail = () => {
  const { listId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { lists, removeBookFromList, reorderBooks } = useBookLists(user?.id);
  const { books, loading: booksLoading, refetch } = useListBooks(listId);
  const { toast } = useToast();
  const [sortableBooks, setSortableBooks] = useState<Book[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const list = lists.find(l => l.id === listId);

  useEffect(() => {
    setSortableBooks(books);
  }, [books]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortableBooks.findIndex((book) => book.id === active.id);
      const newIndex = sortableBooks.findIndex((book) => book.id === over.id);

      const newOrder = arrayMove(sortableBooks, oldIndex, newIndex);
      setSortableBooks(newOrder);

      // Update positions in database
      const updates = newOrder.map((book, index) => ({
        book_id: book.id,
        position: index + 1,
      }));

      try {
        await reorderBooks(listId!, updates);
        toast({
          title: "Order updated",
          description: "Books have been reordered",
        });
      } catch (error: unknown) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to reorder books",
        });
        // Revert on error
        setSortableBooks(books);
      }
    }
  };

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
    } catch (error: unknown) {
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

        {sortableBooks.length === 0 ? (
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortableBooks.map(book => book.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sortableBooks.map((book) => (
                  <SortableBookItem
                    key={book.id}
                    book={book}
                    userId={user.id}
                    onRemove={handleRemoveBook}
                    onNavigate={(id) => navigate(`/book/${id}`)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>
    </div>
  );
};

export default BookListDetail;
