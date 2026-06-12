import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AppIcon } from "@/components/ui/app-icon";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { BookListCardSkeleton } from "@/components/skeletons/BookListCardSkeleton";
import { useBookLists, type BookList } from "@/hooks/useBookLists";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useToast } from "@/hooks/use-toast";
import { APP_ICONS } from "@/config/iconography";
import { cn } from "@/lib/utils";

interface BookListManagerProps {
  userId: string;
}

type ListFilter = "all" | "filled" | "empty" | "public" | "private";
type ListSort = "updated_desc" | "created_desc" | "name_asc" | "count_desc";

const FILTERS: Array<{ value: ListFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "filled", label: "With books" },
  { value: "empty", label: "Empty" },
  { value: "public", label: "Public" },
  { value: "private", label: "Private" },
];

const SORTS: Array<{ value: ListSort; label: string }> = [
  { value: "updated_desc", label: "Recently updated" },
  { value: "created_desc", label: "Recently created" },
  { value: "count_desc", label: "Most books" },
  { value: "name_asc", label: "Name" },
];

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const emptyForm = { name: "", description: "" };

export const BookListManager = ({ userId }: BookListManagerProps) => {
  const navigate = useNavigate();
  const {
    lists,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    createList,
    updateList,
    deleteList,
    duplicateList,
  } = useBookLists(userId);
  const { toast } = useToast();
  const { triggerHaptic } = useHapticFeedback();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingList, setEditingList] = useState<BookList | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BookList | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ListFilter>("all");
  const [sort, setSort] = useState<ListSort>("updated_desc");

  const loadMoreRef = useInfiniteScroll({
    hasMore,
    loading: loadingMore,
    onLoadMore: loadMore,
  });

  const stats = useMemo(() => {
    const totalBooks = lists.reduce((sum, list) => sum + (list.book_count || 0), 0);
    const filled = lists.filter((list) => (list.book_count || 0) > 0).length;
    return {
      total: lists.length,
      totalBooks,
      filled,
      empty: lists.length - filled,
    };
  }, [lists]);

  const filteredLists = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return [...lists]
      .filter((list) => {
        const count = list.book_count || 0;
        if (filter === "filled" && count === 0) return false;
        if (filter === "empty" && count > 0) return false;
        if (filter === "public" && !list.is_public) return false;
        if (filter === "private" && list.is_public) return false;
        if (!normalizedQuery) return true;

        return [list.name, list.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((a, b) => {
        switch (sort) {
          case "name_asc":
            return a.name.localeCompare(b.name);
          case "count_desc":
            return (b.book_count || 0) - (a.book_count || 0);
          case "created_desc":
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          case "updated_desc":
          default:
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        }
      });
  }, [filter, lists, query, sort]);

  const featuredList = useMemo(() => {
    return [...lists].sort((a, b) => {
      const countDiff = (b.book_count || 0) - (a.book_count || 0);
      if (countDiff !== 0) return countDiff;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    })[0];
  }, [lists]);

  const resetForm = () => setForm(emptyForm);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      triggerHaptic("error");
      toast({
        variant: "destructive",
        title: "Name required",
        description: "Please enter a name for your list",
      });
      return;
    }

    const result = await createList(form.name.trim(), form.description.trim() || undefined);
    if (result) {
      triggerHaptic("success");
      toast({
        title: "List created",
        description: `"${form.name.trim()}" is ready for books`,
      });
      setIsCreateOpen(false);
      resetForm();
    }
  };

  const handleUpdate = async () => {
    if (!editingList || !form.name.trim()) return;

    await updateList(editingList.id, {
      name: form.name.trim(),
      description: form.description.trim() || null,
    });
    triggerHaptic("success");
    toast({
      title: "List updated",
      description: "Your list details were saved",
    });
    setEditingList(null);
    resetForm();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    triggerHaptic("medium");
    await deleteList(deleteTarget.id);
    triggerHaptic("success");
    toast({
      title: "List deleted",
      description: `"${deleteTarget.name}" has been deleted`,
    });
    setDeleteTarget(null);
  };

  const handleDuplicate = async (list: BookList) => {
    const newList = await duplicateList(list.id);
    if (newList) {
      triggerHaptic("success");
      toast({
        title: "List duplicated",
        description: `"${list.name}" was copied to "${newList.name}"`,
      });
    } else {
      triggerHaptic("error");
      toast({
        variant: "destructive",
        title: "Could not duplicate list",
        description: "Please try again.",
      });
    }
  };

  const openEdit = (list: BookList) => {
    setEditingList(list);
    setForm({
      name: list.name,
      description: list.description || "",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-5 w-72 max-w-full animate-pulse rounded-md bg-muted" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <BookListCardSkeleton />
          <BookListCardSkeleton />
          <BookListCardSkeleton />
        </div>
      </div>
    );
  }

  const showEmpty = lists.length === 0;
  const showNoMatches = lists.length > 0 && filteredLists.length === 0;

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/70 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold tracking-tight">Book Lists</h1>
          <p className="mt-1 max-w-2xl font-sans text-sm text-muted-foreground sm:text-base">
            Group books into reading plans, recommendations, club picks, or personal collections.
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="h-11 w-full rounded-full sm:w-auto">
              <AppIcon icon={APP_ICONS.common.add} variant="inline" size="sm" className="mr-2" />
              Create List
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Create List</DialogTitle>
              <DialogDescription>
                Start with a focused collection. You can add books after creating it.
              </DialogDescription>
            </DialogHeader>
            <ListForm
              form={form}
              onChange={setForm}
              submitLabel="Create List"
              onSubmit={handleCreate}
            />
          </DialogContent>
        </Dialog>
      </section>

      {!showEmpty && (
        <section className="grid gap-3 md:grid-cols-[1.15fr_0.85fr] xl:grid-cols-[1.4fr_0.9fr]">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Lists" value={stats.total} />
            <Metric label="Books organized" value={stats.totalBooks} />
            <Metric label="Empty lists" value={stats.empty} muted />
          </div>

          {featuredList && (
            <button
              type="button"
              onClick={() => navigate(`/lists/${featuredList.id}`)}
              className="rounded-xl border border-border/70 bg-card/80 p-4 text-left transition-colors hover:border-primary/45 hover:bg-primary/5"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-sans text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Most stocked list
                  </span>
                  <span className="mt-1 block truncate font-display text-lg font-semibold">
                    {featuredList.name}
                  </span>
                </span>
                <Badge variant="secondary">{featuredList.book_count || 0} books</Badge>
              </div>
              <p className="mt-2 line-clamp-2 font-sans text-sm text-muted-foreground">
                {featuredList.description || "Open this list to review or reorder its books."}
              </p>
            </button>
          )}
        </section>
      )}

      {!showEmpty && (
        <section className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <AppIcon
                icon={APP_ICONS.common.search}
                variant="inline"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search lists by name or description"
                className="min-h-11 rounded-full pl-10"
              />
            </div>
            <Select value={sort} onValueChange={(value) => setSort(value as ListSort)}>
              <SelectTrigger className="h-11 rounded-full lg:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={filter === option.value ? "default" : "outline"}
                onClick={() => setFilter(option.value)}
                className="shrink-0 rounded-full"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </section>
      )}

      {showEmpty ? (
        <EmptyListsState onCreate={() => setIsCreateOpen(true)} />
      ) : showNoMatches ? (
        <PremiumEmptyState
          asset="noResults"
          title="No matching lists"
          description="Try another search term or clear the current filter."
          size="compact"
          action={
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredLists.map((list) => (
            <BookListOverviewCard
              key={list.id}
              list={list}
              onOpen={() => navigate(`/lists/${list.id}`)}
              onEdit={() => openEdit(list)}
              onDuplicate={() => handleDuplicate(list)}
              onDelete={() => setDeleteTarget(list)}
            />
          ))}
        </div>
      )}

      {hasMore && lists.length > 0 && (
        <div ref={loadMoreRef} className="flex justify-center py-8">
          {loadingMore && (
            <div className="font-sans flex items-center gap-2 text-muted-foreground">
              <AppIcon icon={APP_ICONS.common.refresh} variant="inline" size="md" className="animate-spin" />
              <span>Loading more lists...</span>
            </div>
          )}
        </div>
      )}

      <Dialog open={Boolean(editingList)} onOpenChange={(open) => {
        if (!open) {
          setEditingList(null);
          resetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Edit List</DialogTitle>
            <DialogDescription>
              Update how this collection appears in your library.
            </DialogDescription>
          </DialogHeader>
          <ListForm
            form={form}
            onChange={setForm}
            submitLabel="Save Changes"
            onSubmit={handleUpdate}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete list?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `“${deleteTarget.name}” will be removed from your lists. The books stay in your Library.`
                : "This list will be removed. The books stay in your Library."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Metric = ({ label, value, muted = false }: { label: string; value: number; muted?: boolean }) => (
  <div className="rounded-xl border border-border/70 bg-card/70 p-4">
    <div className={cn("font-sans text-2xl font-bold tabular-nums", muted ? "text-muted-foreground" : "text-primary")}>
      {value}
    </div>
    <div className="font-sans text-sm text-muted-foreground">{label}</div>
  </div>
);

const BookListOverviewCard = ({
  list,
  onOpen,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  list: BookList;
  onOpen: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) => {
  const count = list.book_count || 0;
  const isEmpty = count === 0;

  return (
    <Card className="group overflow-hidden border-border/70 bg-card/85 transition-colors hover:border-primary/45">
      <CardContent className="flex h-full flex-col p-4">
        <button type="button" onClick={onOpen} className="min-h-[9rem] text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="line-clamp-2 font-display text-xl font-semibold leading-tight transition-colors group-hover:text-primary">
                {list.name}
              </h2>
              <p className="mt-1 font-sans text-xs text-muted-foreground">
                Updated {formatDate(list.updated_at)}
              </p>
            </div>
            <Badge variant={isEmpty ? "outline" : "secondary"} className="shrink-0">
              {count} {count === 1 ? "book" : "books"}
            </Badge>
          </div>

          <p className="mt-3 line-clamp-3 font-sans text-sm text-muted-foreground">
            {list.description || (isEmpty ? "Add books to give this list shape." : "Open this list to review and arrange its books.")}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline">{list.is_public ? "Public" : "Private"}</Badge>
            {isEmpty ? <Badge variant="outline">Needs books</Badge> : <Badge variant="outline">Ready</Badge>}
          </div>
        </button>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/70 pt-3">
          <Button variant="outline" size="sm" className="rounded-full" onClick={onOpen}>
            Open
            <AppIcon icon={APP_ICONS.common.forward} variant="inline" size="sm" className="ml-2" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label={`Actions for ${list.name}`}>
                <AppIcon icon={APP_ICONS.common.more} variant="action" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>
                <AppIcon icon={APP_ICONS.common.edit} variant="inline" size="sm" className="mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onDuplicate}>
                <AppIcon icon={APP_ICONS.common.copy} variant="inline" size="sm" className="mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <AppIcon icon={APP_ICONS.common.delete} variant="inline" size="sm" className="mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
};

const ListForm = ({
  form,
  onChange,
  submitLabel,
  onSubmit,
}: {
  form: { name: string; description: string };
  onChange: (next: { name: string; description: string }) => void;
  submitLabel: string;
  onSubmit: () => void;
}) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor={`${submitLabel}-name`}>Name</Label>
      <Input
        id={`${submitLabel}-name`}
        placeholder="e.g., Summer Reading, Club Picks, Favorites"
        value={form.name}
        onChange={(event) => onChange({ ...form, name: event.target.value })}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor={`${submitLabel}-description`}>Description</Label>
      <Textarea
        id={`${submitLabel}-description`}
        placeholder="What belongs in this collection?"
        value={form.description}
        onChange={(event) => onChange({ ...form, description: event.target.value })}
      />
    </div>
    <Button onClick={onSubmit} className="w-full">
      {submitLabel}
    </Button>
  </div>
);

const EmptyListsState = ({ onCreate }: { onCreate: () => void }) => (
  <PremiumEmptyState
    asset="emptyLists"
    title="Create your first list"
    description="Build a reading plan, save recommendations, or collect books for a club discussion."
    action={
      <Button onClick={onCreate} className="rounded-full">
        <AppIcon icon={APP_ICONS.common.add} variant="inline" size="sm" className="mr-2" />
        Create List
      </Button>
    }
  />
);
