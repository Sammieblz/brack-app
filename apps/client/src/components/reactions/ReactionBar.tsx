import { Button } from "@/components/ui/button";
import { APP_REACTIONS, type AppReactionType } from "@/config/reactions";
import { cn } from "@/lib/utils";

interface ReactionBarProps<T extends AppReactionType> {
  currentReaction?: T | null;
  reactionCounts?: Partial<Record<T, number>>;
  onToggle: (reactionType: T) => void | Promise<void>;
  compact?: boolean;
  className?: string;
}

export const ReactionBar = <T extends AppReactionType>({
  currentReaction,
  reactionCounts,
  onToggle,
  compact = false,
  className,
}: ReactionBarProps<T>) => {
  if (compact) {
    const activeReactions = APP_REACTIONS.filter(
      (reaction) => reactionCounts?.[reaction.type as T]
    );

    if (activeReactions.length === 0) return null;

    return (
      <div className={cn("flex flex-wrap items-center gap-1", className)}>
        {activeReactions.map((reaction) => {
          const type = reaction.type as T;
          return (
            <button
              key={reaction.type}
              type="button"
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-full border border-border bg-background px-2 font-sans text-xs transition hover:border-primary hover:text-primary",
                currentReaction === type && "border-primary bg-primary/10 text-primary"
              )}
              onClick={() => onToggle(type)}
              title={reaction.title}
              aria-label={`${reaction.title}, ${reactionCounts?.[type] || 0}`}
            >
              <span aria-hidden>{reaction.icon}</span>
              <span>{reactionCounts?.[type] || 0}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {APP_REACTIONS.map((reaction) => {
        const type = reaction.type as T;
        return (
          <Button
            key={reaction.type}
            type="button"
            variant={currentReaction === type ? "default" : "ghost"}
            size="icon"
            className="h-9 w-9 text-base transition-transform hover:scale-110"
            title={reaction.title}
            onClick={() => onToggle(type)}
            aria-label={reaction.title}
          >
            <span aria-hidden>{reaction.icon}</span>
          </Button>
        );
      })}
    </div>
  );
};
