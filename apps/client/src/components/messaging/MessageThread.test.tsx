import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  online: true,
  upload: vi.fn(),
  gifs: vi.fn(),
  typing: vi.fn(),
  haptic: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  blockUser: vi.fn(),
  uploadMessageMediaFiles: mocks.upload,
  searchMessageGifs: mocks.gifs,
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/hooks/useTypingIndicator", () => ({ useTypingIndicator: () => ({ otherUserTyping: false, setTyping: mocks.typing }) }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: mocks.haptic }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => true }));
vi.mock("@/hooks/useNetworkStatus", () => ({ useNetworkStatus: () => mocks.online }));
vi.mock("@/contexts/ProfileContext", () => ({ useProfileContext: () => ({ profile: { display_name: "Reader" } }) }));
vi.mock("emoji-picker-react", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { MessageThread } from "./MessageThread";
import { requestOverlayBack } from "@/lib/backLayers";
import type { Message, MessageMedia } from "@/services/api";

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
};

const received: Message = {
  id: "received", conversation_id: "chat", sender_id: "other", content: "Original message",
  message_type: "text", created_at: "2026-09-01T12:00:00Z",
};
const uploaded: MessageMedia = { media_source: "upload", media_type: "image", storage_path: "reader/image.webp", mime_type: "image/webp" };
const gif = { id: "gif", provider: "tenor" as const, provider_id: "gif", title: "Reading", url: "https://example.test/reading.gif", preview_url: "https://example.test/preview.gif" };
const makeProps = () => ({
  messages: [] as Message[], conversationId: "chat", currentUserId: "reader",
  otherUser: { id: "other", display_name: "Other Reader" },
  onSendMessage: vi.fn().mockResolvedValue(true), onDeleteMessage: vi.fn().mockResolvedValue(true), onToggleReaction: vi.fn().mockResolvedValue(true),
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.online = true;
  mocks.upload.mockResolvedValue([uploaded]);
  mocks.gifs.mockResolvedValue({ results: [gif] });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:preview") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("the live direct-message composer", () => {
  it("keeps a persistent name and help, ignores IME/Shift+Enter, and serializes pending sends", async () => {
    const pending = deferred<boolean>();
    const props = makeProps();
    props.onSendMessage.mockReturnValue(pending.promise);
    render(<MessageThread {...props} />);
    const composer = screen.getByRole("textbox", { name: "Message" });
    expect(composer).toHaveAccessibleDescription("Enter sends; Shift+Enter adds a new line.");
    fireEvent.change(composer, { target: { value: "First draft" } });
    fireEvent.keyDown(composer, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(composer, { key: "Enter", isComposing: true });
    fireEvent.keyDown(composer, { key: "Enter", keyCode: 229 });
    expect(props.onSendMessage).not.toHaveBeenCalled();
    fireEvent.keyDown(composer, { key: "Enter" });
    fireEvent.keyDown(composer, { key: "Enter" });
    expect(props.onSendMessage).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    expect(composer).toBeEnabled();
    fireEvent.change(composer, { target: { value: "A newer draft" } });
    await act(async () => pending.resolve(true));
    expect(composer).toHaveValue("A newer draft");
    expect(localStorage.getItem("message_draft_reader_chat")).toBe("A newer draft");
    expect(props.onSendMessage.mock.calls[0][0]).toMatchObject({ content: "First draft" });
  });

  it("retains text, files and reply after rejection and retries the same uploaded request once", async () => {
    const props = makeProps();
    props.messages = [received];
    props.onSendMessage.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<MessageThread {...props} />);
    const composer = screen.getByRole("textbox", { name: "Message" });
    fireEvent.change(composer, { target: { value: "Keep this reply" } });
    fireEvent.click(screen.getByRole("button", { name: "Message actions" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reply" }));
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.change(screen.getByLabelText("Attach message media"), { target: { files: [new File(["image"], "cover.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Message wasn't sent");
    expect(composer).toHaveValue("Keep this reply");
    expect(composer).toHaveAccessibleDescription(/Message wasn't sent/);
    expect(composer).not.toHaveAttribute("aria-invalid", "true");

    expect(screen.getByRole("button", { name: "Cancel reply" })).toBeEnabled();
    expect(screen.getByAltText("cover.png")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(composer).toHaveValue(""));
    expect(props.onSendMessage).toHaveBeenCalledTimes(2);
    expect(props.onSendMessage.mock.calls[0][0]).toBe(props.onSendMessage.mock.calls[1][0]);
    expect(props.onSendMessage.mock.calls[0][0]).toMatchObject({ reply_to_message_id: "received", media: [uploaded], client_message_id: expect.any(String) });
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Cancel reply" })).not.toBeInTheDocument();
    expect(screen.queryByAltText("cover.png")).not.toBeInTheDocument();
  });

  it("handles upload rejection without sending, keeps files and newer text, then allows retry", async () => {
    const upload = deferred<MessageMedia[]>();
    mocks.upload.mockReturnValueOnce(upload.promise);
    const props = makeProps();
    render(<MessageThread {...props} />);
    const composer = screen.getByRole("textbox", { name: "Message" });
    fireEvent.change(composer, { target: { value: "Attached" } });
    fireEvent.change(screen.getByLabelText("Attach message media"), { target: { files: [new File(["image"], "cover.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(screen.getByRole("button", { name: "Remove attached media" })).toBeDisabled();
    fireEvent.change(composer, { target: { value: "Revised during upload" } });
    await act(async () => upload.reject(new Error("Image upload unavailable")));
    expect(screen.getByRole("alert")).toHaveTextContent("Image upload unavailable");
    expect(screen.getByRole("button", { name: "Attach image or GIF" })).toHaveAccessibleDescription("Image upload unavailable");
    expect(composer).toHaveValue("Revised during upload");
    expect(screen.getByAltText("cover.png")).toBeInTheDocument();
    expect(props.onSendMessage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(composer).toHaveValue(""));
    expect(props.onSendMessage).toHaveBeenCalledWith(expect.objectContaining({ content: "Revised during upload" }));
  });

  it("validates content and media inline and retains an editable offline draft", async () => {
    const props = makeProps();
    const { rerender } = render(<MessageThread {...props} />);
    const composer = screen.getByRole("textbox", { name: "Message" });
    fireEvent.change(composer, { target: { value: "x".repeat(5001) } });
    fireEvent.keyDown(composer, { key: "Enter" });
    expect(composer).toHaveAttribute("aria-invalid", "true");
    expect(composer).toHaveAccessibleDescription(/5000 characters or fewer/);
    fireEvent.change(composer, { target: { value: "Offline draft" } });
    fireEvent.change(screen.getByLabelText("Attach message media"), { target: { files: [new File(["text"], "notes.txt", { type: "text/plain" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent("notes.txt is not a supported image or GIF");
    expect(props.onSendMessage).not.toHaveBeenCalled();
    mocks.online = false;
    rerender(<MessageThread {...props} />);
    expect(composer).toBeEnabled();
    expect(composer).toHaveAccessibleDescription(/Connect to send/);
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    fireEvent.keyDown(composer, { key: "Enter" });
    expect(props.onSendMessage).not.toHaveBeenCalled();
    rerender(<MessageThread {...props} isBlocked />);
    expect(composer).toBeDisabled();
    expect(composer).toHaveAccessibleDescription(/privacy or safety/);
    expect(composer).toHaveValue("Offline draft");
  });

  it("does not clear another conversation or send after its upload owner is replaced", async () => {
    const upload = deferred<MessageMedia[]>();
    mocks.upload.mockReturnValueOnce(upload.promise);
    const props = makeProps();
    const { rerender } = render(<MessageThread {...props} />);
    const composer = screen.getByRole("textbox", { name: "Message" });
    fireEvent.change(composer, { target: { value: "First conversation" } });
    fireEvent.change(screen.getByLabelText("Attach message media"), { target: { files: [new File(["image"], "cover.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    localStorage.setItem("message_draft_reader_second", "Second conversation draft");
    rerender(<MessageThread {...props} conversationId="second" />);
    expect(composer).toHaveValue("Second conversation draft");
    await act(async () => upload.resolve([uploaded]));
    expect(props.onSendMessage).not.toHaveBeenCalled();
    expect(composer).toHaveValue("Second conversation draft");
    expect(localStorage.getItem("message_draft_reader_chat")).toBe("First conversation");
    expect(localStorage.getItem("message_draft_reader_second")).toBe("Second conversation draft");
  });

  it("announces a thrown send failure without stealing focus from another action", async () => {
    const send = deferred<boolean>();
    const props = makeProps();
    props.onSendMessage.mockReturnValueOnce(send.promise);
    render(<><button>Another action</button><MessageThread {...props} /></>);
    const composer = screen.getByRole("textbox", { name: "Message" });
    fireEvent.change(composer, { target: { value: "Keep this text" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    const otherAction = screen.getByRole("button", { name: "Another action" });
    otherAction.focus();
    await act(async () => send.reject(new Error("Send unavailable")));
    expect(screen.getByRole("alert")).toHaveTextContent("Send unavailable");
    expect(composer).toHaveAccessibleDescription(/Send unavailable/);
    expect(composer).toHaveValue("Keep this text");
    expect(otherAction).toHaveFocus();
  });

  it("scopes saved drafts and late outcomes to the reader and never imports an unowned legacy draft", async () => {
    localStorage.setItem("message_draft_chat", "Unowned legacy draft");
    localStorage.setItem("message_draft_second-reader_chat", "Second reader draft");
    const send = deferred<boolean>();
    const props = makeProps();
    props.onSendMessage.mockReturnValueOnce(send.promise);
    const { rerender } = render(<MessageThread {...props} />);
    const composer = screen.getByRole("textbox", { name: "Message" });
    expect(composer).toHaveValue("");
    fireEvent.change(composer, { target: { value: "First reader draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    rerender(<MessageThread {...props} currentUserId="second-reader" />);
    expect(composer).toHaveValue("Second reader draft");
    await act(async () => send.resolve(false));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(composer).toHaveValue("Second reader draft");
    expect(localStorage.getItem("message_draft_reader_chat")).toBe("First reader draft");
    expect(localStorage.getItem("message_draft_second-reader_chat")).toBe("Second reader draft");
    expect(localStorage.getItem("message_draft_chat")).toBe("Unowned legacy draft");
    expect(screen.getByRole("button", { name: "Send message" })).toBeEnabled();
  });

  it("does not start a message write when an upload finishes after unmount", async () => {
    const upload = deferred<MessageMedia[]>();
    mocks.upload.mockReturnValueOnce(upload.promise);
    const props = makeProps();
    const { unmount } = render(<MessageThread {...props} />);
    fireEvent.change(screen.getByLabelText("Attach message media"), { target: { files: [new File(["image"], "cover.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    unmount();
    await act(async () => upload.resolve([uploaded]));
    expect(props.onSendMessage).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  it("preserves attachments through GIF sending, prevents pending dismissal and retries rejection", async () => {
    const send = deferred<boolean>();
    const props = makeProps();
    props.onSendMessage.mockReturnValueOnce(send.promise).mockResolvedValueOnce(true);
    render(<MessageThread {...props} />);
    const composer = screen.getByRole("textbox", { name: "Message" });
    fireEvent.change(composer, { target: { value: "GIF caption" } });
    fireEvent.change(screen.getByLabelText("Attach message media"), { target: { files: [new File(["image"], "cover.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Search GIFs" }));
    const dialog = screen.getByRole("dialog", { name: "Search GIFs" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Search GIFs" }), { target: { value: "reading" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Search" }));
    const sendGif = await within(dialog).findByRole("button", { name: "Send GIF: Reading" });
    fireEvent.click(sendGif);
    fireEvent.click(sendGif);
    expect(props.onSendMessage).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    act(() => { expect(requestOverlayBack()).toBe(true); });
    expect(dialog).toBeInTheDocument();
    await act(async () => send.resolve(false));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Message wasn't sent");
    fireEvent.click(sendGif);
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(composer).toHaveValue("");
    expect(screen.getByAltText("cover.png")).toBeInTheDocument();
    expect(props.onSendMessage.mock.calls[0][0]).toBe(props.onSendMessage.mock.calls[1][0]);
    expect(props.onSendMessage.mock.calls[0][0]).toMatchObject({ gif, content: "GIF caption" });
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});

describe("direct-message media dialog", () => {
  it("keeps failed media dismissible and retries loading on the next opening", async () => {
    const props = makeProps();
    props.messages = [{ ...received, media: [{ ...uploaded, signed_url: "https://example.test/missing.webp" }] }];
    render(<MessageThread {...props} />);
    const opener = screen.getByRole("button", { name: "Open message image" });
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Message media" });
    fireEvent.error(within(dialog).getByRole("img", { name: "Message media preview" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("This media could not load");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(opener).toHaveFocus());
    fireEvent.click(opener);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Message media preview" })).toBeInTheDocument();
  });

  it.each(["close", "Escape", "app Back"])("has a name and description and restores its opener after %s", async (dismissal) => {
    const props = makeProps();
    props.messages = [{ ...received, media: [{ ...uploaded, signed_url: "https://example.test/image.webp" }] }];
    render(<MessageThread {...props} />);
    const opener = screen.getByRole("button", { name: "Open message image" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Message media" });
    expect(dialog).toHaveAccessibleDescription("Full-size media from this conversation.");
    if (dismissal === "close") fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    else if (dismissal === "Escape") fireEvent.keyDown(document, { key: "Escape" });
    else act(() => { expect(requestOverlayBack()).toBe(true); });
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });
});

