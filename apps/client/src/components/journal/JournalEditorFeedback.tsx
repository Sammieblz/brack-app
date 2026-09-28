import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

interface JournalEditorFeedbackProps {
  error: string | null;
  saving: boolean;
  picking: boolean;
  uploadingPhoto: boolean;
  discardRequested: boolean;
  keepEditing: () => void;
  discard: () => void;
  editorId: string;
}

/** Keep discard feedback inside the editor's existing focus scope. */
export const JournalEditorFeedback = ({
  error,
  saving,
  picking,
  uploadingPhoto,
  discardRequested,
  keepEditing,
  discard,
  editorId,
}: JournalEditorFeedbackProps) => {
  const keepEditingRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (discardRequested) keepEditingRef.current?.focus();
  }, [discardRequested]);

  return (
    <>
      {(saving || picking || uploadingPhoto) && (
        <p role="status" className="text-sm text-muted-foreground">
          {saving ? "Saving your entry on this device…" : "Preparing your photo…"}
        </p>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {discardRequested && (
        <section aria-label="Discard draft confirmation" className="space-y-3 rounded-lg border p-4">
          <p className="font-semibold">Discard this draft?</p>
          <p className="text-sm text-muted-foreground">
            Your unsaved changes will be removed. Your saved journal entry will stay as it is.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              ref={keepEditingRef}
              type="button"
              variant="outline"
              onClick={() => {
                keepEditing();
                requestAnimationFrame(() => document.getElementById(editorId)?.focus());
              }}
            >
              Keep editing
            </Button>
            <Button type="button" variant="destructive" onClick={discard}>Discard draft</Button>
          </div>
        </section>
      )}
    </>
  );
};
