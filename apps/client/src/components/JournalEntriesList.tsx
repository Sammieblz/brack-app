import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "iconoir-react";
import { JournalEntryCard } from "./JournalEntryCard";
import { JournalEntryDialog } from "./JournalEntryDialog";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { useJournalEntries, JournalEntry } from "@/hooks/useJournalEntries";
import {
  LoadingError,
  LoadingRegion,
} from "@/components/loading/LoadingRegion";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface JournalEntriesListProps {
  bookId: string;
}

export const JournalEntriesList = ({ bookId }: JournalEntriesListProps) => {
  const { user } = useAuth();
  const {
    entries,
    loading,
    refreshing,
    hasLoaded,
    error,
    refetchEntries,
    addEntry,
    updateEntry,
    deleteEntry,
  } = useJournalEntries(bookId, user?.id);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const handleEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setDialogOpen(true);
  };

  const handleSave = async (
    entry: Omit<JournalEntry, "id" | "user_id" | "created_at" | "updated_at">,
  ) => {
    if (editingEntry) {
      await updateEntry(editingEntry.id, entry);
      setEditingEntry(null);
    } else {
      await addEntry(entry);
    }
  };

  const filteredEntries = entries.filter((entry) => {
    const matchesType = filterType === "all" || entry.entry_type === filterType;
    const matchesSearch =
      searchQuery === "" ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.tags?.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:w-auto">
          <Input
            placeholder="Search entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="note">Notes</SelectItem>
              <SelectItem value="quote">Quotes</SelectItem>
              <SelectItem value="reflection">Reflections</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              setEditingEntry(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </Button>
        </div>
      </div>

      <LoadingRegion
        loading={loading}
        refreshing={refreshing}
        label="Loading journal entries"
      >
        {error && (
          <LoadingError
            message="Journal entries could not be refreshed. Your saved writing is safe."
            onRetry={() => void refetchEntries()}
          />
        )}
        {loading ? (
          <div
            className="space-y-4"
            data-loading-contract="journal-entries"
            aria-hidden="true"
          >
            {[0, 1].map((index) => (
              <Card key={index}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                  <Skeleton className="mt-2 h-7 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="mb-3 h-16 w-full" />
                  <Skeleton className="ml-auto h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error && !hasLoaded ? null : filteredEntries.length === 0 ? (
          <PremiumEmptyState
            asset={
              searchQuery || filterType !== "all" ? "noResults" : "emptyJournal"
            }
            title={
              searchQuery || filterType !== "all"
                ? "No matching journal entries"
                : "No journal entries yet"
            }
            description={
              searchQuery || filterType !== "all"
                ? "Try another search or filter."
                : "Start capturing your thoughts, quotes, and reflections."
            }
            size="compact"
            variant="plain"
            action={
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Entry
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {filteredEntries.map((entry) => (
              <JournalEntryCard
                key={entry.id}
                entry={entry}
                onEdit={handleEdit}
                onDelete={deleteEntry}
              />
            ))}
          </div>
        )}
      </LoadingRegion>

      <JournalEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        editEntry={editingEntry}
        bookId={bookId}
      />
    </div>
  );
};
