import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { AdaptiveDialogBody, AdaptiveDialogContent, AdaptiveDialogDescription, AdaptiveDialogFooter, AdaptiveDialogHeader, AdaptiveDialogTitle } from "@/components/ui/adaptive-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useBookLists } from "@/hooks/useBookLists";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "iconoir-react";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { fetchListIdsContainingBook } from "@/services/api";

interface AddToListDialogProps {
  bookId: string;
  userId: string;
  trigger?: ReactNode;
  triggerTooltip?: string;
}

export const AddToListDialog = (props: AddToListDialogProps) => {
  const { user, loading } = useAuth();
  if (loading || user?.id !== props.userId) return null;
  return <AddToListTask key={JSON.stringify([props.userId, props.bookId])} {...props} />;
};

const AddToListTask = ({ bookId, userId, trigger, triggerTooltip }: AddToListDialogProps) => {
  const id = useId();
  const [open, setOpen] = useState(false);
  const { lists, loading, error: listError, hasLoaded, hasMore, loadingMore, loadMore, refetch, addBookToList, removeBookFromList } = useBookLists(open ? userId : undefined);
  const { toast } = useToast();
  const { triggerHaptic } = useHapticFeedback();
  const [memberships, setMemberships] = useState<Set<string> | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<{ listId: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
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
      const next = await fetchListIdsContainingBook(bookId);
      if (isCurrent(request)) setMemberships(new Set(next));
    } catch {
      if (isCurrent(request)) setLookupError("We couldn't check which lists contain this book. Try again before changing membership.");
    }
  }, [bookId, isCurrent]);
  useEffect(() => {
    if (open) void loadMemberships();
    return () => { generation.current += 1; };
  }, [open, loadMemberships]);

  const requestOpenChange = (next: boolean) => {
    if (pending.current) return;
    generation.current += 1;
    setMemberships(null);
    setLookupError(null);
    setMutationError(null);
    setOpen(next);
  };
  const toggleList = async (listId: string, checked: boolean) => {
    if (!mounted.current || !openRef.current || pending.current || !memberships || !hasLoaded || memberships.has(listId) === checked) return;
    pending.current = true;
    setSaving(true);
    setMutationError(null);
    const request = generation.current;
    try {
      if (checked) await addBookToList(listId, bookId);
      else await removeBookFromList(listId, bookId);
      if (!isCurrent(request)) return;
      setMemberships(previous => {
        const next = new Set(previous);
        if (checked) next.add(listId); else next.delete(listId);
        return next;
      });
      triggerHaptic(checked ? "success" : "medium");
      toast({ title: checked ? "Added to list" : "Removed from list", description: checked ? "Book has been added to the list" : "Book has been removed from the list" });
    } catch (error) {
      if (!isCurrent(request)) return;
      setMutationError({ listId, message: error instanceof Error ? error.message : "We couldn't update this list. Try the checkbox again." });
      triggerHaptic("error");
    } finally {
      if (isCurrent(request)) { pending.current = false; setSaving(false); }
    }
  };
  const ready = memberships !== null && hasLoaded && !loading;
  const dialogTrigger = <DialogTrigger asChild>{trigger ?? <Button type="button" variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" aria-hidden="true" />Add to List</Button>}</DialogTrigger>;

  return <Dialog open={open} onOpenChange={requestOpenChange}>
    {triggerTooltip ? <Tooltip><TooltipTrigger asChild>{dialogTrigger}</TooltipTrigger><TooltipContent>{triggerTooltip}</TooltipContent></Tooltip> : dialogTrigger}
    <AdaptiveDialogContent size="compact" showClose={!saving}>
      <AdaptiveDialogHeader>
        <AdaptiveDialogTitle>Add to Lists</AdaptiveDialogTitle>
        <AdaptiveDialogDescription>Choose the lists for this book. Each change saves immediately.</AdaptiveDialogDescription>
      </AdaptiveDialogHeader>
      <AdaptiveDialogBody className="space-y-4">
        {loading && <p role="status" className="text-sm text-muted-foreground">Loading lists...</p>}
        {listError && <div className="space-y-2"><p role="alert" id={`${id}-lists-error`} className="text-sm text-destructive">{listError}</p><Button type="button" variant="outline" className="h-auto max-w-full whitespace-normal" disabled={saving || loading} aria-describedby={`${id}-lists-error`} onClick={() => void refetch()}>Retry lists</Button></div>}
        {memberships === null && !lookupError && <p role="status" className="text-sm text-muted-foreground">Checking list membership...</p>}
        {lookupError && <div className="space-y-2"><p role="alert" id={`${id}-lookup-error`} className="text-sm text-destructive">{lookupError}</p><Button type="button" variant="outline" className="h-auto max-w-full whitespace-normal" aria-describedby={`${id}-lookup-error`} onClick={() => void loadMemberships()}>Retry membership</Button></div>}
        {ready && lists.length === 0 && <div className="space-y-4 py-4"><p className="text-sm text-muted-foreground">You haven't created any lists yet</p><Button asChild className="h-auto whitespace-normal"><Link to="/lists">Create a List</Link></Button></div>}
        {memberships && lists.length > 0 && <div role="group" aria-label="Book list memberships" className="space-y-2">
          {lists.map(list => <div key={list.id} className="flex min-h-11 items-center gap-3 rounded-lg border p-3">
            <Checkbox id={`${id}-${list.id}`} checked={memberships?.has(list.id) ?? false} disabled={!ready || saving}
              aria-labelledby={`${id}-${list.id}-name`} aria-describedby={mutationError?.listId === list.id ? `${id}-mutation-error` : list.description ? `${id}-${list.id}-description` : undefined}
              onCheckedChange={checked => void toggleList(list.id, checked === true)} />
            <label htmlFor={`${id}-${list.id}`} className="min-w-0 flex-1 cursor-pointer py-1 text-sm">
              <span id={`${id}-${list.id}-name`} className="block font-medium">{list.name}</span>
              {list.description && <span id={`${id}-${list.id}-description`} className="mt-1 block text-xs text-muted-foreground">{list.description}</span>}
            </label>
          </div>)}
        </div>}
        {mutationError && <p id={`${id}-mutation-error`} role="alert" className="text-sm text-destructive">{mutationError.message} Your selection is unchanged. Try the checkbox again.</p>}
        {saving && <p role="status" className="text-sm text-muted-foreground">Saving list membership...</p>}
        {hasMore && <Button type="button" variant="outline" className="h-auto max-w-full whitespace-normal" disabled={saving || loadingMore || loading} onClick={() => void loadMore()}>{loadingMore ? "Loading more lists..." : "Load more lists"}</Button>}
      </AdaptiveDialogBody>
      <AdaptiveDialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => requestOpenChange(false)}>Done</Button></AdaptiveDialogFooter>
    </AdaptiveDialogContent>
  </Dialog>;
};
