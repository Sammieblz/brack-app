import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JournalEntry, JournalSaveResult } from "./useJournalEntries";
import type { JournalEntryInput } from "./useJournalEditor";

const mocks = vi.hoisted(() => ({
  user: { id: "reader" } as { id: string } | null,
  auth: vi.fn(),
  pick: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/hooks/useImagePicker", () => ({ useImagePicker: () => ({ pickImage: mocks.pick, picking: false }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/services/api", () => ({
  getCurrentAuthUser: mocks.auth,
  uploadPublicStorageFile: mocks.upload,
  removeStorageFiles: mocks.remove,
}));

import { useJournalEditor } from "./useJournalEditor";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

let nextBook = 0;
const success: JournalSaveResult = { entryId: "saved-entry", savedLocally: true };
const richText = {
  content: "Keep my words",
  content_format: "tiptap" as const,
  content_json: { type: "doc" as const, content: [{ type: "paragraph", content: [{ type: "text", text: "Keep my words", marks: [{ type: "bold" }] }] }] },
  content_html: "<p><strong>Keep my words</strong></p>",
};
const image = { dataUrl: "data:image/png;base64,YQ==", base64: "YQ==", format: "png" };

const options = () => ({
  open: true,
  onOpenChange: vi.fn(),
  bookId: `journal-editor-test-${++nextBook}`,
  onSave: vi.fn<(entry: JournalEntryInput) => Promise<JournalSaveResult>>().mockResolvedValue(success),
  kind: "full" as const,
});

const entryFor = (bookId: string): JournalEntry => ({
  id: "existing-entry", user_id: "reader", book_id: bookId, entry_type: "note",
  title: "Saved title", content: "Saved writing", photo_url: "https://example.test/original.png",
  tags: ["saved"], created_at: "2026-01-01", updated_at: "2026-01-01",
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: "reader" };
  mocks.auth.mockImplementation(async () => mocks.user);
  mocks.pick.mockResolvedValue(image);
  mocks.upload.mockResolvedValue("https://example.test/replacement.png");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("journal editor session lifecycle", () => {
  it("retains all draft fields on failed save and prevents duplicate writes and edits while pending", async () => {
    const pending = deferred<JournalSaveResult>();
    const props = options();
    props.onSave.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useJournalEditor(props));
    act(() => {
      result.current.setField("title", "My title");
      result.current.setField("richText", richText);
      result.current.setField("pageReference", "12");
      result.current.setField("tagInput", "thoughts");
      result.current.addTag();
      result.current.setField("photoUrl", "https://example.test/draft.png");
    });
    let saving!: Promise<void>;
    act(() => {
      saving = result.current.save();
      void result.current.save();
      result.current.setField("title", "Unsafe late edit");
      result.current.requestOpenChange(false);
    });
    await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1));
    expect(result.current.saving).toBe(true);
    expect(props.onOpenChange).not.toHaveBeenCalled();
    await act(async () => { pending.reject(new Error("local write failed")); await saving; });
    expect(result.current.error).toBe("Could not save your entry. Your draft is still here. Try again.");
    expect(result.current.draft).toMatchObject({ title: "My title", richText, pageReference: "12", tags: ["thoughts"], photoUrl: "https://example.test/draft.png" });
    expect(mocks.toast).not.toHaveBeenCalled();
    await act(async () => { await result.current.save(); });
    expect(props.onSave).toHaveBeenCalledTimes(2);
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });

  it("shares an in-flight save after unmount and closes the matching remounted editor once", async () => {
    const pending = deferred<JournalSaveResult>();
    const props = options();
    props.onSave.mockReturnValueOnce(pending.promise);
    const first = renderHook(() => useJournalEditor(props));
    act(() => first.result.current.setField("richText", richText));
    let saving!: Promise<void>;
    act(() => { saving = first.result.current.save(); });
    await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1));
    first.unmount();
    const nextProps = { ...props, onOpenChange: vi.fn() };
    const next = renderHook(() => useJournalEditor(nextProps));
    expect(next.result.current.draft.richText).toEqual(richText);
    expect(next.result.current.saving).toBe(true);
    await act(async () => { await next.result.current.save(); });
    expect(props.onSave).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve(success); await saving; });
    expect(props.onOpenChange).not.toHaveBeenCalled();
    expect(nextProps.onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });

  it("restores a failed pending save on the remounted editor", async () => {
    const pending = deferred<JournalSaveResult>();
    const props = options();
    props.onSave.mockReturnValueOnce(pending.promise);
    const first = renderHook(() => useJournalEditor(props));
    act(() => first.result.current.setField("richText", richText));
    let saving!: Promise<void>;
    act(() => { saving = first.result.current.save(); });
    await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1));
    first.unmount();
    const next = renderHook(() => useJournalEditor(props));
    await act(async () => { pending.reject(new Error("no space")); await saving; });
    expect(next.result.current.draft.richText).toEqual(richText);
    expect(next.result.current.error).toContain("Your draft is still here");
    expect(next.result.current.busy).toBe(false);
  });

  it("keeps dirty drafts through forced close and account changes without exposing another reader's draft", () => {
    const props = options();
    const editor = renderHook((current) => useJournalEditor(current), { initialProps: props });
    act(() => editor.result.current.setField("richText", richText));
    editor.rerender({ ...props, open: false });
    editor.rerender(props);
    expect(editor.result.current.draft.richText).toEqual(richText);
    mocks.user = { id: "other-reader" };
    editor.rerender(props);
    expect(editor.result.current.draft.richText.content).toBe("");
    mocks.user = { id: "reader" };
    editor.rerender(props);
    expect(editor.result.current.draft.richText).toEqual(richText);
  });

  it("does not begin a write after the reader changes while authentication is pending", async () => {
    const auth = deferred<{ id: string }>();
    mocks.auth.mockReturnValueOnce(auth.promise);
    const props = options();
    const editor = renderHook((current) => useJournalEditor(current), { initialProps: props });
    act(() => editor.result.current.setField("richText", richText));
    let saving!: Promise<void>;
    act(() => { saving = editor.result.current.save(); });
    mocks.user = { id: "another-reader" };
    editor.rerender(props);
    await act(async () => { auth.resolve({ id: "reader" }); await saving; });
    expect(props.onSave).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(editor.result.current.error).toBeNull();
    expect(editor.result.current.draft.richText.content).toBe("");
  });

  it("masks a signed-out reader's draft, explains the unavailable editor, and still permits closing", async () => {
    const props = options();
    const editor = renderHook((current) => useJournalEditor(current), { initialProps: props });
    act(() => editor.result.current.setField("richText", richText));
    mocks.user = null;
    editor.rerender(props);
    expect(editor.result.current.draft.richText.content).toBe("");
    expect(editor.result.current.busy).toBe(true);
    expect(editor.result.current.error).toBe("Sign in to write a journal entry.");
    await act(async () => {
      await editor.result.current.save();
      await editor.result.current.pickPhoto("photos");
    });
    expect(props.onSave).not.toHaveBeenCalled();
    expect(mocks.pick).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
    act(() => editor.result.current.requestOpenChange(false));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    mocks.user = { id: "reader" };
    editor.rerender(props);
    expect(editor.result.current.draft.richText).toEqual(richText);
  });

  it("keeps editing on cancel and starts clean after explicit discard/reopen", () => {
    const props = options();
    const editor = renderHook((current) => useJournalEditor(current), { initialProps: props });
    act(() => editor.result.current.setField("richText", richText));
    act(() => editor.result.current.requestOpenChange(false));
    expect(editor.result.current.discardRequested).toBe(true);
    expect(props.onOpenChange).not.toHaveBeenCalled();
    act(() => editor.result.current.keepEditing());
    expect(editor.result.current.discardRequested).toBe(false);
    expect(editor.result.current.draft.richText).toEqual(richText);
    act(() => editor.result.current.discard());
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    editor.rerender({ ...props, open: false });
    editor.rerender(props);
    expect(editor.result.current.draft.richText.content).toBe("");
    act(() => editor.result.current.setField("title", "New draft"));
    expect(editor.result.current.draft.title).toBe("New draft");
  });

  it("starts a new clean editor after confirmed save without retaining a committed retry", async () => {
    const props = options();
    const editor = renderHook((current) => useJournalEditor(current), { initialProps: props });
    act(() => editor.result.current.setField("richText", richText));
    await act(async () => { await editor.result.current.save(); });
    await act(async () => { await editor.result.current.save(); });
    expect(props.onSave).toHaveBeenCalledTimes(1);
    editor.rerender({ ...props, open: false });
    editor.rerender(props);
    expect(editor.result.current.draft.richText.content).toBe("");
    expect(editor.result.current.busy).toBe(false);
  });

  it("adopts newer saved content when a clean entry reopens but preserves a dirty draft", () => {
    const base = options();
    const props = { ...base, editEntry: entryFor(base.bookId) };
    const editor = renderHook((current) => useJournalEditor(current), { initialProps: props });
    editor.rerender({ ...props, open: false });
    const refreshed = { ...props, editEntry: { ...props.editEntry, title: "Updated elsewhere", content: "New saved writing" } };
    editor.rerender(refreshed);
    expect(editor.result.current.draft.title).toBe("Updated elsewhere");
    expect(editor.result.current.draft.richText.content).toBe("New saved writing");
    act(() => editor.result.current.setField("title", "My unsaved title"));
    editor.rerender({ ...refreshed, open: false });
    editor.rerender(props);
    expect(editor.result.current.draft.title).toBe("My unsaved title");
  });

  it("does not turn presentation callback failures into retryable saves", async () => {
    const props = options();
    props.onOpenChange.mockImplementation(() => { throw new Error("close failed"); });
    mocks.toast.mockImplementationOnce(() => { throw new Error("toast failed"); });
    const { result } = renderHook(() => useJournalEditor(props));
    act(() => result.current.setField("richText", richText));
    await act(async () => { await result.current.save(); });
    await act(async () => { await result.current.save(); });
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });

  it("warns on reload while dirty and removes the listener after discard", () => {
    const props = options();
    const { result } = renderHook(() => useJournalEditor(props));
    act(() => result.current.setField("richText", richText));
    const dirtyUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirtyUnload);
    expect(dirtyUnload.defaultPrevented).toBe(true);
    act(() => result.current.discard());
    const cleanUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cleanUnload);
    expect(cleanUnload.defaultPrevented).toBe(false);
  });
});

describe("journal attachment integrity", () => {
  it("retains the original after failed replacement and never deletes its stored object", async () => {
    const props = options();
    const entry = entryFor(props.bookId);
    mocks.upload.mockRejectedValueOnce(new Error("upload failed"));
    const { result } = renderHook(() => useJournalEditor({ ...props, editEntry: entry }));
    await act(async () => { await result.current.pickPhoto("photos"); });
    expect(result.current.draft.photoUrl).toBe(entry.photo_url);
    expect(result.current.draft.photoPreview).toBe(entry.photo_url);
    expect(result.current.error).toContain("Could not upload your photo");
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("stores uploaded URLs under unique paths and sends null for deliberate removal", async () => {
    const props = options();
    const { result } = renderHook(() => useJournalEditor({ ...props, editEntry: entryFor(props.bookId) }));
    await act(async () => { await result.current.pickPhoto("photos"); });
    expect(mocks.upload).toHaveBeenCalledWith("journal-photos", expect.stringMatching(/^reader\/journal-[0-9a-f-]{36}\.png$/), expect.any(Blob), { contentType: "image/png" });
    expect(result.current.draft.photoPreview).toBe("https://example.test/replacement.png");
    act(() => result.current.removePhoto());
    await act(async () => { await result.current.save(); });
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ photo_url: null }));
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("locks save and duplicate picking immediately while the picker promise is pending", async () => {
    const picker = deferred<typeof image | null>();
    mocks.pick.mockReturnValueOnce(picker.promise);
    const props = options();
    const { result } = renderHook(() => useJournalEditor(props));
    act(() => result.current.setField("richText", richText));
    let picking!: Promise<void>;
    act(() => {
      picking = result.current.pickPhoto("prompt");
      void result.current.pickPhoto("photos");
      void result.current.save();
      result.current.requestOpenChange(false);
    });
    expect(result.current.picking).toBe(true);
    expect(mocks.pick).toHaveBeenCalledTimes(1);
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onOpenChange).not.toHaveBeenCalled();
    await act(async () => { picker.resolve(null); await picking; });
    expect(result.current.busy).toBe(false);
    expect(result.current.draft.richText).toEqual(richText);
  });

  it("ignores upload completion from an unmounted editor even if the same draft reopens", async () => {
    const upload = deferred<string>();
    mocks.upload.mockReturnValueOnce(upload.promise);
    const props = { ...options(), editEntry: null as JournalEntry | null };
    props.editEntry = entryFor(props.bookId);
    const first = renderHook(() => useJournalEditor(props));
    let picking!: Promise<void>;
    act(() => { picking = first.result.current.pickPhoto("photos"); });
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1));
    first.unmount();
    const next = renderHook(() => useJournalEditor(props));
    expect(next.result.current.uploadingPhoto).toBe(true);
    await act(async () => { upload.resolve("https://example.test/late.png"); await picking; });
    expect(next.result.current.draft.photoUrl).toBe(props.editEntry.photo_url);
    expect(next.result.current.busy).toBe(false);
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("does not upload a picked image after the editor changes to another book", async () => {
    const picker = deferred<typeof image | null>();
    mocks.pick.mockReturnValueOnce(picker.promise);
    const props = options();
    const editor = renderHook((current) => useJournalEditor(current), { initialProps: props });
    let picking!: Promise<void>;
    act(() => { picking = editor.result.current.pickPhoto("prompt"); });
    editor.rerender({ ...props, bookId: `${props.bookId}-other` });
    await act(async () => { picker.resolve(image); await picking; });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(editor.result.current.draft.photoUrl).toBeNull();
  });

  it("ignores an old upload after a forced close and reopen on the same hook instance", async () => {
    const upload = deferred<string>();
    mocks.upload.mockReturnValueOnce(upload.promise);
    const base = options();
    const props = { ...base, editEntry: entryFor(base.bookId) };
    const editor = renderHook((current) => useJournalEditor(current), { initialProps: props });
    let picking!: Promise<void>;
    act(() => { picking = editor.result.current.pickPhoto("photos"); });
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1));
    editor.rerender({ ...props, open: false });
    editor.rerender(props);
    expect(editor.result.current.uploadingPhoto).toBe(true);
    await act(async () => { upload.resolve("https://example.test/stale-opening.png"); await picking; });
    expect(editor.result.current.draft.photoUrl).toBe(props.editEntry.photo_url);
    expect(editor.result.current.busy).toBe(false);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
