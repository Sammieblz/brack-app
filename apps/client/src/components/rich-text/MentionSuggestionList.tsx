interface MentionSuggestionListProps {
  items: Array<{ id: string; label: string }>;
  onSelect: (item: { id: string; label: string }) => void;
}

export const MentionSuggestionList = ({ items, onSelect }: MentionSuggestionListProps) => {
  if (items.length === 0) return null;
  return (
    <div className="rounded-md border border-border bg-popover p-1 shadow-md">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="block w-full rounded-sm px-3 py-2 text-left font-sans text-sm hover:bg-accent"
          onClick={() => onSelect(item)}
        >
          @{item.label}
        </button>
      ))}
    </div>
  );
};
