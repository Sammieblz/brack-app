import { useState, useEffect } from "react";
import { QuickJournalEntryDialog } from "./QuickJournalEntryDialog";

export const JournalPromptHandler = () => {
  const [showDialog, setShowDialog] = useState(false);
  const [sessionData, setSessionData] = useState<{
    bookId: string;
    bookTitle: string | null;
    durationMinutes: number;
  } | null>(null);

  useEffect(() => {
    const handleJournalPrompt = (event: CustomEvent) => {
      setSessionData(event.detail);
      setShowDialog(true);
    };

    window.addEventListener('showJournalPrompt', handleJournalPrompt as EventListener);

    return () => {
      window.removeEventListener('showJournalPrompt', handleJournalPrompt as EventListener);
    };
  }, []);

  if (!sessionData) return null;

  return (
    <QuickJournalEntryDialog
      open={showDialog}
      onOpenChange={setShowDialog}
      bookId={sessionData.bookId}
      bookTitle={sessionData.bookTitle || "Unknown Book"}
      readingTimeMinutes={sessionData.durationMinutes}
    />
  );
};
