import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useState, type ComponentProps } from "react";
import type { RichTextEditor } from "@/components/rich-text/RichTextEditor";
import { toPlainRichTextPayload } from "@/lib/richText";
import { requestOverlayBack } from "@/lib/backLayers";

const mocks = vi.hoisted(() => ({
  createPost: vi.fn(), upload: vi.fn(), success: vi.fn(), error: vi.fn(), haptic: vi.fn(),
  user: { id: "reader" }, authLoading: false,
}));
vi.mock("@/services/api", () => ({ createPost: mocks.createPost, uploadPostMediaFiles: mocks.upload }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user, loading: mocks.authLoading }) }));
vi.mock("@/hooks/useBooks", () => ({ useBooks: () => ({ books: [{ id: "book", title: "A reading book" }] }) }));
vi.mock("@/hooks/useBookClubs", () => ({ useBookClubs: () => ({ clubs: [{ id: "club", name: "Reading club" }] }) }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: mocks.haptic }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
// These cases own transaction and dismissal behavior. The CR02 browser fixture
// keeps the real Tiptap editor for selection, typing and responsive DOM checks.
vi.mock("@/components/rich-text/RichTextEditor", () => ({
  RichTextEditor: ({ id, labelledBy, value, onChange, disabled }: ComponentProps<typeof RichTextEditor>) =>
    <textarea id={id} aria-labelledby={labelledBy} disabled={disabled} value={value?.content ?? ""}
      onChange={(event) => onChange(toPlainRichTextPayload(event.target.value))} />,
}));

import { CreatePostDialog } from "./CreatePostDialog";

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
};
const uploadedMedia = [{ storage_path: "reader/photo.png", media_type: "image", mime_type: "image/png", size_bytes: 4, position: 0 }];
const openPost = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Create post" }));
  return screen.findByRole("dialog", { name: "Create a Post" });
};
const writePost = () => {
  fireEvent.change(screen.getByRole("textbox", { name: "Title *" }), { target: { value: "A thoughtful post" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Content *" }), { target: { value: "A draft worth keeping" } });
};
const attach = (name = "photo.png") => {
  const file = new File(["book"], name, { type: "image/png" });
  fireEvent.change(screen.getByLabelText("Media"), { target: { files: [file] } });
  return file;
};

const originalScrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");
beforeAll(() => Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() }));
afterAll(() => {
  if (originalScrollIntoView) Object.defineProperty(Element.prototype, "scrollIntoView", originalScrollIntoView);
  else Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.id = "reader";
  mocks.authLoading = false;
  mocks.createPost.mockReset().mockResolvedValue({ id: "created" });
  mocks.upload.mockReset().mockResolvedValue(uploadedMedia);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:post-image") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("CreatePostDialog transaction ownership", () => {
  it("blocks duplicate publish and every app-owned dismissal throughout upload and create, then closes once", async () => {
    const upload = deferred<typeof uploadedMedia>();
    const publish = deferred<{ id: string }>();
    mocks.upload.mockReturnValueOnce(upload.promise);
    mocks.createPost.mockReturnValueOnce(publish.promise);
    const onOpenChange = vi.fn();
    const onCreated = vi.fn();
    render(<CreatePostDialog onOpenChange={onOpenChange} onPostCreated={onCreated} />);
    const dialog = await openPost();
    writePost();
    attach();
    const submit = screen.getByRole("button", { name: "Publish Post" });
    act(() => { fireEvent.click(submit); fireEvent.click(submit); });
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.createPost).not.toHaveBeenCalled();
    for (const phase of ["upload", "create"]) {
      expect(screen.getByRole("textbox", { name: "Title *" })).toBeDisabled();
      expect(screen.getByRole("textbox", { name: "Content *" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Add Media" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
      expect(screen.getByRole("combobox", { name: "Visibility" })).toBeDisabled();
      fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
      fireEvent.keyDown(dialog, { key: "Escape" });
      act(() => { expect(requestOverlayBack()).toBe(true); });
      expect(screen.getByRole("dialog", { name: "Create a Post" })).toBe(dialog);
      expect(screen.queryByRole("dialog", { name: "Discard post draft?" })).not.toBeInTheDocument();
      expect(onOpenChange.mock.calls.filter(([open]) => !open)).toHaveLength(0);
      if (phase === "upload") await act(async () => upload.resolve(uploadedMedia));
    }
    expect(mocks.createPost).toHaveBeenCalledTimes(1);
    await act(async () => publish.resolve({ id: "created" }));
    expect(screen.queryByRole("dialog", { name: "Create a Post" })).not.toBeInTheDocument();
    expect(onOpenChange.mock.calls.filter(([open]) => !open)).toHaveLength(1);
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(mocks.success).toHaveBeenCalledWith("Post published");
    await openPost();
    expect(screen.getByRole("textbox", { name: "Title *" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Content *" })).toHaveValue("");
    expect(screen.queryByRole("img", { name: "photo.png" })).not.toBeInTheDocument();
  });

  it.each(["Close", "Cancel", "Escape", "app Back"])("keeps dirty text and media after %s is cancelled; confirmed discard resets everything", async (method) => {
    render(<CreatePostDialog />);
    const dialog = await openPost();
    writePost();
    attach();
    const content = screen.getByRole("textbox", { name: "Content *" });
    content.focus();
    if (method === "Escape") fireEvent.keyDown(content, { key: "Escape" });
    else if (method === "app Back") act(() => { expect(requestOverlayBack()).toBe(true); });
    else fireEvent.click(within(dialog).getByRole("button", { name: method }));
    const confirmation = await screen.findByRole("dialog", { name: "Discard post draft?" });
    expect(within(confirmation).getByRole("button", { name: "Keep editing" })).toHaveFocus();
    act(() => { expect(requestOverlayBack()).toBe(true); });
    await waitFor(() => expect(confirmation).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: "Create a Post" })).toBe(dialog);
    expect(content).toHaveValue("A draft worth keeping");
    expect(screen.getByRole("img", { name: "photo.png" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard draft" }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: "Create post" })).toHaveFocus());
    await openPost();
    expect(screen.getByRole("textbox", { name: "Title *" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Content *" })).toHaveValue("");
    expect(screen.queryByRole("img", { name: "photo.png" })).not.toBeInTheDocument();
    expect(mocks.createPost).not.toHaveBeenCalled();
  });

  it("preserves a rejected publish and reuses only the unchanged completed upload on retry", async () => {
    mocks.createPost.mockRejectedValueOnce(new Error("Post is unavailable"));
    render(<CreatePostDialog />);
    await openPost();
    writePost();
    attach();
    fireEvent.click(screen.getByRole("button", { name: "Publish Post" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Post is unavailable");
    expect(screen.getByRole("textbox", { name: "Content *" })).toHaveValue("A draft worth keeping");
    expect(screen.getByRole("button", { name: "Publish Post" })).toHaveAccessibleDescription("Post is unavailable");
    expect(screen.getByRole("textbox", { name: "Title *" })).not.toHaveAttribute("aria-invalid", "true");
    fireEvent.click(screen.getByRole("button", { name: "Publish Post" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.createPost).toHaveBeenCalledTimes(2);
    expect(mocks.createPost.mock.calls[1][0]).toEqual(mocks.createPost.mock.calls[0][0]);
  });

  it("treats media without text as a draft and retains it when discard is refused", async () => {
    render(<CreatePostDialog />);
    await openPost();
    attach();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(await screen.findByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("img", { name: "photo.png" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Title *" })).toHaveValue("");
    expect(mocks.createPost).not.toHaveBeenCalled();
  });

  it("protects a visibility-only selection without requiring text or media", async () => {
    render(<CreatePostDialog />);
    await openPost();
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Visibility" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Only me" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(await screen.findByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("combobox", { name: "Visibility" })).toHaveTextContent("Only me");
    expect(mocks.createPost).not.toHaveBeenCalled();
  });

  it("retains an upload failure without publishing, and uploads a replaced selection afresh", async () => {
    mocks.upload.mockRejectedValueOnce(new Error("Upload is unavailable"));
    mocks.createPost.mockRejectedValueOnce(new Error("Publish is unavailable"));
    render(<CreatePostDialog />);
    await openPost();
    writePost();
    attach();
    fireEvent.click(screen.getByRole("button", { name: "Publish Post" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Upload is unavailable");
    expect(mocks.createPost).not.toHaveBeenCalled();
    expect(screen.getByRole("img", { name: "photo.png" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publish Post" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Publish is unavailable"));
    const replacement = attach("replacement.png");
    fireEvent.click(screen.getByRole("button", { name: "Publish Post" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.upload).toHaveBeenCalledTimes(3);
    expect(mocks.upload).toHaveBeenLastCalledWith([replacement]);
  });

  it.each(["unmount", "account change"])("does not create or announce a post after upload outlives %s", async (transition) => {
    const upload = deferred<typeof uploadedMedia>();
    mocks.upload.mockReturnValueOnce(upload.promise);
    const onCreated = vi.fn();
    const view = render(<CreatePostDialog onPostCreated={onCreated} />);
    await openPost();
    writePost();
    attach();
    fireEvent.click(screen.getByRole("button", { name: "Publish Post" }));
    if (transition === "unmount") view.unmount();
    else { mocks.user.id = "another-reader"; view.rerender(<CreatePostDialog onPostCreated={onCreated} />); }
    await act(async () => upload.resolve(uploadedMedia));
    expect(mocks.createPost).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    if (transition === "account change") {
      await openPost();
      expect(screen.getByRole("textbox", { name: "Title *" })).toHaveValue("");
      expect(screen.queryByRole("img", { name: "photo.png" })).not.toBeInTheDocument();
    }
  });

  it.each(["throws", "rejects"])("does not misreport a confirmed publish when the refresh callback %s", async (failure) => {
    const onCreated = vi.fn(() => {
      if (failure === "rejects") return Promise.reject(new Error("Refresh failed"));
      throw new Error("Refresh failed");
    });
    render(<CreatePostDialog onPostCreated={onCreated} />);
    await openPost();
    writePost();
    fireEvent.click(screen.getByRole("button", { name: "Publish Post" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.success).toHaveBeenCalledWith("Post published");
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.createPost).toHaveBeenCalledTimes(1);
  });

  it.each(["auth loading", "new reader"])("closes a controlled task on %s and ignores its obsolete create result", async (transition) => {
    const publish = deferred<{ id: string }>();
    mocks.createPost.mockReturnValueOnce(publish.promise);
    const onCreated = vi.fn();
    const Controlled = () => {
      const [open, setOpen] = useState(false);
      return <CreatePostDialog open={open} onOpenChange={setOpen} onPostCreated={onCreated} />;
    };
    const view = render(<Controlled />);
    await openPost();
    writePost();
    fireEvent.click(screen.getByRole("button", { name: "Publish Post" }));
    if (transition === "auth loading") mocks.authLoading = true;
    else mocks.user.id = "another-reader";
    view.rerender(<Controlled />);
    await act(async () => publish.resolve({ id: "created" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    mocks.authLoading = false;
    view.rerender(<Controlled />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await openPost();
    expect(screen.getByRole("textbox", { name: "Title *" })).toHaveValue("");
  });
});
