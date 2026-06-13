import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBookLists } from "@/hooks/useBookLists";
import { useListBooks } from "@/hooks/useListBooks";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { NavArrowRight } from "iconoir-react";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { AppBackButton } from "@/components/AppBackButton";
import { useIsMobile } from "@/hooks/use-mobile";
import { AddBooksToListDialog } from "@/components/AddBooksToListDialog";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { OptimizedImage } from "@/components/OptimizedImage";
import { APP_ICONS } from "@/config/iconography";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/utils";
import { getProgressPercentage } from "@/utils/bookProgress";
import {
  removeBookFromList as removeBookFromListApi,
  reorderBookListItems,
} from "@/services/api/bookLists";
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
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Book } from "@/types";

interface SortableBookItemProps {
  book: Book;
  onRemove: (bookId: string) => void;
  onNavigate: (bookId: string) => void;
}

const SortableBookItem = ({ book, onRemove, onNavigate }: SortableBookItemProps) => {
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
    zIndex: isDragging ? 30 : undefined,
  };
  const progress = getProgressPercentage(book);
  const hasProgress = book.status === "reading" && Boolean(book.pages);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "group h-full overflow-hidden border-border/70 bg-card/85 shadow-sm transition-all duration-200",
        isDragging && "scale-[1.015] border-primary/60 shadow-glow"
      )}
    >
      <CardContent className="flex h-full flex-col p-0">
        <div className="flex min-h-[9.5rem] flex-1 gap-3 p-3 sm:p-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Move ${book.title}`}
                className="mt-1 h-10 w-10 shrink-0 touch-none cursor-grab rounded-full text-muted-foreground active:cursor-grabbing"
                {...attributes}
                {...listeners}
              >
                <AppIcon icon={APP_ICONS.common.drag} variant="action" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Drag to reorder</TooltipContent>
          </Tooltip>

          <button
            type="button"
            onClick={() => onNavigate(book.id)}
            className="group/cover shrink-0 text-left"
            aria-label={`Open ${book.title}`}
          >
            {book.cover_url ? (
              <OptimizedImage
                src={book.cover_url}
                alt={book.title}
                className="h-24 w-16 rounded-md object-cover shadow-sm transition-transform group-hover/cover:-translate-y-0.5 sm:h-28 sm:w-[4.5rem]"
              />
            ) : (
              <span className="grid h-24 w-16 place-items-center rounded-md bg-muted/40 text-muted-foreground sm:h-28 sm:w-[4.5rem]">
                <AppIcon icon={APP_ICONS.dashboard.coverFallback} variant="empty" size="md" />
              </span>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <button
                type="button"
                onClick={() => onNavigate(book.id)}
                className="min-w-0 text-left"
              >
                <h3 className="line-clamp-2 font-serif text-base font-semibold leading-snug text-foreground transition-colors hover:text-primary">
                  {book.title}
                </h3>
                {book.author && (
                  <p className="mt-0.5 truncate font-serif text-sm text-muted-foreground">
                    by {book.author}
                  </p>
                )}
              </button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Remove ${book.title} from list`}
                    className="h-9 w-9 shrink-0 rounded-full border-destructive/45 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <AppIcon icon={APP_ICONS.common.delete} variant="action" />
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

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-sans text-[11px] font-semibold capitalize text-white",
                  book.status === "completed" && "bg-green-500",
                  book.status === "reading" && "bg-orange-500",
                  book.status === "to_read" && "bg-blue-500",
                  !["completed", "reading", "to_read"].includes(book.status) && "bg-muted-foreground"
                )}
              >
                {book.status.replace("_", " ")}
              </span>
              {book.pages && (
                <span className="font-sans text-xs text-muted-foreground">
                  {book.pages} pages
                </span>
              )}
              {book.genre && (
                <span className="font-sans text-xs text-muted-foreground">
                  {book.genre}
                </span>
              )}
            </div>

            {hasProgress ? (
              <div className="mt-3 max-w-sm space-y-1.5">
                <Progress value={progress} className="h-1.5" />
                <p className="font-sans text-xs text-muted-foreground">
                  {book.current_page || 0} / {book.pages} pages ({Math.round(progress)}%)
                </p>
              </div>
            ) : (
              <p className="mt-3 font-sans text-xs text-muted-foreground">
                Tap to view details
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-border/55 bg-background/35 px-3 py-2 sm:px-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onNavigate(book.id)}
            className="h-8 w-full justify-between rounded-full text-xs"
          >
            Details
            <NavArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const BookListDetail = () => {
  const { listId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { lists } = useBookLists(user?.id);
  const { books, loading: booksLoading, refetch } = useListBooks(listId);
  const { toast } = useToast();
  const [sortableBooks, setSortableBooks] = useState<Book[]>([]);
  const isMobile = useIsMobile(); // Must be called before any early returns

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
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
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(sortableBooks, oldIndex, newIndex);
      setSortableBooks(newOrder);

      // Update positions in database
      const updates = newOrder.map((book, index) => ({
        book_id: book.id,
        position: index + 1,
      }));

      try {
        await reorderBookListItems(listId!, updates);
        toast({
          title: "Order updated",
          description: "Books have been reordered",
        });
      } catch (error: unknown) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to reorder books",
        });
        // Revert on error
        setSortableBooks(books);
      }
    }
  };

  const handleRemoveBook = async (bookId: string) => {
    const previousBooks = sortableBooks;
    setSortableBooks((current) => current.filter((book) => book.id !== bookId));

    try {
      await removeBookFromListApi(listId!, bookId);
      await refetch();
      toast({
        title: "Book removed",
        description: "Book has been removed from the list",
      });
    } catch (error: unknown) {
      setSortableBooks(previousBooks);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove book",
      });
    }
  };

  if (authLoading || booksLoading) {
    return <LoadingSpinner />;
  }

  if (!user || !list) {
    navigate('/lists');
    return null;
  }

  return (
    <MobileLayout>
      {isMobile && (
        <MobileHeader
          title={list.name}
          back={{ label: "Back", ariaLabel: "Go back", fallbackPath: "/lists" }}
        />
      )}
      <main className="app-page space-y-6">
        {!isMobile && (
          <div>
            <AppBackButton
              label="Back"
              ariaLabel="Go back"
              fallbackPath="/lists"
              showLabel
              variant="outline"
              className="mb-4 border-border/70 bg-card/45 shadow-none hover:bg-accent"
            />
          </div>
        )}
          
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold mb-2">{list.name}</h1>
            {list.description && (
              <p className="font-sans text-muted-foreground">{list.description}</p>
            )}
            <p className="text-sm text-muted-foreground mt-2">
              {sortableBooks.length} {sortableBooks.length === 1 ? "book" : "books"}
            </p>
          </div>

          <AddBooksToListDialog
            listId={listId!}
            userId={user.id}
            onBooksAdded={refetch}
            trigger={
              <Button className="w-full rounded-full sm:w-auto">
                <AppIcon icon={APP_ICONS.common.add} variant="action" className="mr-2" />
                Add Books
              </Button>
            }
          />
        </div>

        {sortableBooks.length === 0 ? (
          <PremiumEmptyState
            asset="emptyLists"
            title="No books in this list yet"
            description="Add books to turn this into a useful collection."
            size="compact"
            action={
            <AddBooksToListDialog
              listId={listId!}
              userId={user.id}
              onBooksAdded={refetch}
            />
            }
          />
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/60 p-3 text-sm text-muted-foreground">
              <div>
                <p className="font-sans font-semibold text-foreground">Arrange this list</p>
                <p className="font-sans">
                  Drag a book by its handle to reorder. Tap the cover or Details to open the book.
                </p>
              </div>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortableBooks.map(book => book.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {sortableBooks.map((book) => (
                    <SortableBookItem
                      key={book.id}
                      book={book}
                      onRemove={handleRemoveBook}
                      onNavigate={(id) => navigate(`/book/${id}`)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </>
        )}
      </main>
    </MobileLayout>
  );
};

export default BookListDetail;
