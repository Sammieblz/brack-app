import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useImagePicker } from "@/hooks/useImagePicker";
import { useToast } from "@/hooks/use-toast";
import type { JournalEntry, JournalSaveResult } from "@/hooks/useJournalEntries";
import { getCurrentAuthUser, uploadPublicStorageFile } from "@/services/api";
import { toPlainRichTextPayload } from "@/lib/richText";
import type { RichTextPayload } from "@/types/richText";

export type JournalEntryInput = Omit<JournalEntry, "id" | "user_id" | "created_at" | "updated_at">;

export interface JournalEditorDraft {
  entryType: JournalEntry["entry_type"];
  title: string;
  richText: RichTextPayload;
  pageReference: string;
  tags: string[];
  tagInput: string;
  photoUrl: string | null;
  photoPreview: string | null;
}

interface JournalEditorOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  editEntry?: JournalEntry | null;
  onSave: (entry: JournalEntryInput) => Promise<JournalSaveResult>;
  kind: "full" | "quick";
}

interface EditorSnapshot {
  draft: JournalEditorDraft;
  dirty: boolean;
  saving: boolean;
  uploadingPhoto: boolean;
  picking: boolean;
  error: string | null;
  committed: boolean;
}

interface EditorSession {
  key: string;
  userId: string;
  bookId: string;
  initial: JournalEditorDraft;
  baseline: string;
  snapshot: EditorSnapshot;
  listeners: Set<() => void>;
  invalidated: boolean;
  announced: boolean;
}

const SAVE_ERROR = "Could not save your entry. Your draft is still here. Try again.";
const UPLOAD_ERROR = "Could not upload your photo. Your entry is unchanged. Try again.";

/**
 * Session memory deliberately survives React/route unmounts. It is not durable
 * storage: reload/process termination loses unsaved drafts. Dirty/pending
 * sessions are never silently evicted; clean sessions are released on detach.
 * Keep uploaded URL previews here, not large image data URLs.
 */
const sessions = new Map<string, EditorSession>();

const createDraft = (entry?: JournalEntry | null): JournalEditorDraft => ({
  entryType: entry?.entry_type ?? "note",
  title: entry?.title ?? "",
  richText: entry ? {
    content: entry.content,
    content_format: entry.content_format ?? "plain",
    content_json: entry.content_json ?? null,
    content_html: entry.content_html ?? null,
  } : toPlainRichTextPayload(""),
  pageReference: entry?.page_reference?.toString() ?? "",
  tags: [...(entry?.tags ?? [])],
  tagInput: "",
  photoUrl: entry?.photo_url ?? null,
  photoPreview: entry?.photo_url ?? null,
});

const createSnapshot = (draft: JournalEditorDraft): EditorSnapshot => ({
  draft,
  dirty: false,
  saving: false,
  uploadingPhoto: false,
  picking: false,
  error: null,
  committed: false,
});

const EMPTY_SNAPSHOT = createSnapshot(createDraft());
const isPending = (snapshot: EditorSnapshot) => snapshot.saving || snapshot.uploadingPhoto || snapshot.picking;

const publish = (session: EditorSession, patch: Partial<EditorSnapshot>) => {
  session.snapshot = { ...session.snapshot, ...patch };
  session.listeners.forEach((listener) => listener());
};

const releaseCleanSession = (session: EditorSession) => {
  if (!session.listeners.size && !session.snapshot.dirty && !isPending(session.snapshot)
    && sessions.get(session.key) === session) {
    sessions.delete(session.key);
  }
};

const updateDraft = (session: EditorSession, patch: Partial<JournalEditorDraft>) => {
  const draft = { ...session.snapshot.draft, ...patch };
  publish(session, { draft, dirty: JSON.stringify(draft) !== session.baseline, error: null });
};

export function useJournalEditor({ open, onOpenChange, bookId, editEntry, onSave, kind }: JournalEditorOptions) {
  const { user } = useAuth();
  const { pickImage } = useImagePicker();
  const { toast } = useToast();
  const userId = user?.id ?? null;
  const identityMismatch = Boolean(editEntry && (editEntry.user_id !== userId || editEntry.book_id !== bookId));
  const key = userId && !identityMismatch
    ? JSON.stringify([userId, bookId, editEntry?.id ?? "new", kind])
    : null;
  const session = useMemo(() => {
    if (!key || !userId) return null;
    const retained = sessions.get(key);
    if (retained && (retained.snapshot.dirty || isPending(retained.snapshot))) return retained;
    // A clean editor can adopt newer saved content on its next opening.
    // Dirty and pending sessions keep their exact draft across openings.
    const initial = createDraft(editEntry);
    const created: EditorSession = {
      key, userId, bookId, initial,
      baseline: JSON.stringify(initial),
      snapshot: createSnapshot(initial),
      listeners: new Set(),
      invalidated: false,
      announced: false,
    };
    sessions.set(key, created);
    return created;
    // Entry object refreshes must not replace an in-progress editor's draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, open]);

  const subscribe = useCallback((listener: () => void) => {
    if (!session) return () => undefined;
    // React Strict Mode can detach/re-attach the same clean session.
    if (!session.invalidated && !session.snapshot.committed && !sessions.has(session.key)) {
      sessions.set(session.key, session);
    }
    session.listeners.add(listener);
    return () => {
      session.listeners.delete(listener);
      releaseCleanSession(session);
    };
  }, [session]);
  const getSnapshot = useCallback(() => session?.snapshot ?? EMPTY_SNAPSHOT, [session]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [discardRequested, setDiscardRequested] = useState(false);
  const mounted = useRef(false);
  const current = useRef({ session, userId, open, onOpenChange, onSave, toast, generation: 0 });
  const generation = current.current.generation
    + (current.current.session !== session || current.current.open !== open ? 1 : 0);
  current.current = { session, userId, open, onOpenChange, onSave, toast, generation };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => { setDiscardRequested(false); }, [session, open]);

  const isLive = useCallback((candidate: EditorSession) => mounted.current
    && current.current.session === candidate
    && current.current.userId === candidate.userId
    && current.current.open
    && !candidate.invalidated, []);

  useEffect(() => {
    if (!session || !snapshot.committed || session.announced || !isLive(session)) return;
    // Claim before invoking presentation callbacks: failures here must never
    // convert a committed local write into a retryable mutation.
    session.announced = true;
    try {
      current.current.toast({
        title: "Journal entry saved",
        description: "Saved on this device. Changes will sync automatically.",
      });
    } catch (error) {
      console.error("Journal entry saved; feedback could not be shown", error);
    }
    try {
      current.current.onOpenChange(false);
    } catch (error) {
      console.error("Journal entry saved; editor could not close", error);
    }
  }, [session, snapshot.committed, isLive]);

  const needsUnloadWarning = open && (snapshot.dirty || isPending(snapshot));
  useEffect(() => {
    if (!needsUnloadWarning) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [needsUnloadWarning]);

  const canEdit = (candidate: EditorSession | null): candidate is EditorSession => Boolean(candidate
    && isLive(candidate) && !isPending(candidate.snapshot) && !candidate.snapshot.committed);

  const setField = <K extends keyof JournalEditorDraft>(field: K, value: JournalEditorDraft[K]) => {
    if (canEdit(session)) updateDraft(session, { [field]: value });
  };

  const addTag = () => {
    if (!canEdit(session)) return;
    const tag = session.snapshot.draft.tagInput.trim();
    if (tag && !session.snapshot.draft.tags.includes(tag)) {
      updateDraft(session, { tags: [...session.snapshot.draft.tags, tag], tagInput: "" });
    }
  };

  const removeTag = (tag: string) => {
    if (canEdit(session)) updateDraft(session, { tags: session.snapshot.draft.tags.filter((item) => item !== tag) });
  };

  const removePhoto = () => {
    if (canEdit(session)) updateDraft(session, { photoUrl: null, photoPreview: null });
  };

  const requestOpenChange = (nextOpen: boolean) => {
    if (nextOpen) { current.current.onOpenChange(true); return; }
    if (session && isPending(session.snapshot)) return;
    if (session?.snapshot.dirty && !session.snapshot.committed) {
      setDiscardRequested(true);
      return;
    }
    current.current.onOpenChange(false);
  };

  const discard = () => {
    if (session && isPending(session.snapshot)) return;
    if (session && isLive(session)) {
      session.invalidated = true;
      if (sessions.get(session.key) === session) sessions.delete(session.key);
      publish(session, createSnapshot(session.initial));
    }
    setDiscardRequested(false);
    current.current.onOpenChange(false);
  };

  const save = async () => {
    if (!canEdit(session)) return;
    const draft = session.snapshot.draft;
    if (!draft.richText.content.trim()) {
      publish(session, { error: "Enter some content before saving your entry." });
      return;
    }
    const page = draft.pageReference.trim() ? Number(draft.pageReference) : null;
    if (page !== null && (!Number.isInteger(page) || page < 1)) {
      publish(session, { error: "Enter a whole page number greater than zero." });
      return;
    }
    const saveEntry = current.current.onSave;
    // Store state changes synchronously, so a second click/remounted editor
    // sees the same pending operation before React has rendered again.
    publish(session, { saving: true, error: null });
    setDiscardRequested(false);
    try {
      const authenticatedUser = await getCurrentAuthUser();
      if (authenticatedUser?.id !== session.userId || current.current.userId !== session.userId || session.invalidated) {
        throw new Error("Reader identity changed");
      }
      const result = await saveEntry({
        book_id: session.bookId,
        entry_type: draft.entryType,
        title: draft.title.trim() || null,
        content: draft.richText.content.trim(),
        content_format: draft.richText.content_format,
        content_json: draft.richText.content_json,
        content_html: draft.richText.content_html,
        page_reference: page,
        tags: draft.tags.length ? [...draft.tags] : null,
        photo_url: draft.photoUrl,
      });
      if (!result?.savedLocally) throw new Error("Journal save did not report a local commit");
      if (sessions.get(session.key) === session) sessions.delete(session.key);
      publish(session, { saving: false, dirty: false, committed: true, error: null });
    } catch (error) {
      if (!session.snapshot.committed) publish(session, { saving: false, error: SAVE_ERROR });
      console.error("Journal entry could not be saved", error);
    }
    releaseCleanSession(session);
  };

  const pickPhoto = async (source: "prompt" | "camera" | "photos") => {
    if (!canEdit(session)) return;
    publish(session, { picking: true, error: null });
    const startedGeneration = current.current.generation;
    const uploadStillCurrent = () => isLive(session)
      && current.current.generation === startedGeneration
      && sessions.get(session.key) === session;
    try {
      const image = await pickImage({ source });
      if (!image || !uploadStillCurrent()) return;
      const authenticatedUser = await getCurrentAuthUser();
      if (!uploadStillCurrent() || authenticatedUser?.id !== session.userId) return;
      if (!image.base64) throw new Error("No image data received");
      const format = image.format.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpeg";
      const bytes = Uint8Array.from(atob(image.base64), (character) => character.charCodeAt(0));
      const blob = new Blob([bytes], { type: `image/${format}` });
      const path = `${session.userId}/journal-${crypto.randomUUID()}.${format}`;
      publish(session, { picking: false, uploadingPhoto: true });
      const url = await uploadPublicStorageFile("journal-photos", path, blob, { contentType: blob.type });
      if (!uploadStillCurrent()) return;
      // Never delete the original here: a local commit does not establish
      // that remote/other-device references have stopped using its asset.
      updateDraft(session, { photoUrl: url, photoPreview: url });
    } catch (error) {
      if (uploadStillCurrent()) publish(session, { error: UPLOAD_ERROR });
      console.error("Journal photo could not be uploaded", error);
    } finally {
      publish(session, { picking: false, uploadingPhoto: false });
      releaseCleanSession(session);
    }
  };

  return {
    draft: snapshot.draft,
    setField, addTag, removeTag, removePhoto,
    save, requestOpenChange,
    discardRequested,
    keepEditing: () => setDiscardRequested(false),
    discard,
    saving: snapshot.saving,
    uploadingPhoto: snapshot.uploadingPhoto,
    picking: snapshot.picking,
    busy: isPending(snapshot) || snapshot.committed || !userId || identityMismatch,
    error: !userId ? "Sign in to write a journal entry."
      : identityMismatch ? "This entry is no longer available for this reader." : snapshot.error,
    pickPhoto,
  };
}
