import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Post, PostComment } from "@/services/api";

const mocks = vi.hoisted(() => ({
  addComment: vi.fn(),
  usePostComments: vi.fn(),
  user: { id: "reader" },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/hooks/usePostComments", () => ({ usePostComments: mocks.usePostComments }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));
vi.mock("@/services/api", () => ({ blockUser: vi.fn(), deletePost: vi.fn(), sharePost: vi.fn() }));
vi.mock("@/components/ui/action-sheet", () => ({ ActionSheet: () => null }));
vi.mock("@/components/animations/HeartLike", () => ({ HeartLike: () => null }));
vi.mock("@/components/rich-text/RichTextRenderer", () => ({ RichTextRenderer: ({ content }: { content: string }) => <p>{content}</p> }));

import { CommentThread } from "./CommentThread";
import { PostCard } from "./PostCard";

const comment: PostComment = {
  id: "comment-a", post_id: "post-a", user_id: "other", content: "A thoughtful comment",
  depth: 0, reply_count: 1, created_at: "2026-09-28T12:00:00Z", updated_at: "2026-09-28T12:00:00Z",
  user: { id: "other", display_name: "Alex" },
};
const nestedComment: PostComment = {
  ...comment, id: "comment-b", parent_id: comment.id, content: "A nested reply", depth: 1,
  reply_count: 0, user: { id: "other-reader", display_name: "Sam" },
};
const post: Post = {
  id: "post-a", user_id: "other", title: "A book worth discussing", content: "The post",
  post_type: "text", visibility: "public", likes_count: 0, comments_count: 1, share_count: 0,
  created_at: comment.created_at, updated_at: comment.updated_at, user: comment.user,
};
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.id = "reader";
  mocks.addComment.mockReset().mockResolvedValue(true);
  mocks.usePostComments.mockImplementation((_postId: string, parentId?: string) => ({
    comments: parentId === undefined ? [comment] : parentId === comment.id ? [nestedComment] : [],
    loading: false, refreshing: false, hasLoaded: true, error: null,
    refetchComments: vi.fn(), hasMore: false, loadingMore: false,
    addComment: mocks.addComment, deleteComment: vi.fn(), loadMore: vi.fn(),
  }));
});
afterEach(cleanup);

describe("live post comments and nested reply ownership", () => {
  it("gives repeated editors unique labels and persistent keyboard instructions without Enter-to-send", () => {
    render(<><CommentThread postId="post-a" /><CommentThread postId="post-b" /></>);
    const editors = screen.getAllByRole("textbox", { name: "Comment" });
    expect(editors[0].id).not.toBe(editors[1].id);
    for (const editor of editors) {
      expect(editor).toHaveAccessibleDescription("Enter adds a new line. Use the Comment button to post.");
      fireEvent.change(editor, { target: { value: "An unfinished composition" } });
      fireEvent.keyDown(editor, { key: "Enter", isComposing: true, keyCode: 229 });
      fireEvent.keyDown(editor, { key: "Enter" });
      fireEvent.keyDown(editor, { key: "Enter", shiftKey: true });
    }
    expect(mocks.addComment).not.toHaveBeenCalled();
  });

  it("prevents duplicate comments, retains a newer draft on rejection and retries truthfully", async () => {
    const pending = deferred<boolean>();
    mocks.addComment.mockReturnValueOnce(pending.promise);
    render(<CommentThread postId="post-a" />);
    const editor = screen.getByRole("textbox", { name: "Comment" });
    fireEvent.change(editor, { target: { value: "The submitted comment" } });
    const submit = screen.getByRole("button", { name: "Comment" });
    act(() => { fireEvent.click(submit); fireEvent.click(submit); });
    expect(mocks.addComment).toHaveBeenCalledTimes(1);
    expect(submit).toBeDisabled();
    expect(editor).toBeEnabled();
    fireEvent.change(editor, { target: { value: "Newer writing while sending" } });
    await act(async () => pending.resolve(false));
    expect(editor).toHaveValue("Newer writing while sending");
    expect(editor).toHaveAccessibleDescription(/Comment could not be posted. Your draft is still here. Try again./);
    expect(editor).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Comment could not be posted.");
    fireEvent.click(submit);
    await waitFor(() => expect(editor).toHaveValue(""));
    expect(mocks.addComment).toHaveBeenLastCalledWith("Newer writing while sending");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("preserves a replaced draft even when its text matches the earlier successful comment", async () => {
    const pending = deferred<boolean>();
    mocks.addComment.mockReturnValueOnce(pending.promise);
    render(<CommentThread postId="post-a" />);
    const editor = screen.getByRole("textbox", { name: "Comment" });
    fireEvent.change(editor, { target: { value: "Same words" } });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    fireEvent.change(editor, { target: { value: "A different thought" } });
    fireEvent.change(editor, { target: { value: "Same words" } });
    await act(async () => pending.resolve(true));
    expect(editor).toHaveValue("Same words");
  });

  it("handles thrown write failures at the active editor without exposing service diagnostics", async () => {
    mocks.addComment.mockRejectedValueOnce(new Error("internal credentials and request details"));
    render(<CommentThread postId="post-a" />);
    const editor = screen.getByRole("textbox", { name: "Comment" });
    fireEvent.change(editor, { target: { value: "Keep my words" } });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Comment could not be posted. Your draft is still here. Try again.");
    expect(editor).toHaveValue("Keep my words");
    expect(screen.queryByText(/internal credentials/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Comment" })).toBeEnabled();
  });

  it("keeps reply parent and newer writing through a pending success, then returns focus when the unchanged retry completes", async () => {
    const pending = deferred<boolean>();
    mocks.addComment.mockReturnValueOnce(pending.promise);
    render(<CommentThread postId="post-a" />);
    const toggle = screen.getByRole("button", { name: "Reply" });
    fireEvent.click(toggle);
    const editor = screen.getByRole("textbox", { name: "Reply to Alex" });
    expect(editor).toHaveAccessibleDescription("Enter adds a new line. Use the Reply button to post.");
    fireEvent.change(editor, { target: { value: "First reply" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Reply" })[1]);
    expect(mocks.addComment).toHaveBeenCalledWith("First reply", comment.id);
    expect(toggle).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.change(editor, { target: { value: "My next reply" } });
    await act(async () => pending.resolve(true));
    expect(editor).toHaveValue("My next reply");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    editor.focus();
    fireEvent.click(screen.getAllByRole("button", { name: "Reply" })[1]);
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Reply to Alex" })).not.toBeInTheDocument());
    expect(toggle).toHaveFocus();
    expect(mocks.addComment).toHaveBeenLastCalledWith("My next reply", comment.id);
  });

  it("retains nested reply failure and draft when its ancestor is hidden and reopened", async () => {
    const pending = deferred<boolean>();
    mocks.addComment.mockReturnValueOnce(pending.promise);
    render(<CommentThread postId="post-a" />);
    fireEvent.click(screen.getByRole("button", { name: "View 1 replies" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Reply" })[1]);
    const editor = screen.getByRole("textbox", { name: "Reply to Sam" });
    fireEvent.change(editor, { target: { value: "Reply to the nested comment" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Reply" })[2]);
    fireEvent.click(screen.getByRole("button", { name: "Hide replies" }));
    expect(editor).not.toBeVisible();
    await act(async () => pending.resolve(false));
    fireEvent.click(screen.getByRole("button", { name: "View 1 replies" }));
    expect(screen.getByRole("textbox", { name: "Reply to Sam" })).toBe(editor);
    expect(editor).toHaveValue("Reply to the nested comment");
    expect(editor).toHaveAccessibleDescription(/Reply could not be posted/);
    expect(mocks.addComment).toHaveBeenCalledWith("Reply to the nested comment", nestedComment.id);
  });

  it.each(["post", "account"])("isolates a new %s from a pending prior comment", async (identity) => {
    const pending = deferred<boolean>();
    mocks.addComment.mockReturnValueOnce(pending.promise);
    const view = render(<CommentThread postId="post-a" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Comment" }), { target: { value: "Old owner" } });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    if (identity === "account") mocks.user.id = "another-reader";
    view.rerender(<CommentThread postId={identity === "post" ? "post-b" : "post-a"} />);
    const editor = screen.getByRole("textbox", { name: "Comment" });
    expect(editor).toHaveValue("");
    fireEvent.change(editor, { target: { value: "Current owner's writing" } });
    await act(async () => pending.resolve(true));
    expect(editor).toHaveValue("Current owner's writing");
  });

  it("mounts the live PostCard comments only on demand and retains the same editor across hiding", async () => {
    const pending = deferred<boolean>();
    mocks.addComment.mockReturnValueOnce(pending.promise);
    render(<MemoryRouter><PostCard post={post} onLike={vi.fn()} /></MemoryRouter>);
    expect(mocks.usePostComments).not.toHaveBeenCalled();
    const toggle = screen.getByRole("button", { name: "Comments, 1" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    const editor = screen.getByRole("textbox", { name: "Comment" });
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)).toContainElement(editor);
    fireEvent.change(editor, { target: { value: "A hidden in-flight comment" } });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    editor.focus();
    fireEvent.click(toggle);
    expect(toggle).toHaveFocus();
    expect(editor).not.toBeVisible();
    expect(mocks.usePostComments).toHaveBeenCalledWith("post-a", undefined, false);
    await act(async () => pending.resolve(false));
    fireEvent.click(toggle);
    expect(mocks.usePostComments).toHaveBeenCalledWith("post-a", undefined, true);
    expect(screen.getByRole("textbox", { name: "Comment" })).toBe(editor);
    expect(editor).toHaveValue("A hidden in-flight comment");
    expect(editor).toHaveAccessibleDescription(/Comment could not be posted/);
  });
});
