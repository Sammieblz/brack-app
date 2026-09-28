import { useLayoutEffect, useRef, useState } from "react";
import { Plus } from "iconoir-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ActionSheet } from "@/components/ui/action-sheet";
import { Dialog } from "@/components/ui/dialog";
import {
  AdaptiveDialogBody, AdaptiveDialogContent, AdaptiveDialogDescription,
  AdaptiveDialogHeader, AdaptiveDialogTitle,
} from "@/components/ui/adaptive-dialog";
import { useTimer } from "@/contexts/TimerContext";
import { useAuth } from "@/hooks/useAuth";
import { useBooks } from "@/hooks/useBooks";
import { FloatingQuickStatsWidget } from "./FloatingQuickStatsWidget";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { LoadingError, LoadingRegion } from "@/components/loading/LoadingRegion";
import { Skeleton } from "@/components/ui/skeleton";
import { APP_ICONS } from "@/config/iconography";
import { useUIEnvironmentValue } from "@/hooks/useUIEnvironment";

export const FloatingActionButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showTimerSheet, setShowTimerSheet] = useState(false);
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
  const returnFocusRef = compactNavigation ? triggerRef : fallbackFocusRef;
  const navigate = useNavigate();
  const { startTimer } = useTimer();
  const { user } = useAuth();
  const { books, loading, refreshing, hasLoaded, error, refetchBooks } = useBooks(user?.id);
  const readingBooks = books.filter((book) => book.status === "reading");
  const actions = [
    { label: "Add Book", icon: <APP_ICONS.floatingAction.addBook className="size-5" />, onClick: () => navigate("/add-book") },
    { label: "Search Books", icon: <APP_ICONS.floatingAction.search className="size-5" />, onClick: () => navigate("/add-book") },
    { label: "Scan Barcode", icon: <APP_ICONS.floatingAction.scanBarcode className="size-5" />, onClick: () => navigate("/scan-barcode") },
    { label: "Scan Cover", icon: <APP_ICONS.floatingAction.scanCover className="size-5" />, onClick: () => navigate("/scan-cover") },
    { label: "Start Reading Timer", icon: <APP_ICONS.floatingAction.timer className="size-5" />, onClick: () => setShowTimerSheet(true) },
    { label: "Quick Stats", icon: <APP_ICONS.floatingAction.quickStats className="size-5" />, onClick: () => setShowQuickStats(true) },
    { label: "Reading History", icon: <APP_ICONS.floatingAction.history className="size-5" />, onClick: () => navigate("/history") },
  ];

  return <>
    <div className="fixed right-4 z-40 max-w-[calc(100%-2rem)]" data-shell-float="action" hidden={!compactNavigation}>
      <Button ref={triggerRef} type="button" variant="outline"
        className="h-auto min-h-11 gap-2 whitespace-normal rounded-full bg-background px-4 py-2 shadow-sm hover:translate-y-0"
        aria-haspopup="dialog" aria-expanded={isOpen} onClick={() => setIsOpen(true)}>
        <Plus aria-hidden="true" /><span>Quick actions</span>
      </Button>
    </div>
    <ActionSheet title="Quick actions" description="Add a book, start reading or review your progress."
      open={isOpen} onOpenChange={setIsOpen} returnFocusRef={returnFocusRef} openHaptic={false} actions={actions} />
    <Dialog open={showTimerSheet} onOpenChange={setShowTimerSheet}>
      <AdaptiveDialogContent size="compact" openHaptic={false}
        onCloseAutoFocus={(event) => {
          if (!returnFocusRef.current?.isConnected) return;
          event.preventDefault();
          const activeDialog = document.activeElement?.closest('[role="dialog"], [role="alertdialog"]');
          if (activeDialog && activeDialog !== event.target && activeDialog.getAttribute("data-state") !== "closed") return;
          returnFocusRef.current.focus();
        }}>
        <AdaptiveDialogHeader>
          <AdaptiveDialogTitle>Start reading timer</AdaptiveDialogTitle>
          <AdaptiveDialogDescription>Choose a book you are currently reading.</AdaptiveDialogDescription>
        </AdaptiveDialogHeader>
        <AdaptiveDialogBody>
          <LoadingRegion loading={loading} refreshing={refreshing} label="Loading books for the reading timer">
            {error && <LoadingError message="Reading books could not be refreshed." onRetry={() => void refetchBooks()} />}
            {loading ? <div className="space-y-3" aria-hidden="true">
              {[0, 1, 2].map((index) => <Skeleton key={index} className="h-16 w-full" />)}
            </div> : error && !hasLoaded ? null : readingBooks.length > 0 ? <div className="space-y-2">
              {readingBooks.map((book) => <Button key={book.id} type="button" variant="ghost"
                className="h-auto min-h-16 w-full justify-start gap-3 whitespace-normal rounded-lg px-3 py-3 text-left"
                onClick={() => {
                  // The timer provider owns replacement confirmation, permission
                  // prompts and the actual start outcome.
                  startTimer(book.id, book.title);
                  setShowTimerSheet(false);
                }}>
                {book.cover_url ? <img src={book.cover_url} alt="" className="h-14 w-10 shrink-0 rounded object-cover" />
                  : <APP_ICONS.floatingAction.bookFallback className="!size-6 shrink-0 text-muted-foreground" aria-hidden="true" />}
                <span className="min-w-0">
                  <span className="block break-words font-serif font-semibold">{book.title}</span>
                  {book.author && <span className="block break-words font-serif text-sm text-muted-foreground">{book.author}</span>}
                  {typeof book.current_page === "number" && book.pages ? <span className="block font-sans text-xs text-muted-foreground">
                    Page {book.current_page} of {book.pages}
                  </span> : null}
                </span>
              </Button>)}
            </div> : <PremiumEmptyState asset="emptyLibrary" title="No books currently being read"
              description='Mark a book as "Reading" to start tracking time.' variant="plain" size="compact"
              action={<Button type="button" onClick={() => { setShowTimerSheet(false); navigate("/add-book"); }}>Add Book</Button>} />}
          </LoadingRegion>
        </AdaptiveDialogBody>
      </AdaptiveDialogContent>
    </Dialog>
    <FloatingQuickStatsWidget isVisible={showQuickStats} onClose={() => setShowQuickStats(false)} returnFocusRef={returnFocusRef} />
  </>;
};
