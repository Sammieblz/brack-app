import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { MobileAlertDialog, MobileDialog } from "@/components/ui/mobile-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AppIcon } from "@/components/ui/app-icon";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { BookListGridSkeleton } from "@/components/skeletons/BookListCardSkeleton";
import { LoadingRegion, LoadingError } from "@/components/loading/LoadingRegion";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useBookLists, type BookList } from "@/hooks/useBookLists";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useToast } from "@/hooks/use-toast";
import { APP_ICONS } from "@/config/iconography";
import { useAppBackGuard } from "@/hooks/useAppBackGuard";

import { Dialog, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AdaptiveDialogBody, AdaptiveDialogContent, AdaptiveDialogDescription, AdaptiveDialogFooter, AdaptiveDialogHeader, AdaptiveDialogTitle } from "@/components/ui/adaptive-dialog";
import "./library/collections.css";

interface BookListManagerProps {
  showTitle?: boolean;
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

const BookListManagerContent = ({ userId, showTitle = true }: BookListManagerProps) => {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const filter = FILTERS.find(option => option.value === params.get("filter"))?.value ?? "all";
  const sort = SORTS.find(option => option.value === params.get("sort"))?.value ?? "updated_desc";
  const setContext = (key: string, value: string, defaultValue = "") => setParams(previous => {
    const next = new URLSearchParams(previous);
    if (value === defaultValue) next.delete(key); else next.set(key, value);
    return next;
  }, { replace: true, state: location.state });
  const clearFilters = () => setParams(previous => {
    const next = new URLSearchParams(previous);
    ["q", "filter", "sort"].forEach(key => next.delete(key));
    return next;
  }, { replace: true, state: location.state });
  const [controlsOpen, setControlsOpen] = useState(false);
  const activeFilters = Boolean(query || filter !== "all" || sort !== "updated_desc");
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
      <div className="collection-heading">
        <div className="min-w-0">
          {showTitle && <h1 className="font-display text-3xl font-bold tracking-tight">Book Lists</h1>}
          <p className="text-sm text-muted-foreground">{hasLoaded ? `${lists.length}${hasMore ? "+" : ""} ${lists.length === 1 ? "collection" : "collections"} to make your own` : "Your reading collections"}</p>
        </div>
        <button type="button" ref={createTrigger} disabled={busy} onClick={event => openCreate(event.currentTarget)} className="library-filled-control">
          <AppIcon icon={APP_ICONS.common.add} variant="inline" size="sm" />Create List
        </button>
      </div>
      {operation === "duplicate" && <p role="status" className="text-sm text-muted-foreground">Copying your list...</p>}
      {duplicateError && <p role="alert" className="text-sm text-destructive">{duplicateError}</p>}
      {!showEmpty && (!error || hasLoaded) && <section className="space-y-3" aria-label="Find a list">
        <div className="library-search-row">
          <div className="library-search-field">
            <AppIcon icon={APP_ICONS.common.search} variant="inline" className="shrink-0 text-muted-foreground" />
            <input type="search" aria-label="Search lists" disabled={busy} value={query} onChange={event => setContext("q", event.target.value)}
              placeholder="Find a collection" className="library-search-input" />
            {query && <button type="button" className="library-icon-control" disabled={busy} aria-label="Clear search" onClick={() => setContext("q", "")}><APP_ICONS.common.close aria-hidden="true" className="size-5" /></button>}
          </div>
          <Dialog open={controlsOpen} onOpenChange={setControlsOpen}>
            <DialogTrigger asChild><button type="button" className="library-text-control" disabled={busy} aria-label="List controls">
              <APP_ICONS.library.filter aria-hidden="true" className="size-5 shrink-0" />Filter &amp; sort
              {activeFilters && <span className="size-2 rounded-full bg-primary" aria-hidden="true" />}
            </button></DialogTrigger>
            <AdaptiveDialogContent size="regular" className="library-controls-sheet">
              <AdaptiveDialogHeader><AdaptiveDialogTitle>List controls</AdaptiveDialogTitle><AdaptiveDialogDescription>Choose which collections to show. Changes apply immediately.</AdaptiveDialogDescription></AdaptiveDialogHeader>
              <AdaptiveDialogBody className="space-y-6">
                <fieldset className="space-y-3" disabled={busy}><legend className="font-semibold">Show lists</legend>
                  <div className="collection-filter-options">{FILTERS.map(option => <button type="button" key={option.value} className="library-text-control" aria-pressed={filter === option.value}
                    onClick={() => setContext("filter", option.value, "all")}>{option.label}</button>)}</div>
                </fieldset>
                <label className="grid gap-3 font-semibold">Sort lists<select className="collection-select" disabled={busy} value={sort} onChange={event => setContext("sort", event.target.value, "updated_desc")}>
                  {SORTS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select></label>
                {activeFilters && <button type="button" disabled={busy} className="library-text-control" onClick={clearFilters}>Clear filters</button>}
              </AdaptiveDialogBody>
              <AdaptiveDialogFooter><DialogClose asChild><button type="button" className="library-filled-control">Show lists</button></DialogClose></AdaptiveDialogFooter>
            </AdaptiveDialogContent>
          </Dialog>
        </div>
        <p className="text-sm text-muted-foreground">{loading ? "Loading collections" : `${filteredLists.length} ${filteredLists.length === 1 ? "list" : "lists"}${hasMore ? " in loaded collections" : ""} / ${FILTERS.find(option => option.value === filter)?.label} / ${SORTS.find(option => option.value === sort)?.label}`}</p>
      </section>}

      {error && <LoadingError message={error} onRetry={() => void refresh()} />}
      {loading ? <BookListGridSkeleton /> : !hasLoaded && error ? null : showEmpty ? (
        <EmptyListsState />
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
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="collection-grid">
          {filteredLists.map((list) => (
            <BookListOverviewCard
              key={list.id}
              list={list}
              disabled={busy}
              onEdit={trigger => openEdit(list, trigger)}
              onDuplicate={() => handleDuplicate(list)}
              onDelete={trigger => openDelete(list, trigger)}
            />
          ))}
        </div>
      )}

      {hasMore && lists.length > 0 && (
        <div ref={loadMoreRef} className="py-8">
          <button type="button" className="library-text-control" disabled={busy || loadingMore} onClick={() => void loadMore()}>Load more lists</button>
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

export const BookListManager = ({ userId, showTitle }: BookListManagerProps) => <BookListManagerContent key={userId} userId={userId} showTitle={showTitle} />;

export const BookListOverviewCard = ({ list, onEdit, onDuplicate, onDelete, disabled = false }: {
  list: BookList;
  onEdit: (trigger: HTMLButtonElement | null) => void;
  onDuplicate: () => void;
  onDelete: (trigger: HTMLButtonElement | null) => void;
  disabled?: boolean;
}) => {
  const actionTrigger = useRef<HTMLButtonElement>(null);
  const count = list.book_count || 0;
  return <article className="collection-row">
    <Link to={`/lists/${list.id}`} aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined}
      onClick={event => { if (disabled) event.preventDefault(); }} className="collection-destination" aria-label={`Open ${list.name}`}>
      <span className="collection-mark" aria-hidden="true"><APP_ICONS.nav.lists className="size-7" /></span>
      <div className="min-w-0">
        <p className="collection-meta">{count} {count === 1 ? "book" : "books"} / {list.is_public ? "Public" : "Private"}</p>
        <h2 className="collection-title">{list.name}</h2>
        <p className="collection-description">{list.description || (count === 0 ? "A place for your next reading collection." : "Your books, brought together.")}</p>
        <p className="collection-date">Updated {formatDate(list.updated_at)}</p>
      </div>
    </Link>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><button type="button" ref={actionTrigger} disabled={disabled} className="library-icon-control collection-actions" aria-label={`Actions for ${list.name}`}>
        <AppIcon icon={APP_ICONS.common.more} variant="action" />
      </button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={disabled} onSelect={() => onEdit(actionTrigger.current)}><AppIcon icon={APP_ICONS.common.edit} variant="inline" size="sm" className="mr-2" />Edit</DropdownMenuItem>
        <DropdownMenuItem disabled={disabled} onSelect={onDuplicate}><AppIcon icon={APP_ICONS.common.copy} variant="inline" size="sm" className="mr-2" />Duplicate</DropdownMenuItem>
        <DropdownMenuItem disabled={disabled} onSelect={() => onDelete(actionTrigger.current)} className="text-destructive focus:text-destructive"><AppIcon icon={APP_ICONS.common.delete} variant="inline" size="sm" className="mr-2" />Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </article>;
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

const EmptyListsState = () => (
  <PremiumEmptyState
    asset="emptyLists"
    title="Create your first list"
    description="Build a reading plan, save recommendations, or collect books for a club discussion. Use Create List above to begin."
  />
);
