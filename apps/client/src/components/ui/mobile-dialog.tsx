import * as React from "react";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { AdaptiveDialogContent, AdaptiveDialogHeader, AdaptiveDialogTitle, AdaptiveDialogDescription, AdaptiveDialogBody, AdaptiveDialogFooter } from "@/components/ui/adaptive-dialog";
import { Button } from "@/components/ui/button";

interface MobileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  showClose?: boolean;
}

export const MobileDialog = ({ open, onOpenChange, trigger, title = "Reading task", description,
  children, footer, className, contentClassName, showClose = true }: MobileDialogProps) => {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
    <AdaptiveDialogContent size="compact" className={contentClassName} showClose={showClose}
      {...(!description ? { "aria-describedby": undefined } : {})}>
      <AdaptiveDialogHeader>
        <AdaptiveDialogTitle>{title}</AdaptiveDialogTitle>
        {description && <AdaptiveDialogDescription>{description}</AdaptiveDialogDescription>}
      </AdaptiveDialogHeader>
      <AdaptiveDialogBody className={className}>{children}</AdaptiveDialogBody>
      {footer && <AdaptiveDialogFooter>{footer}</AdaptiveDialogFooter>}
    </AdaptiveDialogContent>
  </Dialog>;
};

interface MobileAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  cancelText?: string;
  confirmText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  variant?: "default" | "destructive";
  children?: React.ReactNode;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export const MobileAlertDialog = ({ open, onOpenChange, title, description, cancelText = "Cancel",
  confirmText = "Confirm", onConfirm, onCancel, variant = "default", children, returnFocusRef }: MobileAlertDialogProps) => {
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const returnFocus = React.useRef<HTMLElement | null>(null);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <AdaptiveDialogContent size="compact" {...(!description ? { "aria-describedby": undefined } : {})}
      onOpenAutoFocus={(event) => {
        returnFocus.current = document.activeElement as HTMLElement | null;
        event.preventDefault();
        cancelRef.current?.focus();
      }}
      onCloseAutoFocus={(event) => {
        const invoker = returnFocusRef?.current ?? returnFocus.current;
        if (invoker?.isConnected) {
          event.preventDefault();
          invoker.focus();
        }
      }}>
      <AdaptiveDialogHeader>
        <AdaptiveDialogTitle>{title}</AdaptiveDialogTitle>
        {description && <AdaptiveDialogDescription>{description}</AdaptiveDialogDescription>}
      </AdaptiveDialogHeader>
      {children && <AdaptiveDialogBody>{children}</AdaptiveDialogBody>}
      <AdaptiveDialogFooter>
        <Button ref={cancelRef} type="button" variant="outline" onClick={() => { onCancel?.(); onOpenChange(false); }}>{cancelText}</Button>
        <Button type="button" variant={variant === "destructive" ? "destructive" : "default"}
          className={variant === "destructive" ? "border border-destructive bg-background text-foreground hover:bg-destructive/10 hover:text-foreground" : undefined}
          onClick={() => { onConfirm(); onOpenChange(false); }}>{confirmText}</Button>
      </AdaptiveDialogFooter>
    </AdaptiveDialogContent>
  </Dialog>;
};
