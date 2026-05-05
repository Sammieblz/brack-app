import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Book,
  ClockRotateRight,
  JournalPage,
  NavArrowRight,
  Refresh,
  Settings,
  Trash,
  TriangleFlag,
  WarningTriangle,
} from "iconoir-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { readingCoreSync, SYNC_STATUS_EVENT } from "@/services/sync/engine";
import type { OutboxItem, SyncEntity, SyncOperation } from "@/services/sync/types";

interface SyncReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved?: () => void;
}

type PayloadPreview = {
  title: string;
  subtitle?: string;
  routeQuery?: string;
};

const ENTITY_LABELS: Record<SyncEntity, string> = {
  books: "Book",
  reading_sessions: "Timer session",
  progress_logs: "Progress log",
  journal_entries: "Journal entry",
  goals: "Goal",
  profile_preferences: "Preferences",
};

const OPERATION_LABELS: Record<SyncOperation, string> = {
  create: "Create",
  update: "Update",
  delete: "Delete",
  restore: "Restore",
};

const ENTITY_ICONS: Record<SyncEntity, typeof Book> = {
  books: Book,
  reading_sessions: ClockRotateRight,
  progress_logs: JournalPage,
  journal_entries: JournalPage,
  goals: TriangleFlag,
  profile_preferences: Settings,
};

const getText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : "");
const getNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

const previewPayload = (item: OutboxItem): PayloadPreview => {
  const payload = item.payload as Record<string, unknown>;

  switch (item.entity) {
    case "books": {
      const title = getText(payload.title) || "Untitled book";
      const author = getText(payload.author);
      const isbn = getText(payload.isbn);
      return {
        title,
        subtitle: [author, isbn ? `ISBN ${isbn}` : ""].filter(Boolean).join(" · "),
        routeQuery: title || isbn,
      };
    }
    case "reading_sessions": {
      const duration = getNumber(payload.duration) ?? getNumber(payload.duration_minutes);
      return {
        title: "Reading timer session",
        subtitle: duration ? `${duration} minutes waiting to sync` : "Session waiting to sync",
      };
    }
    case "progress_logs": {
      const page = getNumber(payload.page_number);
      return {
        title: page ? `Progress to page ${page}` : "Progress log",
        subtitle: getText(payload.notes) || "Reading progress waiting to sync",
      };
    }
    case "journal_entries":
      return {
        title: getText(payload.title) || "Journal entry",
        subtitle: getText(payload.content) || getText(payload.notes) || "Journal change waiting to sync",
      };
    case "goals":
      return {
        title: getText(payload.title) || `${getNumber(payload.target_value) ?? "Reading"} goal`,
        subtitle: getText(payload.type) || getText(payload.period) || "Goal change waiting to sync",
      };
    case "profile_preferences":
      return {
        title: "App preferences",
        subtitle: "Theme or profile preference change waiting to sync",
      };
    default:
      return { title: "Reading change" };
  }
};

const isDuplicateBookFailure = (item: OutboxItem) =>
  item.entity === "books" &&
  item.operation === "create" &&
  (item.last_error || "").toLowerCase().includes("already exists");

const canDiscardCleanly = (item: OutboxItem) =>
  item.operation === "create" || item.operation === "restore" || item.operation === "delete";

export const SyncReviewDialog = ({ open, onOpenChange, onResolved }: SyncReviewDialogProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadFailedItems = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await readingCoreSync.listFailedCurrentUser());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadFailedItems();

    const handleStatusChange = () => void loadFailedItems();
    window.addEventListener(SYNC_STATUS_EVENT, handleStatusChange);
    return () => window.removeEventListener(SYNC_STATUS_EVENT, handleStatusChange);
  }, [loadFailedItems, open]);

  const failedByType = useMemo(() => {
    return items.reduce<Record<string, number>>((acc, item) => {
      acc[item.entity] = (acc[item.entity] || 0) + 1;
      return acc;
    }, {});
  }, [items]);

  const handleRetry = async (item: OutboxItem) => {
    setResolvingId(item.id);
    try {
      const status = await readingCoreSync.retryFailedItem(item);
      await loadFailedItems();
      onResolved?.();
      toast({
        title: "Retry queued",
        description:
          status.failed === 0
            ? "That change is no longer blocked."
            : "Brack will retry the change when sync runs.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Retry failed",
        description: "The change is still saved locally and can be retried again.",
      });
    } finally {
      setResolvingId(null);
    }
  };

  const handleDiscard = async (item: OutboxItem) => {
    setResolvingId(item.id);
    try {
      await readingCoreSync.discardFailedItem(item);
      await loadFailedItems();
      onResolved?.();
      toast({
        title: item.operation === "delete" ? "Delete canceled" : "Local change discarded",
        description:
          item.operation === "delete"
            ? "Brack will stop trying to delete this item."
            : "The unsynced local copy was removed.",
      });
    } finally {
      setResolvingId(null);
    }
  };

  const handleFindExistingBook = async (item: OutboxItem, query?: string) => {
    await handleDiscard(item);
    onOpenChange(false);
    navigate(`/my-books${query ? `?q=${encodeURIComponent(query)}` : ""}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-[calc(100vw-1.5rem)] max-w-2xl gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b border-border/70 px-5 py-4 text-left">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10 text-destructive">
              <WarningTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="font-display text-xl">Review sync changes</DialogTitle>
              <DialogDescription className="mt-1">
                These reading changes are still saved on this device. Retry them, or discard local changes that cannot be synced.
              </DialogDescription>
            </div>
          </div>

          {items.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(failedByType).map(([entity, count]) => (
                <Badge key={entity} variant="outline" className="bg-background/70">
                  {ENTITY_LABELS[entity as SyncEntity]}: {count}
                </Badge>
              ))}
            </div>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[62vh]">
          <div className="space-y-3 p-4 sm:p-5">
            {loading ? (
              <div className="rounded-lg border border-border/70 bg-card/70 p-5 text-sm text-muted-foreground">
                Loading sync issues...
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-5">
                <p className="font-sans text-sm font-medium text-foreground">No changes need review.</p>
                <p className="mt-1 font-sans text-sm text-muted-foreground">
                  Brack has no failed reading-core sync items on this device.
                </p>
              </div>
            ) : (
              items.map((item) => {
                const preview = previewPayload(item);
                const Icon = ENTITY_ICONS[item.entity];
                const duplicateBook = isDuplicateBookFailure(item);

                return (
                  <article
                    key={item.id}
                    className="rounded-xl border border-border/70 bg-card/75 p-4 shadow-sm"
                  >
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-sans text-sm font-semibold text-foreground">
                            {preview.title}
                          </h3>
                          <Badge variant="secondary" className="capitalize">
                            {OPERATION_LABELS[item.operation]}
                          </Badge>
                        </div>

                        {preview.subtitle && (
                          <p className="mt-1 line-clamp-2 font-sans text-sm text-muted-foreground">
                            {preview.subtitle}
                          </p>
                        )}

                        <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
                          <p className="font-sans text-xs font-medium text-destructive">
                            {duplicateBook
                              ? "This book already exists in your library."
                              : item.last_error || "This change could not sync."}
                          </p>
                          <p className="mt-1 font-sans text-[11px] text-muted-foreground">
                            Attempted {item.attempt_count} time{item.attempt_count === 1 ? "" : "s"}.
                          </p>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {duplicateBook ? (
                            <Button
                              size="sm"
                              onClick={() => handleFindExistingBook(item, preview.routeQuery)}
                              disabled={resolvingId === item.id}
                            >
                              <NavArrowRight className="mr-1.5 h-4 w-4" />
                              Find in library
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRetry(item)}
                              disabled={resolvingId === item.id}
                            >
                              <Refresh
                                className={cn("mr-1.5 h-4 w-4", resolvingId === item.id && "animate-spin")}
                              />
                              Retry
                            </Button>
                          )}

                          {canDiscardCleanly(item) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDiscard(item)}
                              disabled={resolvingId === item.id}
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash className="mr-1.5 h-4 w-4" />
                              {item.operation === "delete" ? "Cancel delete" : "Discard local copy"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
