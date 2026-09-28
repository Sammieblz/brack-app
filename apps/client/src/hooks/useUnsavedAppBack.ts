import { useConfirmDialog } from "@/contexts/ConfirmDialogContext";
import { useAppBackGuard } from "@/hooks/useAppBackGuard";

/** Guard app/native Back only. Browser navigation remains the browser's operation. */
export function useUnsavedAppBack({ dirty, pending }: { dirty: boolean; pending: boolean }): void {
  const confirm = useConfirmDialog();
  useAppBackGuard(dirty || pending, () => {
    if (pending) return false;
    return confirm({ title: "Discard unsaved changes?", description: "Your changes have not been saved. Keep editing to retain them.",
      confirmText: "Discard changes", cancelText: "Keep editing", variant: "destructive" });
  });
}
