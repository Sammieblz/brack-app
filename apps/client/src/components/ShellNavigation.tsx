import { createContext, useCallback, useContext, useMemo, useRef, useState, type PropsWithChildren, type RefObject } from "react";
import { Menu } from "iconoir-react";
import { ProfileDrawer } from "@/components/ProfileDrawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ShellNavigationContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: RefObject<HTMLButtonElement>;
}

const ShellNavigationContext = createContext<ShellNavigationContextValue | null>(null);

/** Mount outside responsive header branches so an open menu keeps its focus owner. */
export const ShellNavigationProvider = ({ children }: PropsWithChildren) => {
  const [open, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const setOpen = useCallback((nextOpen: boolean) => {
    if (nextOpen) setHasOpened(true);
    setIsOpen(nextOpen);
  }, []);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const value = useMemo(() => ({ open, setOpen, triggerRef }), [open, setOpen]);
  return <ShellNavigationContext.Provider value={value}>
    {children}
    {hasOpened && <ProfileDrawer open={open} onOpenChange={setOpen} returnFocusRef={triggerRef} />}
  </ShellNavigationContext.Provider>;
};

export const ShellNavigationTrigger = ({ className }: { className?: string }) => {
  const navigation = useContext(ShellNavigationContext);
  if (!navigation) return null;
  return <Button ref={navigation.triggerRef} type="button" variant="ghost" disableHaptic
    className={cn("h-auto min-h-11 shrink-0 gap-2 px-3", className)}
    aria-haspopup="dialog" aria-expanded={navigation.open}
    onClick={() => navigation.setOpen(true)}>
    <Menu className="size-5 shrink-0" aria-hidden="true" /><span>Menu</span>
  </Button>;
};
