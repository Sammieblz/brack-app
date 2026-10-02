import { useLayoutEffect, useRef, useState } from "react";
import { Plus } from "iconoir-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ActionSheet } from "@/components/ui/action-sheet";
import { useReadingSessionTasks } from "@/components/reading-session/ReadingSessionTasks";
import { FloatingQuickStatsWidget } from "./FloatingQuickStatsWidget";
import { APP_ICONS } from "@/config/iconography";
import { useUIEnvironmentValue } from "@/hooks/useUIEnvironment";

export const FloatingActionButton = ({ placement = "floating" }: { placement?: "floating" | "inline" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showQuickStats, setShowQuickStats] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fallbackFocusRef = useRef<HTMLElement | null>(null);
  const compactNavigation = useUIEnvironmentValue((environment) => environment.windowClass !== "expanded");
  useLayoutEffect(() => {
    if (compactNavigation) return;
    // An open task remains mounted when the expanded header takes over.
    // Its closing focus must go to visible page content, not the hidden button.
    const fallback = document.querySelector<HTMLElement>("[data-app-scroll-container] h1")
      ?? document.querySelector<HTMLElement>("[data-app-scroll-container]");
    if (fallback && !fallback.hasAttribute("tabindex")) fallback.tabIndex = -1;
    fallbackFocusRef.current = fallback;
    return () => { fallbackFocusRef.current = null; };
  }, [compactNavigation]);
  const returnFocusRef = placement === "inline" || compactNavigation ? triggerRef : fallbackFocusRef;
  const navigate = useNavigate();
  const openTimerPicker = useReadingSessionTasks();
  const actions = [
    { label: "Add Book", icon: <APP_ICONS.floatingAction.addBook className="size-5" />, onClick: () => navigate("/add-book") },
    { label: "Search Books", icon: <APP_ICONS.floatingAction.search className="size-5" />, onClick: () => navigate("/add-book") },
    { label: "Scan Barcode", icon: <APP_ICONS.floatingAction.scanBarcode className="size-5" />, onClick: () => navigate("/scan-barcode") },
    { label: "Scan Cover", icon: <APP_ICONS.floatingAction.scanCover className="size-5" />, onClick: () => navigate("/scan-cover") },
    { label: "Start Reading Timer", icon: <APP_ICONS.floatingAction.timer className="size-5" />, onClick: () => openTimerPicker(returnFocusRef.current) },
    { label: "Quick Stats", icon: <APP_ICONS.floatingAction.quickStats className="size-5" />, onClick: () => setShowQuickStats(true) },
    { label: "Reading History", icon: <APP_ICONS.floatingAction.history className="size-5" />, onClick: () => navigate("/history") },
  ];

  return <>
    <div className={placement === "floating" ? "fixed right-4 z-40 max-w-[calc(100%-2rem)]" : "shrink-0"} data-shell-float={placement === "floating" ? "action" : undefined} hidden={placement === "floating" && !compactNavigation}>
      <Button ref={triggerRef} type="button" variant="outline"
        className={placement === "floating" ? "h-auto min-h-11 gap-2 whitespace-normal rounded-full bg-background px-4 py-2 shadow-sm hover:translate-y-0" : "h-auto min-h-11 gap-2 whitespace-normal border-0 bg-transparent px-2 py-2 shadow-none hover:translate-y-0"}
        aria-haspopup="dialog" aria-expanded={isOpen} onClick={() => setIsOpen(true)}>
        <Plus aria-hidden="true" /><span>Quick actions</span>
      </Button>
    </div>
    <ActionSheet title="Quick actions" description="Add a book, start reading or review your progress."
      open={isOpen} onOpenChange={setIsOpen} returnFocusRef={returnFocusRef} openHaptic={false} actions={actions} />
    <FloatingQuickStatsWidget isVisible={showQuickStats} onClose={() => setShowQuickStats(false)} returnFocusRef={returnFocusRef} />
  </>;
};
