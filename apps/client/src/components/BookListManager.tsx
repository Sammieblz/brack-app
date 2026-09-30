import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MobileAlertDialog, MobileDialog } from "@/components/ui/mobile-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { BookListGridSkeleton } from "@/components/skeletons/BookListCardSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingRegion, LoadingError } from "@/components/loading/LoadingRegion";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useBookLists, type BookList } from "@/hooks/useBookLists";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useToast } from "@/hooks/use-toast";
import { APP_ICONS } from "@/config/iconography";
import { cn } from "@/lib/utils";
import { useAppBackGuard } from "@/hooks/useAppBackGuard";

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

const BookListManagerContent = ({ userId }: BookListManagerProps) => {
  const navigate = useNavigate();
  const {
    lists,
    loading,
    refreshing,
    hasLoaded,
    error,
    refetch,
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
  const [baseline, setBaseline] = useState(emptyForm);
  const [operation, setOperation] = useState<"create" | "update" | "delete" | "duplicate" | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  const createTrigger = useRef<HTMLButtonElement>(null);
  const taskTrigger = useRef<HTMLButtonElement | null>(null);
  const discardAccepted = useRef(false);
  const returnFocus = useMemo(() => ({ get current() {
    return taskTrigger.current?.isConnected ? taskTrigger.current : createTrigger.current;
  } }), []);
  const busy = operation !== null;
  const editorOpen = isCreateOpen || Boolean(editingList);
  const dirty = form.name !== baseline.name || form.description !== baseline.description;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useAppBackGuard(busy, () => !pending.current);

  const loadMoreRef = useInfiniteScroll({
    hasMore,
    loading: loadingMore || busy,
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

  const closeEditor = () => {
    setIsCreateOpen(false); setEditingList(null); setDiscardOpen(false);
    setForm(emptyForm); setBaseline(emptyForm); setTaskError(null);
  };
  const requestEditorClose = () => {
    if (pending.current) return;
    if (dirty) { discardAccepted.current = false; setDiscardOpen(true); }
    else closeEditor();
  };
  const begin = (next: NonNullable<typeof operation>) => {
    if (!mounted.current || pending.current) return false;
    pending.current = true; setOperation(next); setTaskError(null); setDuplicateError(null);
    return true;
  };
  const finish = () => {
    if (mounted.current) { pending.current = false; setOperation(null); }
  };
  const handleSave = async () => {
    if (pending.current || !mounted.current) return;
    const submitted = { name: form.name.trim(), description: form.description.trim() };
    if (!submitted.name) { setTaskError("Enter a name for your list."); return; }
    const target = editingList;
    if (!begin(target ? "update" : "create")) return;
    try {
      if (target) await updateList(target.id, { name: submitted.name, description: submitted.description || null });
      else await createList(submitted.name, submitted.description || undefined);
      if (!mounted.current) return;
      triggerHaptic("success");
      toast({ title: target ? "List updated" : "List created", description: target ? "Your list details were saved" : `"${submitted.name}" is ready for books` });
      closeEditor();
    } catch {
      if (mounted.current) setTaskError(target ? "Your list could not be updated. Your changes are still here. Try again." : "Your list could not be created. Your changes are still here. Try again.");
    } finally { finish(); }
  };
  const handleDelete = async () => {
    const target = deleteTarget;
    if (!target || !begin("delete")) return;
    try {
      await deleteList(target.id);
      if (!mounted.current) return;
      triggerHaptic("success");
      toast({ title: "List deleted", description: `"${target.name}" has been deleted` });
      taskTrigger.current = createTrigger.current;
      setDeleteTarget(null);
    } catch {
      if (mounted.current) setTaskError("This list could not be deleted. It is still in your Library. Try again.");
    } finally { finish(); }
  };
  const handleDuplicate = async (list: BookList) => {
    if (!begin("duplicate")) return;
    try {
      const newList = await duplicateList(list.id);
      if (!mounted.current) return;
      triggerHaptic("success");
      toast({ title: "List duplicated", description: `"${list.name}" was copied to "${newList.name}"` });
    } catch {
      if (mounted.current) setDuplicateError(`"${list.name}" could not be fully copied. A partial copy may already be in your lists. Check your lists before trying again.`);
    } finally { finish(); }
  };
  const openCreate = (trigger: HTMLButtonElement) => {
    if (pending.current) return;
    taskTrigger.current = trigger; setForm(emptyForm); setBaseline(emptyForm);
    setTaskError(null); setIsCreateOpen(true);
  };
  const openEdit = (list: BookList, trigger: HTMLButtonElement | null) => {
    if (pending.current) return;
    const draft = { name: list.name, description: list.description || "" };
    taskTrigger.current = trigger; setEditingList(list); setForm(draft); setBaseline(draft); setTaskError(null);
  };
  const openDelete = (list: BookList, trigger: HTMLButtonElement | null) => {
    if (pending.current) return;
    taskTrigger.current = trigger; setTaskError(null); setDeleteTarget(list);
  };
  const refresh = () => pending.current ? Promise.resolve() : refetch();

  const showEmpty = hasLoaded && lists.length === 0;
  const showNoMatches = lists.length > 0 && filteredLists.length === 0;

  return (
    <PullToRefresh onRefresh={refresh}>
    <LoadingRegion loading={loading} refreshing={refreshing} label={loading ? "Loading book lists" : "Refreshing book lists"} className="space-y-5">
      <section className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/70 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold tracking-tight">Book Lists</h1>
          <p className="mt-1 max-w-2xl font-sans text-sm text-muted-foreground sm:text-base">
            Group books into reading plans, recommendations, club picks, or personal collections.
          </p>
        </div>

            <Button ref={createTrigger} disabled={busy} onClick={event => openCreate(event.currentTarget)} className="h-auto min-h-11 w-full whitespace-normal rounded-full sm:w-auto">
              <AppIcon icon={APP_ICONS.common.add} variant="inline" size="sm" className="mr-2" />
              Create List
            </Button>
      </section>

      {operation === "duplicate" && <p role="status" className="text-sm text-muted-foreground">Copying your list…</p>}
      {duplicateError && <p role="alert" className="text-sm text-destructive">{duplicateError}</p>}

      {loading ? (
        <section aria-hidden="true" className="grid gap-3 md:grid-cols-[1.15fr_0.85fr] xl:grid-cols-[1.4fr_0.9fr]">
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => <div key={index} className="rounded-xl border border-border/70 bg-card/70 p-4"><Skeleton className="h-8 w-12" /><Skeleton className="mt-1 h-5 w-4/5" /></div>)}
          </div>
          <div className="rounded-xl border border-border/70 bg-card/80 p-4"><Skeleton className="h-4 w-32" /><Skeleton className="mt-1 h-7 w-3/5" /><Skeleton className="mt-2 h-10 w-full" /></div>
        </section>
      ) : !showEmpty && hasLoaded && (
        <section className="grid gap-3 md:grid-cols-[1.15fr_0.85fr] xl:grid-cols-[1.4fr_0.9fr]">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Lists" value={stats.total} />
            <Metric label="Books organized" value={stats.totalBooks} />
            <Metric label="Empty lists" value={stats.empty} muted />
          </div>

          {featuredList && (
            <button
              type="button"
              disabled={busy}
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

      {!showEmpty && (!error || hasLoaded) && (
        <section className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <AppIcon
                icon={APP_ICONS.common.search}
                variant="inline"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label="Search lists"
                disabled={busy}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search lists by name or description"
                className="min-h-11 rounded-full pl-10"
              />
            </div>
            <Select disabled={busy} value={sort} onValueChange={(value) => setSort(value as ListSort)}>
              <SelectTrigger aria-label="Sort lists" className="h-auto min-h-11 rounded-full lg:w-48">
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
                disabled={busy}
                onClick={() => setFilter(option.value)}
                className="shrink-0 rounded-full"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </section>
      )}

      {error && <LoadingError message={error} onRetry={() => void refresh()} />}
      {loading ? <BookListGridSkeleton /> : !hasLoaded && error ? null : showEmpty ? (
        <EmptyListsState onCreate={openCreate} disabled={busy} />
      ) : showNoMatches ? (
        <PremiumEmptyState
          asset="noResults"
          title="No matching lists"
          description="Try another search term or clear the current filter."
          size="compact"
          action={
            <Button
              variant="outline"
              disabled={busy}
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
              disabled={busy}
              onOpen={() => navigate(`/lists/${list.id}`)}
              onEdit={trigger => openEdit(list, trigger)}
              onDuplicate={() => handleDuplicate(list)}
              onDelete={trigger => openDelete(list, trigger)}
            />
          ))}
        </div>
      )}

      {hasMore && lists.length > 0 && (
        <div ref={loadMoreRef} className="py-8">
          {loadingMore && <LoadingRegion loading label="Loading more lists"><BookListGridSkeleton count={3} /></LoadingRegion>}
        </div>
      )}

      <MobileDialog open={editorOpen} onOpenChange={open => { if (!open) requestEditorClose(); }}
        returnFocusRef={returnFocus} title={editingList ? "Edit List" : "Create List"}
        description={editingList ? "Update how this collection appears in your library." : "Start with a focused collection. You can add books after creating it."}>
          <ListForm
              form={form}
              onChange={setForm}
            pending={busy}
            error={taskError}
            submitLabel={editingList ? "Save Changes" : "Create List"}
            onSubmit={handleSave}
            onCancel={requestEditorClose}
          />
      </MobileDialog>
      <MobileAlertDialog open={discardOpen} onOpenChange={setDiscardOpen}
        title="Discard list changes?" description="Your changes have not been saved. Keep editing to retain them."
        cancelText="Keep editing" confirmText="Discard changes" variant="destructive"
        restoreFocusOnClose={!discardAccepted.current}
        onConfirm={() => { if (pending.current) return; discardAccepted.current = true; closeEditor(); }} />
      <MobileDialog open={Boolean(deleteTarget)} onOpenChange={open => { if (!open && !pending.current) { setDeleteTarget(null); setTaskError(null); } }}
        returnFocusRef={returnFocus} title="Delete list?" showClose={false}
        description={deleteTarget ? `“${deleteTarget.name}” will be removed from your lists. The books stay in your Library.` : "This list will be removed. The books stay in your Library."}
        footer={<><Button variant="outline" disabled={busy} onClick={() => { setDeleteTarget(null); setTaskError(null); }}>Cancel</Button>
          <Button variant="destructive" disabled={busy} onClick={handleDelete}>Delete</Button></>}>
        {taskError && <p role="alert" className="text-sm text-destructive">{taskError}</p>}
        {operation === "delete" && <p role="status" className="text-sm text-muted-foreground">Deleting your list…</p>}
      </MobileDialog>
    </LoadingRegion>
    </PullToRefresh>
  );
};

export const BookListManager = ({ userId }: BookListManagerProps) => <BookListManagerContent key={userId} userId={userId} />;

const Metric = ({ label, value, muted = false }: { label: string; value: number; muted?: boolean }) => (
  <div className="rounded-xl border border-border/70 bg-card/70 p-4">
    <div className={cn("font-sans text-2xl font-bold tabular-nums", muted ? "text-muted-foreground" : "text-primary")}>
      {value}
    </div>
    <div className="font-sans text-sm text-muted-foreground">{label}</div>
  </div>
);

export const BookListOverviewCard = ({
  list,
  onOpen,
  onEdit,
  onDuplicate,
  onDelete,
  disabled = false,
}: {
  list: BookList;
  onOpen: () => void;
  onEdit: (trigger: HTMLButtonElement | null) => void;
  onDuplicate: () => void;
  onDelete: (trigger: HTMLButtonElement | null) => void;
  disabled?: boolean;
}) => {
  const actionTrigger = useRef<HTMLButtonElement>(null);
  const count = list.book_count || 0;
  const isEmpty = count === 0;

  return (
    <Card className="group overflow-hidden border-border/70 bg-card/85 transition-colors hover:border-primary/45">
      <CardContent className="flex h-full flex-col p-4">
        <button type="button" disabled={disabled} onClick={onOpen} className="min-h-[9rem] text-left">
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
          <Button variant="outline" size="sm" className="rounded-full" disabled={disabled} onClick={onOpen}>
            Open
            <AppIcon icon={APP_ICONS.common.forward} variant="inline" size="sm" className="ml-2" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button ref={actionTrigger} disabled={disabled} variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label={`Actions for ${list.name}`}>
                <AppIcon icon={APP_ICONS.common.more} variant="action" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={disabled} onSelect={() => onEdit(actionTrigger.current)}>
                <AppIcon icon={APP_ICONS.common.edit} variant="inline" size="sm" className="mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem disabled={disabled} onSelect={onDuplicate}>
                <AppIcon icon={APP_ICONS.common.copy} variant="inline" size="sm" className="mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={disabled}
                onSelect={() => onDelete(actionTrigger.current)}
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
  onCancel,
  pending,
  error,
}: {
  form: { name: string; description: string };
  onChange: (next: { name: string; description: string }) => void;
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
  pending: boolean;
  error: string | null;
}) => {
  const id = useId();
  return <form onSubmit={event => { event.preventDefault(); onSubmit(); }} className="space-y-4" aria-busy={pending}>
  <fieldset disabled={pending} aria-describedby={error ? `${id}-error` : undefined} className="min-w-0 space-y-4">
    <legend className="sr-only">List details</legend>
    <div className="space-y-2">
      <Label htmlFor={`${id}-name`}>Name</Label>
      <Input
        id={`${id}-name`}
        placeholder="e.g., Summer Reading, Club Picks, Favorites"
        value={form.name}
        onChange={(event) => onChange({ ...form, name: event.target.value })}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor={`${id}-description`}>Description</Label>
      <Textarea
        id={`${id}-description`}
        placeholder="What belongs in this collection?"
        value={form.description}
        onChange={(event) => onChange({ ...form, description: event.target.value })}
      />
    </div>
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" className="h-auto min-h-11 flex-1 whitespace-normal" onClick={onCancel}>Cancel</Button>
      <Button type="submit" className="h-auto min-h-11 flex-1 whitespace-normal">{submitLabel}</Button>
    </div>
  </fieldset>
  {pending && <p role="status" className="text-sm text-muted-foreground">Saving your list…</p>}
  {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
  </form>;
};

const EmptyListsState = ({ onCreate, disabled }: { onCreate: (trigger: HTMLButtonElement) => void; disabled: boolean }) => (
  <PremiumEmptyState
    asset="emptyLists"
    title="Create your first list"
    description="Build a reading plan, save recommendations, or collect books for a club discussion."
    action={
      <Button disabled={disabled} onClick={event => onCreate(event.currentTarget)} className="rounded-full">
        <AppIcon icon={APP_ICONS.common.add} variant="inline" size="sm" className="mr-2" />
        Create List
      </Button>
    }
  />
);
