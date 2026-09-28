import { useId, useRef } from "react";
import { Dialog } from "@/components/ui/dialog";
import { AdaptiveDialogContent as DialogContent, AdaptiveDialogHeader as DialogHeader, AdaptiveDialogTitle as DialogTitle, AdaptiveDialogDescription as DialogDescription, AdaptiveDialogFooter as DialogFooter } from "@/components/ui/adaptive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/rich-text/RichTextEditor";
import type { JournalEntry, JournalSaveResult } from "@/hooks/useJournalEntries";
import { useJournalEditor } from "@/hooks/useJournalEditor";
import { JournalEditorFeedback } from "@/components/journal/JournalEditorFeedback";
import { Badge } from "@/components/ui/badge";
import { Xmark, Camera, MediaImage } from "iconoir-react";

interface JournalEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (entry: Omit<JournalEntry, "id" | "user_id" | "created_at" | "updated_at">) => Promise<JournalSaveResult>;
  editEntry?: JournalEntry | null;
  bookId: string;
}

export const JournalEntryDialog = (props: JournalEntryDialogProps) => {
  const { open, editEntry } = props;
  const editor = useJournalEditor({ ...props, kind: "full" });
  const { draft, setField, busy, discardRequested } = editor;
  const id = useId();
  const editorId = `${id}-content`;
  const returnFocus = useRef<HTMLElement | null>(null);

  return (
    <Dialog open={open} onOpenChange={editor.requestOpenChange}>
      <DialogContent
        size="wide"
        onOpenAutoFocus={() => { returnFocus.current = document.activeElement as HTMLElement | null; }}
        onCloseAutoFocus={(event) => {
          if (returnFocus.current?.isConnected) {
            event.preventDefault();
            returnFocus.current.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-display">{editEntry ? "Edit" : "Add"} Journal Entry</DialogTitle>
          <DialogDescription>Keep your notes, quotes, and reflections with this book.</DialogDescription>
        </DialogHeader>
        <form noValidate className="space-y-4" onSubmit={(event) => { event.preventDefault(); void editor.save(); }}>
          <fieldset disabled={busy || discardRequested} className="min-w-0 space-y-4">
            <legend className="sr-only">Journal entry</legend>
            <div className="space-y-2">
              <Label htmlFor={`${id}-type`}>Entry Type</Label>
              <Select value={draft.entryType} disabled={busy || discardRequested} onValueChange={(value) => {
                if (value === "note" || value === "quote" || value === "reflection") setField("entryType", value);
              }}>
                <SelectTrigger id={`${id}-type`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="quote">Quote</SelectItem>
                  <SelectItem value="reflection">Reflection</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label id={`${id}-title-label`} htmlFor={`${id}-title`}>Title (Optional)</Label>
              <Input id={`${id}-title`} aria-labelledby={`${id}-title-label`} placeholder="Give your entry a title..." value={draft.title} onChange={(event) => setField("title", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label id={`${id}-content-label`} htmlFor={editorId}>Content *</Label>
              <RichTextEditor id={editorId} labelledBy={`${id}-content-label`} disabled={busy || discardRequested}
                aria-required="true" aria-invalid={editor.errorField === "content"}
                aria-describedby={editor.errorField === "content" ? `${editorId}-error` : undefined}
                value={draft.richText} onChange={(value) => setField("richText", value)}
                placeholder={draft.entryType === "quote" ? "Enter the quote..." : draft.entryType === "reflection" ? "Share your thoughts and reflections..." : "Write your notes..."}
                minHeightClassName="min-h-[200px]" />
            </div>
            <div className="space-y-2">
              <Label id={`${id}-page-label`} htmlFor={`${id}-page`}>Page Reference (Optional)</Label>
              <Input id={`${id}-page`} aria-labelledby={`${id}-page-label`} aria-invalid={editor.errorField === "pageReference"} aria-describedby={editor.errorField === "pageReference" ? `${editorId}-error` : undefined} type="number" min="1" step="1" placeholder="Enter page number..." value={draft.pageReference} onChange={(event) => setField("pageReference", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label id={`${id}-tags-label`} htmlFor={`${id}-tags`}>Tags (Optional)</Label>
              <div className="flex gap-2">
                <Input id={`${id}-tags`} aria-labelledby={`${id}-tags-label`} placeholder="Add a tag..." value={draft.tagInput} onChange={(event) => setField("tagInput", event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); editor.addTag(); } }} />
                <Button type="button" onClick={editor.addTag} variant="outline">Add</Button>
              </div>
              {draft.tags.length > 0 && <div className="flex flex-wrap gap-2">
                {draft.tags.map((tag) => <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button type="button" aria-label={`Remove tag ${tag}`} className="inline-flex size-11 items-center justify-center rounded focus-visible:outline focus-visible:outline-2" onClick={() => editor.removeTag(tag)}>
                    <Xmark className="h-4 w-4" aria-hidden="true" />
                  </button>
                </Badge>)}
              </div>}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Photo (Optional)</p>
              {draft.photoPreview && <div className="relative">
                <img src={draft.photoPreview} alt="Journal attachment preview" className="w-full h-64 object-cover rounded-lg border" />
                <Button type="button" variant="destructive" size="icon" aria-label="Remove photo" className="absolute top-2 right-2 size-11" onClick={editor.removePhoto}>
                  <Xmark className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>}
              <div role="group" aria-label="Photo" aria-describedby={editor.errorField === "photo" ? `${editorId}-error` : undefined} className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void editor.pickPhoto("prompt")} className="flex-1"><Camera className="h-4 w-4 mr-2" aria-hidden="true" />Quick Add</Button>
                <Button type="button" variant="outline" onClick={() => void editor.pickPhoto("photos")} className="flex-1"><MediaImage className="h-4 w-4 mr-2" aria-hidden="true" />{draft.photoPreview ? "Replace Photo" : "Choose Photo"}</Button>
              </div>
            </div>
          </fieldset>
          <JournalEditorFeedback {...editor} editorId={editorId} pageId={`${id}-page`} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={editor.saving || editor.picking || editor.uploadingPhoto || discardRequested} onClick={() => editor.requestOpenChange(false)}>Cancel</Button>
            <Button type="submit" aria-describedby={editor.error && !editor.errorField ? `${editorId}-error` : undefined} disabled={busy || discardRequested || !draft.richText.content.trim()}>{editor.saving ? "Saving…" : `${editEntry ? "Update" : "Add"} Entry`}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
