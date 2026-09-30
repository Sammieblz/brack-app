import { forwardRef, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ComponentPropsWithoutRef, type ReactNode, type RefObject } from "react";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { AdaptiveDialogBody, AdaptiveDialogContent, AdaptiveDialogDescription, AdaptiveDialogFooter, AdaptiveDialogHeader, AdaptiveDialogTitle } from "@/components/ui/adaptive-dialog";
import { MobileAlertDialog } from "@/components/ui/mobile-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useBooks } from "@/hooks/useBooks";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "iconoir-react";
import { addBookToList, fetchBookIdsInList } from "@/services/api";

interface AddBooksToListDialogProps {
  listId: string;
  userId: string;
  onBooksAdded?: () => void | Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Use null when a responsive parent owns the invoker. */
  trigger?: ReactNode;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export const AddBooksToListDialogTrigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof Button>>(
  (props, ref) => <Button ref={ref} type="button" {...props}><Plus className="mr-2 h-4 w-4" aria-hidden="true" />Add Books</Button>,
);
AddBooksToListDialogTrigger.displayName = "AddBooksToListDialogTrigger";

export const AddBooksToListDialog = (props: AddBooksToListDialogProps) => {
  const { user, loading } = useAuth();
  const scope = !loading && user?.id === props.userId ? JSON.stringify([props.userId, props.listId]) : null;
  const previousScope = useRef(scope);
  const scopeChanged = previousScope.current !== scope;
  const { onOpenChange } = props;
  useEffect(() => {
    if (previousScope.current !== scope) { previousScope.current = scope; onOpenChange?.(false); }
  }, [scope, onOpenChange]);
  return scope ? <AddBooksToListTask key={scope} {...props} open={scopeChanged && props.open !== undefined ? false : props.open} /> : null;
};

const AddBooksToListTask = ({ listId, userId, onBooksAdded, open: controlledOpen, onOpenChange, trigger, returnFocusRef }: AddBooksToListDialogProps) => {
  const id = useId();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => { if (controlledOpen === undefined) setInternalOpen(next); onOpenChange?.(next); };
  const { books, loading, error: booksError, hasLoaded, hasMore, loadingMore, loadMore, refetchBooks } = useBooks(userId, open);
  const { toast } = useToast();
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
  const [memberships, setMemberships] = useState<Set<string> | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const discardInvoker = useRef<HTMLElement | null>(null);
  const mounted = useRef(false);
  const pending = useRef(false);
  const generation = useRef(0);
  const openRef = useRef(open);
  openRef.current = open;
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current += 1; };
  }, []);
  const isCurrent = useCallback((request: number) => mounted.current && openRef.current && generation.current === request, []);
  const loadMemberships = useCallback(async () => {
    if (pending.current) return;
    const request = ++generation.current;
    setMemberships(null);
    setLookupError(null);
    try {
      const existing = new Set(await fetchBookIdsInList(listId));
      if (!isCurrent(request)) return;
      setMemberships(existing);
      setSelectedBooks(previous => new Set([...previous].filter(bookId => !existing.has(bookId))));
    } catch {
      if (isCurrent(request)) setLookupError("We couldn't check the books already in this list. Try again before adding books.");
    }
  }, [listId, isCurrent]);
  useEffect(() => {
    pending.current = false;
    setSaving(false);
    if (open) void loadMemberships();
    else { setSelectedBooks(new Set()); setMemberships(null); setSaveError(null); setLookupError(null); setDiscardOpen(false); }
    return () => { generation.current += 1; };
  }, [open, loadMemberships]);

  const requestOpenChange = (next: boolean) => {
    if (pending.current) return;
    if (!next && selectedBooks.size > 0) {
      discardInvoker.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setDiscardOpen(true);
      return;
    }
    setOpen(next);
  };
  const refreshParent = () => {
    // Both a complete batch and a partial batch can change the parent's empty
    // state. Refresh errors do not undo a confirmed membership or its outcome.
    try {
      void Promise.resolve(onBooksAdded?.()).catch(error => console.error("Books were added, but the list could not refresh:", error));
    } catch (error) {
      console.error("Books were added, but the list could not refresh:", error);
    }
  };
  const handleAddBooks = async () => {
    if (!mounted.current || !openRef.current || pending.current || !memberships || !hasLoaded || discardOpen || selectedBooks.size === 0) return;
    const submitted = [...selectedBooks].filter(bookId => !memberships.has(bookId));
    if (submitted.length === 0) return;
    pending.current = true;
    setSaving(true);
    setSaveError(null);
    const request = generation.current;
    let completed = 0;
    try {
      // The existing bulk service performs these same sequential writes. Owning
      // each confirmation lets a partial failure retain only the remaining work.
      for (const bookId of submitted) {
        await addBookToList(listId, bookId);
        if (!isCurrent(request)) return;
        completed += 1;
        setMemberships(previous => new Set(previous).add(bookId));
        setSelectedBooks(previous => { const next = new Set(previous); next.delete(bookId); return next; });
      }
    } catch (error) {
      if (!isCurrent(request)) return;
      const message = error instanceof Error ? error.message : "Couldn't add the remaining books.";
      setSaveError(`${completed > 0 ? `${completed} book(s) added. ` : ""}${message} Your remaining selection is kept. Retry to add the remaining books.`);
      if (completed > 0) refreshParent();
      return;
    } finally {
      if (isCurrent(request)) { pending.current = false; setSaving(false); }
    }
    if (!isCurrent(request)) return;
    toast({ title: "Books added", description: `${completed} book(s) added to the list` });
    setOpen(false);
    refreshParent();
  };
  const ready = memberships !== null && hasLoaded && !loading;
  const availableBooks = memberships ? books.filter(book => !memberships.has(book.id)) : [];

  return <Dialog open={open} onOpenChange={requestOpenChange}>
    {trigger !== null && <DialogTrigger asChild>{trigger ?? <AddBooksToListDialogTrigger />}</DialogTrigger>}
    <AdaptiveDialogContent size="wide" showClose={!saving} onCloseAutoFocus={event => {
      if (returnFocusRef?.current?.isConnected) { event.preventDefault(); returnFocusRef.current.focus(); }
    }}>
      <AdaptiveDialogHeader>
        <AdaptiveDialogTitle>Add Books to List</AdaptiveDialogTitle>
        <AdaptiveDialogDescription>Select books from your library. Books already in this list are excluded.</AdaptiveDialogDescription>
      </AdaptiveDialogHeader>
      <AdaptiveDialogBody className="space-y-4">
        {loading && <p role="status" className="text-sm text-muted-foreground">Loading your library...</p>}
        {booksError && <div className="space-y-2"><p role="alert" id={`${id}-books-error`} className="text-sm text-destructive">{booksError}</p><Button type="button" variant="outline" className="h-auto max-w-full whitespace-normal" disabled={saving || loading} aria-describedby={`${id}-books-error`} onClick={() => void refetchBooks()}>Retry library</Button></div>}
        {memberships === null && !lookupError && <p role="status" className="text-sm text-muted-foreground">Checking list membership...</p>}
        {lookupError && <div className="space-y-2"><p role="alert" id={`${id}-lookup-error`} className="text-sm text-destructive">{lookupError}</p><Button type="button" variant="outline" className="h-auto max-w-full whitespace-normal" aria-describedby={`${id}-lookup-error`} onClick={() => void loadMemberships()}>Retry membership</Button></div>}
        {ready && availableBooks.length === 0 && <p className="py-4 text-sm text-muted-foreground">{books.length === 0 ? "Your library has no books to add yet." : "All your books are already in this list"}</p>}
        {memberships && books.length > 0 && <div role="group" aria-label="Books to add" aria-describedby={saveError ? `${id}-save-error` : undefined} className="space-y-3">
          {availableBooks.map(book => <div key={book.id} className="flex min-h-11 items-start gap-3 rounded-lg border p-3">
            <Checkbox id={`${id}-${book.id}`} checked={selectedBooks.has(book.id)} disabled={!ready || saving || discardOpen} aria-labelledby={`${id}-${book.id}-title`}
              onCheckedChange={checked => { if (pending.current) return; setSelectedBooks(previous => { const next = new Set(previous); if (checked === true) next.add(book.id); else next.delete(book.id); return next; }); }} />
            <label htmlFor={`${id}-${book.id}`} className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
              {book.cover_url && <img src={book.cover_url} alt="" className="h-16 w-12 shrink-0 rounded object-cover" />}
              <span className="min-w-0 flex-1"><span id={`${id}-${book.id}-title`} className="block font-serif font-medium">{book.title}</span>
                {book.author && <span className="block font-serif text-sm text-muted-foreground">{book.author}</span>}
                {book.genre && <span className="mt-1 block text-xs text-muted-foreground">{book.genre}</span>}
              </span>
            </label>
          </div>)}
        </div>}
        {hasMore && <Button type="button" variant="outline" className="h-auto max-w-full whitespace-normal" disabled={saving || loadingMore || loading} onClick={() => void loadMore()}>{loadingMore ? "Loading more books..." : "Load more books"}</Button>}
        {saveError && <p id={`${id}-save-error`} role="alert" className="text-sm text-destructive">{saveError}</p>}
        {saving && <p role="status" className="text-sm text-muted-foreground">Adding selected books...</p>}
        <p className="text-sm text-muted-foreground">{selectedBooks.size} book(s) selected</p>
      </AdaptiveDialogBody>
      <AdaptiveDialogFooter>
        <Button type="button" variant="outline" disabled={saving || discardOpen} onClick={() => requestOpenChange(false)}>Cancel</Button>
        <Button type="button" disabled={!ready || selectedBooks.size === 0 || saving || discardOpen} aria-describedby={saveError ? `${id}-save-error` : undefined} onClick={() => void handleAddBooks()}>{saving ? "Adding..." : selectedBooks.size > 0 ? `Add (${selectedBooks.size})` : "Add"}</Button>
      </AdaptiveDialogFooter>
      <MobileAlertDialog open={discardOpen} onOpenChange={setDiscardOpen} title="Discard book selection?" description="The selected books have not been added. Keep selecting to retain this selection."
        cancelText="Keep selecting" confirmText="Discard selection" variant="destructive" returnFocusRef={discardInvoker}
        onConfirm={() => { if (!pending.current) { setSelectedBooks(new Set()); setOpen(false); } }} />
    </AdaptiveDialogContent>
  </Dialog>;
};
