import { useState, useEffect, useRef } from "react";
import { QuickJournalEntryDialog } from "./QuickJournalEntryDialog";
import { useAuth } from "@/hooks/useAuth";

interface JournalPrompt {
  bookId: string;
  bookTitle: string | null;
  durationMinutes: number;
}

export const JournalPromptHandler = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [queue, setQueue] = useState<{
    userId: string | null;
    prompts: (JournalPrompt & { promptId: number })[];
  }>({ userId, prompts: [] });
  const nextPromptId = useRef(0);

  useEffect(() => {
    setQueue((previous) => previous.userId === userId ? previous : { userId, prompts: [] });
    const handleJournalPrompt = (event: CustomEvent<JournalPrompt>) => {
      if (!userId) return;
      // A second completed reading session must not replace an open draft.
      const prompt = { ...event.detail, promptId: nextPromptId.current++ };
      setQueue((previous) => ({
        userId,
        prompts: [...(previous.userId === userId ? previous.prompts : []), prompt],
      }));
    };

    window.addEventListener('showJournalPrompt', handleJournalPrompt as EventListener);

    return () => {
      window.removeEventListener('showJournalPrompt', handleJournalPrompt as EventListener);
    };
  }, [userId]);

  const sessionData = queue.userId === userId ? queue.prompts[0] : undefined;
  if (!sessionData) return null;

  return (
    <QuickJournalEntryDialog
      key={sessionData.promptId}
      open
      onOpenChange={(open) => {
        if (!open) setQueue((previous) => previous.userId === userId && previous.prompts[0]?.promptId === sessionData.promptId
          ? { ...previous, prompts: previous.prompts.slice(1) }
          : previous);
      }}
      bookId={sessionData.bookId}
      bookTitle={sessionData.bookTitle || "Unknown Book"}
      readingTimeMinutes={sessionData.durationMinutes}
    />
  );
};
