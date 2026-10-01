import type { ReactNode } from "react";
import { Dialog, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AdaptiveDialogBody, AdaptiveDialogContent, AdaptiveDialogDescription, AdaptiveDialogFooter, AdaptiveDialogHeader, AdaptiveDialogTitle } from "@/components/ui/adaptive-dialog";
import { APP_ICONS } from "@/config/iconography";
import "./library-reading-room.css";

export type LibraryStatusFilter = "all" | "reading" | "completed" | "to_read";
const statuses: Array<{ value: LibraryStatusFilter; label: string }> = [
  { value: "all", label: "All" }, { value: "reading", label: "Reading" },
  { value: "completed", label: "Finished" }, { value: "to_read", label: "To read" },
];

export function LibraryToolbar({ search, onSearch, status, onStatus, counts, loading, controlsOpen, onControlsOpen,
  summary, activeFilters, onClear, children, shortcuts }: {
  search: string; onSearch: (value: string) => void; status: LibraryStatusFilter; onStatus: (value: LibraryStatusFilter) => void;
  counts: Record<LibraryStatusFilter, number>; loading: boolean; controlsOpen: boolean; onControlsOpen: (open: boolean) => void;
  summary: string; activeFilters: boolean; onClear: () => void; children: ReactNode; shortcuts: ReactNode;
}) {
  return <section className="library-discovery" aria-label="Find a book">
    <div className="library-search-row">
      <div className="library-search-field">
        <APP_ICONS.common.search aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
        <input type="search" aria-label="Search your library" placeholder="Find a book or author" value={search}
          onChange={event => onSearch(event.target.value)} className="library-search-input" />
        {search && <button type="button" className="library-icon-control" aria-label="Clear search" onClick={() => onSearch("")}>
          <APP_ICONS.common.close aria-hidden="true" className="size-5" />
        </button>}
      </div>
      <Dialog open={controlsOpen} onOpenChange={onControlsOpen}>
        <DialogTrigger asChild><button type="button" className="library-text-control library-controls-trigger" aria-label="Library controls">
          <APP_ICONS.library.filter aria-hidden="true" className="size-5 shrink-0" /><span className="hidden sm:inline">Filter &amp; sort</span><span className="sm:hidden">Filters</span>
          {activeFilters && <span className="size-2 rounded-full bg-primary" aria-hidden="true" />}
        </button></DialogTrigger>
        <AdaptiveDialogContent className="library-controls-sheet" size="regular">
          <AdaptiveDialogHeader><AdaptiveDialogTitle>Library controls</AdaptiveDialogTitle>
            <AdaptiveDialogDescription>Choose how to browse your books. Changes apply immediately.</AdaptiveDialogDescription></AdaptiveDialogHeader>
          <AdaptiveDialogBody className="space-y-6">{children}</AdaptiveDialogBody>
          <AdaptiveDialogFooter><DialogClose asChild><button type="button" className="library-filled-control">Show books</button></DialogClose></AdaptiveDialogFooter>
        </AdaptiveDialogContent>
      </Dialog>
    </div>
    <div className="library-status-strip" role="group" aria-label="Reading status">
      {statuses.map(option => <button type="button" key={option.value} aria-pressed={status === option.value}
        className="library-status-option" onClick={() => onStatus(option.value)}>
        <span>{option.label}</span><span className="library-status-count" aria-label={loading ? "Loading count" : `${counts[option.value]} ${counts[option.value] === 1 ? "book" : "books"}`}>{loading ? "—" : counts[option.value]}</span>
      </button>)}
    </div>
    <div className="library-context-row">
      <p className="min-w-0 flex-1 font-sans text-sm text-muted-foreground">{summary}</p>
      {activeFilters && <button type="button" className="library-text-control" onClick={onClear}>Clear filters</button>}
      {shortcuts}
    </div>
  </section>;
}
