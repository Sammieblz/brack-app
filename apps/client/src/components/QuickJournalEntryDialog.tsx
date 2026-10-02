import { useId, useRef } from "react";
import { Dialog } from "@/components/ui/dialog";
import { AdaptiveDialogContent as DialogContent, AdaptiveDialogHeader as DialogHeader, AdaptiveDialogTitle as DialogTitle, AdaptiveDialogDescription as DialogDescription, AdaptiveDialogFooter } from "@/components/ui/adaptive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Book, Quote, Notes, Camera, Xmark, MediaImage } from "iconoir-react";
import { RichTextEditor } from "@/components/rich-text/RichTextEditor";
import { useJournalEntries } from "@/hooks/useJournalEntries";
import { useJournalEditor } from "@/hooks/useJournalEditor";
import { useAuth } from "@/hooks/useAuth";
import { JournalEditorFeedback } from "@/components/journal/JournalEditorFeedback";

interface QuickJournalEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  bookTitle: string;
  readingTimeMinutes?: number;
}

export const QuickJournalEntryDialog = (props: QuickJournalEntryDialogProps) => {
  const { open, bookId, bookTitle, readingTimeMinutes } = props;
  const { user } = useAuth();
  const { addEntry } = useJournalEntries(bookId, user?.id);
  const editor = useJournalEditor({ ...props, onSave: addEntry, kind: "quick" });
  const { draft, setField, busy, discardRequested } = editor;
  const id = useId();
  const editorId = `${id}-content`;
  const returnFocus = useRef<HTMLElement | null>(null);

  return (
    <Dialog open={open} onOpenChange={editor.requestOpenChange}>
      <DialogContent
        onOpenAutoFocus={() => { returnFocus.current = document.activeElement as HTMLElement | null; }}
        onCloseAutoFocus={(event) => {
          const activeDialog = document.activeElement?.closest('[role="dialog"], [role="alertdialog"]');
          if (activeDialog && activeDialog !== event.target && activeDialog.getAttribute("data-state") !== "closed") {
            event.preventDefault();
            return;
          }
          if (returnFocus.current?.isConnected && returnFocus.current !== document.body &&
              returnFocus.current !== document.documentElement && returnFocus.current.getClientRects().length > 0) {
            event.preventDefault();
            returnFocus.current.focus();
          } else {
            // A completed timer removes its Save control before this prompt
            // opens. Return to a visible reading control or current page title.
            const target = [...document.querySelectorAll<HTMLElement>('[data-start-reading-timer], [data-app-scroll-container] h1')]
              .find(element => element.getClientRects().length > 0);
            if (target) {
              event.preventDefault();
              if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
              target.focus();
            }
          }
        }}>
        <DialogHeader>
          <DialogTitle className="font-display">Add Journal Entry</DialogTitle>
          <DialogDescription className="font-sans">
            Save your thoughts about "{bookTitle}"{readingTimeMinutes ? ` (${Math.round(readingTimeMinutes)} min read)` : ""}
          </DialogDescription>
        </DialogHeader>
        <form noValidate className="space-y-4" onSubmit={(event) => { event.preventDefault(); void editor.save(); }}>
          <fieldset disabled={busy || discardRequested} className="min-w-0 space-y-4">
            <legend className="sr-only">Journal entry</legend>
            <div>
              <p id={`${id}-type-label`} className="mb-2 text-sm font-medium">Entry Type</p>
              <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby={`${id}-type-label`}>
                {([
                  { value: "note", label: "Note", Icon: Notes },
                  { value: "quote", label: "Quote", Icon: Quote },
                  { value: "reflection", label: "Reflection", Icon: Book },
                ] as const).map(({ value, label, Icon }) => (
                  <Button key={value} type="button" variant={draft.entryType === value ? "default" : "outline"} aria-pressed={draft.entryType === value} onClick={() => setField("entryType", value)} className="flex flex-col h-auto py-3">
                    <Icon className="h-4 w-4 mb-1" aria-hidden="true" /><span className="text-xs">{label}</span>
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label id={`${id}-title-label`} htmlFor={`${id}-title`}>Title (optional)</Label>
              <Input id={`${id}-title`} aria-labelledby={`${id}-title-label`} value={draft.title} onChange={(event) => setField("title", event.target.value)} placeholder={draft.entryType === "quote" ? "Quote source or context" : "Entry title"} />
            </div>
            <div className="space-y-2">
              <Label id={`${id}-content-label`} htmlFor={editorId}>{draft.entryType === "quote" ? "Quote" : draft.entryType === "reflection" ? "Reflection" : "Note"} *</Label>
              <RichTextEditor id={editorId} labelledBy={`${id}-content-label`} disabled={busy || discardRequested}
                aria-required="true" aria-invalid={editor.errorField === "content"}
                aria-describedby={editor.errorField === "content" ? `${editorId}-error` : undefined}
                value={draft.richText} onChange={(value) => setField("richText", value)}
                placeholder={draft.entryType === "quote" ? "Paste your favorite quote here..." : draft.entryType === "reflection" ? "What did you think about this reading session?" : "Write your notes here..."}
                minHeightClassName="min-h-36" />
            </div>
            <div className="space-y-2">
              <Label id={`${id}-page-label`} htmlFor={`${id}-page`}>Page Reference (optional)</Label>
              <Input id={`${id}-page`} aria-labelledby={`${id}-page-label`} aria-invalid={editor.errorField === "pageReference"} aria-describedby={editor.errorField === "pageReference" ? `${editorId}-error` : undefined} type="number" value={draft.pageReference} onChange={(event) => setField("pageReference", event.target.value)} placeholder="Page number" min="1" step="1" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Photo (optional)</p>
              {draft.photoPreview && <div className="relative">
                <img src={draft.photoPreview} alt="Journal attachment preview" className="w-full h-48 object-cover rounded-lg border" />
                <Button type="button" variant="destructive" size="icon" aria-label="Remove photo" className="absolute top-2 right-2 size-11" onClick={editor.removePhoto}><Xmark className="h-4 w-4" aria-hidden="true" /></Button>
              </div>}
              <div role="group" aria-label="Photo" aria-describedby={editor.errorField === "photo" ? `${editorId}-error` : undefined} className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void editor.pickPhoto("prompt")} className="flex-1"><Camera className="h-4 w-4 mr-2" aria-hidden="true" />Quick Add</Button>
                <Button type="button" variant="outline" onClick={() => void editor.pickPhoto("photos")} className="flex-1"><MediaImage className="h-4 w-4 mr-2" aria-hidden="true" />{draft.photoPreview ? "Replace Photo" : "Choose Photo"}</Button>
              </div>
            </div>
          </fieldset>
          <JournalEditorFeedback {...editor} editorId={editorId} pageId={`${id}-page`} />
          <AdaptiveDialogFooter>
            <Button type="button" variant="outline" onClick={() => editor.requestOpenChange(false)} disabled={editor.saving || editor.picking || editor.uploadingPhoto || discardRequested}>Skip</Button>
            <Button type="submit" aria-describedby={editor.error && !editor.errorField ? `${editorId}-error` : undefined} disabled={busy || discardRequested || !draft.richText.content.trim()}>{editor.saving ? "Saving…" : "Save Entry"}</Button>
          </AdaptiveDialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
