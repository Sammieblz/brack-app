import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, BookOpen } from "lucide-react";
import { JournalEntryCard } from "./JournalEntryCard";
import { JournalEntryDialog } from "./JournalEntryDialog";
import { useJournalEntries, JournalEntry } from "@/hooks/useJournalEntries";
import LoadingSpinner from "./LoadingSpinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface JournalEntriesListProps {
  bookId: string;
}

export const JournalEntriesList = ({ bookId }: JournalEntriesListProps) => {
  const { entries, loading, addEntry, updateEntry, deleteEntry } = useJournalEntries(bookId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setDialogOpen(true);
  };

  const handleSave = async (entry: Omit<JournalEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (editingEntry) {
      await updateEntry(editingEntry.id, entry);
      setEditingEntry(null);
    } else {
      await addEntry(entry);
    }
  };

  const filteredEntries = entries.filter(entry => {
    const matchesType = filterType === 'all' || entry.entry_type === filterType;
    const matchesSearch = searchQuery === '' || 
      entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  if (loading) {
    return <LoadingSpinner />;
  }

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
          <Button onClick={() => {
            setEditingEntry(null);
            setDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </Button>
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Journal Entries Yet</h3>
          <p className="text-muted-foreground mb-4">
            Start capturing your thoughts, quotes, and reflections
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Entry
          </Button>
        </div>
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
