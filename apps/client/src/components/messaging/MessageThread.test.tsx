import { act, cleanup, createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  online: true,
  upload: vi.fn(),
  gifs: vi.fn(),
  typing: vi.fn(),
  haptic: vi.fn(),
  block: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  blockUser: mocks.block,
  uploadMessageMediaFiles: mocks.upload,
  searchMessageGifs: mocks.gifs,
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/hooks/useTypingIndicator", () => ({ useTypingIndicator: () => ({ otherUserTyping: false, setTyping: mocks.typing }) }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: mocks.haptic }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => true }));
vi.mock("@/hooks/useNetworkStatus", () => ({ useNetworkStatus: () => mocks.online }));
vi.mock("@/contexts/ProfileContext", () => ({ useProfileContext: () => ({ profile: { display_name: "Reader" } }) }));
vi.mock("emoji-picker-react", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { MessageThread } from "./MessageThread";
import { registerBackLayer, requestOverlayBack } from "@/lib/backLayers";
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

const touchStart = (target: HTMLElement, x = 100, y = 80) => fireEvent.touchStart(target, { touches: [{ identifier: 1, clientX: x, clientY: y }], changedTouches: [{ identifier: 1, clientX: x, clientY: y }] });
const touchMove = (target: HTMLElement, x = 190, y = 80, identifier = 1) => {
  const event = createEvent.touchMove(target, { touches: [{ identifier, clientX: x, clientY: y }], changedTouches: [{ identifier, clientX: x, clientY: y }], cancelable: true });
  fireEvent(target, event);
  return event;
};
const touchEnd = (target: HTMLElement) => fireEvent.touchEnd(target, { touches: [], changedTouches: [{ identifier: 1, clientX: 190, clientY: 80 }] });
const replySwipe = (target: HTMLElement) => { touchStart(target); touchMove(target); touchEnd(target); };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.online = true;
  mocks.upload.mockResolvedValue([uploaded]);
  mocks.gifs.mockResolvedValue({ results: [gif] });
  mocks.block.mockResolvedValue(undefined);
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:preview") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
});

afterEach(() => { cleanup(); window.getSelection()?.removeAllRanges(); vi.restoreAllMocks(); });

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


describe("MessageThread local actions and gesture ownership", () => {
  it("keeps a visible named action and native text context menu, then returns Reply focus to the composer", async () => {
    render(<MessageThread {...makeProps()} messages={[received]} />);
    const actions = screen.getByRole("button", { name: "Message actions" });
    expect(actions.className).not.toContain("opacity-0");
    const nativeMenu = createEvent.contextMenu(screen.getByText("Original message"), { cancelable: true });
    fireEvent(screen.getByText("Original message"), nativeMenu);
    expect(nativeMenu.defaultPrevented).toBe(false);
    fireEvent.click(actions);
    expect(screen.queryByRole("button", { name: "Report" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Message" })).toHaveFocus());
    expect(screen.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel reply" })).toBeInTheDocument();
  });

  it("replies once from an interior right swipe and restores its translated bubble", async () => {
    const props = makeProps();
    render(<MessageThread {...props} messages={[received]} />);
    const content = screen.getByText("Original message");
    touchStart(content);
    expect(touchMove(content).defaultPrevented).toBe(true);
    expect(content.closest("[data-message-reply-surface]")?.querySelector<HTMLDivElement>("div[style]")?.style.transform).toBe("translateX(54px)");
    touchEnd(content);
    expect(content.closest("[data-message-reply-surface]")?.querySelector<HTMLDivElement>("div[style]")?.style.transform).toBe("translateX(0px)");
    const composer = screen.getByRole("textbox", { name: "Message" });
    expect(composer).toHaveFocus();
    fireEvent.change(composer, { target: { value: "Reply content" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(props.onSendMessage).toHaveBeenCalledWith(expect.objectContaining({ reply_to_message_id: received.id })));
    expect(props.onSendMessage).toHaveBeenCalledTimes(1);
  });

  it.each(["vertical", "left", "edge", "second finger", "replacement contact", "scroll", "cancel", "context menu", "selection", "blur", "overlay"])("cancels a reply after %s and leaves the next independent swipe usable", (reason) => {
    render(<MessageThread {...makeProps()} messages={[received]} />);
    const content = screen.getByText("Original message");
    let removeLayer: (() => void) | undefined;
    let layer: HTMLElement | undefined;
    touchStart(content, reason === "edge" ? 8 : 100);
    if (reason === "vertical") expect(touchMove(content, 104, 115).defaultPrevented).toBe(false);
    else if (reason === "left") expect(touchMove(content, 60).defaultPrevented).toBe(false);
    else if (reason === "second finger") fireEvent.touchStart(document.body, { touches: [{ identifier: 1, clientX: 100, clientY: 80 }, { identifier: 2, clientX: 150, clientY: 80 }] });
    else if (reason === "replacement contact") touchMove(content, 190, 80, 2);
    else if (reason === "scroll") fireEvent.scroll(screen.getByRole("region", { name: "Message history" }));
    else if (reason === "cancel") fireEvent.touchCancel(content);
    else if (reason === "context menu") fireEvent.contextMenu(content);
    else if (reason === "selection") {
      const range = document.createRange(); range.selectNodeContents(content); window.getSelection()?.addRange(range);
      fireEvent(document, new Event("selectionchange"));
    } else if (reason === "blur") fireEvent(window, new Event("blur"));
    else if (reason === "overlay") {
      layer = document.createElement("div"); layer.dataset.state = "open"; document.body.append(layer); removeLayer = registerBackLayer(layer);
    }
    expect(touchMove(content).defaultPrevented).toBe(false);
    touchEnd(content);
    expect(screen.queryByRole("button", { name: "Cancel reply" })).not.toBeInTheDocument();
    window.getSelection()?.removeAllRanges(); removeLayer?.(); layer?.remove();
    replySwipe(content);
    expect(screen.getByRole("button", { name: "Cancel reply" })).toBeInTheDocument();
  });

  it("rejects selected text, attachment controls, open overlays and a pending composer as gesture origins", async () => {
    const pending = deferred<boolean>();
    const props = makeProps(); props.onSendMessage.mockReturnValue(pending.promise);
    render(<MessageThread {...props} messages={[{ ...received, media: [{ ...uploaded, signed_url: "https://example.test/image.webp" }] }]} />);
    const content = screen.getByText("Original message");
    const media = screen.getByRole("button", { name: "Open message image" });
    replySwipe(media);
    expect(screen.queryByRole("button", { name: "Cancel reply" })).not.toBeInTheDocument();
    fireEvent.click(media); replySwipe(content);
    expect(screen.queryByRole("button", { name: "Cancel reply" })).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog", { name: "Message media" })).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    window.getSelection()?.removeAllRanges();
    const range = document.createRange(); range.selectNodeContents(content); window.getSelection()?.addRange(range);
    expect(window.getSelection()?.toString()).toBe("Original message");
    replySwipe(content);
    expect(screen.queryByRole("button", { name: "Cancel reply" })).not.toBeInTheDocument();
    window.getSelection()?.removeAllRanges();
    fireEvent.change(screen.getByRole("textbox", { name: "Message" }), { target: { value: "Pending" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" })); replySwipe(content);
    expect(screen.queryByRole("button", { name: "Cancel reply" })).not.toBeInTheDocument();
    await act(async () => pending.resolve(true)); replySwipe(content);
    expect(screen.getByRole("button", { name: "Cancel reply" })).toBeInTheDocument();
  });

  it("retains the history reading position on refresh and offers an explicit latest-message action", () => {
    const props = makeProps();
    const { rerender } = render(<MessageThread {...props} messages={[received]} />);
    const history = screen.getByRole("region", { name: "Message history" });
    Object.defineProperties(history, { scrollHeight: { configurable: true, value: 1500 }, clientHeight: { configurable: true, value: 400 } });
    history.scrollTop = 200; fireEvent.scroll(history);
    rerender(<MessageThread {...props} messages={[{ ...received }, { ...received, id: "latest", content: "Latest message" }]} />);
    expect(history.scrollTop).toBe(200);
    fireEvent.click(screen.getByRole("button", { name: "Latest messages" }));
    expect(history.scrollTop).toBe(1500);
    expect(screen.queryByRole("button", { name: "Latest messages" })).not.toBeInTheDocument();
    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it("reports transient draft and pending ownership, and emits one initiation haptic per send", async () => {
    const pending = deferred<boolean>(); const props = makeProps(); const onTaskStateChange = vi.fn();
    props.onSendMessage.mockReturnValue(pending.promise);
    const { unmount } = render(<MessageThread {...props} onTaskStateChange={onTaskStateChange} messages={[received]} />);
    replySwipe(screen.getByText("Original message"));
    expect(onTaskStateChange).toHaveBeenLastCalledWith({ pending: false, hasTransientDraft: true });
    fireEvent.change(screen.getByRole("textbox", { name: "Message" }), { target: { value: "Send this" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(onTaskStateChange).toHaveBeenLastCalledWith({ pending: true, hasTransientDraft: true });
    expect(mocks.haptic.mock.calls.filter(([kind]) => kind === "light")).toHaveLength(1);
    await act(async () => pending.resolve(true));
    expect(onTaskStateChange).toHaveBeenLastCalledWith({ pending: false, hasTransientDraft: false });
    expect(mocks.haptic.mock.calls.filter(([kind]) => kind === "success")).toHaveLength(1);
    unmount(); expect(onTaskStateChange).toHaveBeenLastCalledWith({ pending: false, hasTransientDraft: false });
  });

  it("keeps block confirmation pending through Back, preserves failure, and confirms only after retry", async () => {
    const pending = deferred<void>(); mocks.block.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(undefined);
    const state = vi.fn(); render(<MessageThread {...makeProps()} onTaskStateChange={state} />);
    const options = screen.getByRole("button", { name: "Conversation options" });
    fireEvent.click(options); fireEvent.click(screen.getByRole("button", { name: "Block reader" }));
    const dialog = screen.getByRole("dialog", { name: "Block Other Reader?" });
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(mocks.block).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Block reader" }));
    act(() => { expect(requestOverlayBack()).toBe(true); });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(dialog).toBeInTheDocument(); expect(state).toHaveBeenLastCalledWith({ pending: true, hasTransientDraft: false });
    await act(async () => pending.reject(new Error("Block unavailable")));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Block unavailable");
    fireEvent.click(within(dialog).getByRole("button", { name: "Block reader" }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(mocks.block).toHaveBeenCalledTimes(2); await waitFor(() => expect(options).toHaveFocus());
  });

  it("confirms own-message deletion, keeps failure retryable, then focuses the surviving composer", async () => {
    const props = makeProps(); const pending = deferred<boolean>();
    props.onDeleteMessage.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(true);
    render(<MessageThread {...props} messages={[{ ...received, sender_id: "reader" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Message actions" })); fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Delete message?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete message" }));
    act(() => { expect(requestOverlayBack()).toBe(true); }); expect(dialog).toBeInTheDocument();
    await act(async () => pending.resolve(false));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Message wasn't deleted");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete message" }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument()); expect(props.onDeleteMessage).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Message" })).toHaveFocus());
  });

  it("serializes reaction taps and retains truthful inline rejection", async () => {
    const props = makeProps(); const pending = deferred<boolean>();
    props.onToggleReaction.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(true);
    render(<MessageThread {...props} messages={[received]} />);
    fireEvent.click(screen.getByRole("button", { name: "Message actions" }));
    const reaction = screen.getAllByRole("button").find(button => button.closest("fieldset"))!;
    fireEvent.click(reaction); fireEvent.click(reaction);
    expect(props.onToggleReaction).toHaveBeenCalledTimes(1); expect(reaction).toBeDisabled();
    await act(async () => pending.resolve(false));
    expect(screen.getByRole("alert")).toHaveTextContent("Reaction wasn't saved");
    fireEvent.click(reaction); await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(props.onToggleReaction).toHaveBeenCalledTimes(2);
  });

  it("uses the parent departure guard for profile navigation and discards a replaced owner's approval", async () => {
    const departure = deferred<boolean>(); const onBeforeLeave = vi.fn().mockResolvedValueOnce(false).mockReturnValueOnce(departure.promise);
    const props = makeProps();
    const { rerender } = render(<MessageThread {...props} onBeforeLeave={onBeforeLeave} messages={[received]} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Other Reader profile" }));
    await waitFor(() => expect(onBeforeLeave).toHaveBeenCalledTimes(1)); expect(mocks.navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Open Other Reader profile" }));
    rerender(<MessageThread {...props} conversationId="second" onBeforeLeave={onBeforeLeave} messages={[received]} />);
    await act(async () => departure.resolve(true)); expect(mocks.navigate).not.toHaveBeenCalled();
  });
});

describe("MessageThread mutation exclusion", () => {
  it("refuses conflicting writes during a send while leaving its next text draft editable", async () => {
    const props = makeProps(); const pending = deferred<boolean>(); props.onSendMessage.mockReturnValue(pending.promise);
    render(<MessageThread {...props} showParticipantHeader messages={[{ ...received, sender_id: "reader" }]} />);
    const composer = screen.getByRole("textbox", { name: "Message" });
    fireEvent.change(composer, { target: { value: "Submitted" } }); fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(screen.getByRole("button", { name: "Block" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Message actions" }));
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reply" })).toBeDisabled();
    for (const reaction of screen.getAllByRole("button").filter(button => button.closest("fieldset"))) expect(reaction).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.change(composer, { target: { value: "Newer draft" } });
    await act(async () => pending.resolve(true)); expect(composer).toHaveValue("Newer draft");
    expect(props.onDeleteMessage).not.toHaveBeenCalled(); expect(props.onToggleReaction).not.toHaveBeenCalled(); expect(mocks.block).not.toHaveBeenCalled();
  });

  it("refuses Send during a reaction and ignores an obsolete block failure after owner replacement", async () => {
    const props = makeProps(); const reaction = deferred<boolean>(); props.onToggleReaction.mockReturnValue(reaction.promise);
    const { rerender } = render(<MessageThread {...props} showParticipantHeader messages={[received]} />);
    const composer = screen.getByRole("textbox", { name: "Message" }); fireEvent.change(composer, { target: { value: "Kept text" } });
    fireEvent.click(screen.getByRole("button", { name: "Message actions" }));
    fireEvent.click(screen.getAllByRole("button").find(button => button.closest("fieldset"))!);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    fireEvent.keyDown(composer, { key: "Enter" }); expect(props.onSendMessage).not.toHaveBeenCalled();
    await act(async () => reaction.resolve(true));
    const block = deferred<void>(); mocks.block.mockReturnValue(block.promise);
    fireEvent.click(screen.getByRole("button", { name: "Block" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Block Other Reader?" })).getByRole("button", { name: "Block reader" }));
    rerender(<MessageThread {...props} currentUserId="second-reader" showParticipantHeader messages={[received]} />);
    await act(async () => block.reject(new Error("Obsolete block failure")));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(composer).toHaveValue(""); expect(localStorage.getItem("message_draft_reader_chat")).toBe("Kept text");
  });
});

describe("MessageThread responsive action focus", () => {
  it.each([true, false])("keeps the Block dialog through participant-header reflow from %s and focuses its current alternative", async (showParticipantHeader) => {
    const props = makeProps();
    const { rerender } = render(<MessageThread {...props} showParticipantHeader={showParticipantHeader} />);
    if (!showParticipantHeader) fireEvent.click(screen.getByRole("button", { name: "Conversation options" }));
    fireEvent.click(screen.getByRole("button", { name: showParticipantHeader ? "Block" : "Block reader" }));
    const dialog = screen.getByRole("dialog", { name: "Block Other Reader?" });
    rerender(<MessageThread {...props} showParticipantHeader={!showParticipantHeader} />);
    expect(screen.getByRole("dialog", { name: "Block Other Reader?" })).toBe(dialog);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.getByRole("button", { name: showParticipantHeader ? "Conversation options" : "Block" })).toHaveFocus());
    expect(mocks.block).not.toHaveBeenCalled();
  });
});
