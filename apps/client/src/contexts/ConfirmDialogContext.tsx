import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { MobileAlertDialog } from "@/components/ui/mobile-dialog";

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

      <MobileAlertDialog
        open={!!pending}
        onOpenChange={(open) => !open && handleClose(false)}
        title={pending?.options.title ?? "Are you sure?"}
        description={pending?.options.description}
        cancelText={pending?.options.cancelText ?? "Cancel"}
        confirmText={pending?.options.confirmText ?? "Confirm"}
        onConfirm={() => handleClose(true)}
        onCancel={() => handleClose(false)}
      />
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
