import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmDialogContext = createContext<ConfirmContextValue | undefined>(undefined);

export const ConfirmDialogProvider = ({ children }: { children: ReactNode }) => {
  const [pending, setPending] = useState<{ options: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve });
    });
  }, []);

  const handleClose = (result: boolean) => {
    if (pending) {
      pending.resolve(result);
      setPending(null);
    }
  };

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}

      <Dialog open={!!pending} onOpenChange={(open) => !open && handleClose(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pending?.options.title ?? "Are you sure?"}</DialogTitle>
            {pending?.options.description && (
              <DialogDescription>{pending.options.description}</DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => handleClose(false)}>
              {pending?.options.cancelText ?? "Cancel"}
            </Button>
            <Button onClick={() => handleClose(true)} autoFocus>
              {pending?.options.confirmText ?? "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmDialogContext.Provider>
  );
};

export const useConfirmDialog = () => {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    throw new Error("useConfirmDialog must be used within ConfirmDialogProvider");
  }
  return ctx.confirm;
};
