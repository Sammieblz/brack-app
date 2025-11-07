import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, BookOpen, Quote, Lightbulb } from "lucide-react";
import { JournalEntry } from "@/hooks/useJournalEntries";
import { formatDistanceToNow } from "date-fns";

interface JournalEntryCardProps {
  entry: JournalEntry;
  onEdit: (entry: JournalEntry) => void;
  onDelete: (id: string) => void;
}

const entryTypeConfig = {
  note: { icon: BookOpen, label: "Note", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  quote: { icon: Quote, label: "Quote", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  reflection: { icon: Lightbulb, label: "Reflection", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
};

export const JournalEntryCard = ({ entry, onEdit, onDelete }: JournalEntryCardProps) => {
  const config = entryTypeConfig[entry.entry_type];
  const Icon = config.icon;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            <Badge variant="outline" className={config.color}>
              <Icon className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
            {entry.page_reference && (
              <Badge variant="secondary" className="text-xs">
                Page {entry.page_reference}
              </Badge>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(entry)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(entry.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {entry.title && (
          <h3 className="font-semibold text-lg mt-2">{entry.title}</h3>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground whitespace-pre-wrap mb-3">
          {entry.content}
        </p>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1 flex-wrap">
            {entry.tags?.map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
