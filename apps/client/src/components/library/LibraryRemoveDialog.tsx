import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { MobileDialog } from "@/components/ui/mobile-dialog";
import { Button } from "@/components/ui/button";

interface LibraryRemoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => Promise<void> | void;
  confirmText?: string;
  cancelText?: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/** Keep the actual removal task open until its existing service confirms it. */
export function LibraryRemoveDialog({ open, onOpenChange, title, description, onConfirm,
  confirmText = "Delete", cancelText = "Keep book", returnFocusRef }: LibraryRemoveDialogProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const generation = useRef(0);
  useLayoutEffect(() => {
    generation.current += 1;
    locked.current = false;
    setPending(false);
    setError(null);
    return () => { generation.current += 1; };
  }, [open]);
  const remove = async () => {
    if (locked.current) return;
    locked.current = true;
    const current = generation.current;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      if (current === generation.current) onOpenChange(false);
    } catch (failure) {
      if (current === generation.current) setError(failure instanceof Error ? failure.message : "Couldn't remove this item. Please try again.");
    } finally {
      if (current === generation.current) { locked.current = false; setPending(false); }
    }
  };
  return <MobileDialog open={open} onOpenChange={next => { if (!locked.current) onOpenChange(next); }}
    title={title} description={description} returnFocusRef={returnFocusRef}
    footer={<>
      <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>{cancelText}</Button>
      <Button type="button" variant="outline" disabled={pending} className="border-destructive text-foreground hover:bg-destructive/10"
        onClick={() => void remove()}>{pending ? "Removing…" : confirmText}</Button>
    </>}>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {pending && <p role="status" className="text-sm text-muted-foreground">Saving this change. Please wait.</p>}
  </MobileDialog>;
}
