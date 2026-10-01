import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { ConversationsList } from "@/components/messaging/ConversationsList";
import { MessageThread, type MessageThreadTaskState } from "@/components/messaging/MessageThread";
import { useConversations } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { useAuth } from "@/hooks/useAuth";
import { LoadingError, LoadingRegion } from "@/components/loading/LoadingRegion";
import { ConversationsSkeleton, MessageThreadSkeleton } from "@/components/skeletons/MessagesSkeleton";
import { useLocation } from "react-router-dom";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { NativeHeader } from "@/components/NativeHeader";
import { PullToRefresh } from "@/components/PullToRefresh";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { useUIEnvironmentValue } from "@/hooks/useUIEnvironment";
import { useAppBackGuard } from "@/hooks/useAppBackGuard";
import { useConfirmDialog } from "@/contexts/ConfirmDialogContext";
import { Button } from "@/components/ui/button";

const Messages = () => {
  const { user, loading } = useAuth();
  return <MessagesContent key={`${user?.id ?? "anonymous"}:${loading ? "resolving" : "ready"}`} />;
};

const MessagesContent = () => {
  const location = useLocation();
  const { conversations, loading, hasLoaded, error, getOrCreateConversation, refetchConversations } = useConversations();
  const { user, loading: authLoading } = useAuth();
  const readerId = user?.id;
  const compactChrome = useUIEnvironmentValue(environment => environment.windowClass !== "expanded");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const { messages, detail, loading: messagesLoading, hasLoaded: messagesLoaded, error: messagesError,
    refetchMessages, sendMessage, toggleReaction, deleteMessage } = useMessages(selectedConversationId);
  const confirm = useConfirmDialog();
  const workspace = useRef<HTMLElement>(null);
  const remProbe = useRef<HTMLSpanElement>(null);
  const inbox = useRef<HTMLElement>(null);
  const thread = useRef<HTMLElement>(null);
  const inboxHeading = useRef<HTMLHeadingElement>(null);
  const [splitPane, setSplitPane] = useState(false);
  const [focusRequest, setFocusRequest] = useState<"inbox" | "thread" | null>(null);
  const lastConversation = useRef<string | null>(null);
  const taskState = useRef<MessageThreadTaskState>({ pending: false, hasTransientDraft: false });
  const [taskPending, setTaskPending] = useState(false);
  const departurePending = useRef(false);
  const generation = useRef(0);
  const [entryPending, setEntryPending] = useState(false);
  const [entryError, setEntryError] = useState(false);
  const [entryRetry, setEntryRetry] = useState(0);
  const entryIntent = useRef<string | null>(null);
  const entryRequest = useRef<{ intent: string; promise: Promise<string | null> } | null>(null);
  const selectionIntent = useRef(0);

  useLayoutEffect(() => {
    generation.current += 1;
    departurePending.current = false;
    return () => { generation.current += 1; };
  }, [location.key]);

  // Width belongs to the available workspace, including sidebar occupancy.
  // The rem probe also observes live root-text changes without a new viewport.
  useLayoutEffect(() => {
    const owner = workspace.current;
    const probe = remProbe.current;
    if (!owner || !probe) return;
    const measure = () => {
      const rem = probe.getBoundingClientRect().width || 16;
      setSplitPane(owner.getBoundingClientRect().width >= 52 * rem);
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(owner);
    observer.observe(probe);
    return () => observer.disconnect();
  }, []);

  const onTaskStateChange = useCallback((state: MessageThreadTaskState) => {
    taskState.current = state;
    setTaskPending(state.pending);
  }, []);

  const beforeLeave = useCallback(async () => {
    if (taskState.current.pending || departurePending.current) return false;
    if (!taskState.current.hasTransientDraft) return true;
    departurePending.current = true;
    const current = generation.current;
    try {
      const discard = await confirm({ title: "Leave this conversation?",
        description: "Your written draft is kept on this device. Attached images and the reply selection will be discarded.",
        cancelText: "Keep composing", confirmText: "Leave conversation", variant: "destructive" });
      return discard && current === generation.current && !taskState.current.pending;
    } finally { if (current === generation.current) departurePending.current = false; }
  }, [confirm]);

  // The coordinator owns overlay priority and pending departure. The explicit
  // callback below owns dirty confirmation once, for both Back and row picks.
  useAppBackGuard(taskPending, () => false);
  const changeConversation = useCallback(async (next: string | null) => {
    if (next === selectedConversationId) return;
    const current = generation.current;
    if (!await beforeLeave() || current !== generation.current) return;
    selectionIntent.current += 1;
    setEntryPending(false);
    lastConversation.current = next ?? selectedConversationId;
    setSelectedConversationId(next);
    setFocusRequest(next ? "thread" : "inbox");
  }, [beforeLeave, selectedConversationId]);

  // Existing location.state entry intents remain supported; resize never
  // recreates a conversation or replays a handled entry.
  useEffect(() => {
    if (!readerId || authLoading) return;
    const existingId = location.state?.conversationId;
    const entryReaderId = location.state?.startConversationWith;
    const intent = `${location.key}:${existingId ?? entryReaderId ?? ""}:${entryRetry}`;
    if (!existingId && !entryReaderId) return;
    let active = true;
    const selection = selectionIntent.current;
    if (existingId) {
      if (entryIntent.current === intent) return;
      entryIntent.current = intent;
      setSelectedConversationId(existingId);
      lastConversation.current = existingId;
      setFocusRequest("thread");
      return;
    }
    setEntryPending(true);
    setEntryError(false);
    // StrictMode may replay this effect; share the same dispatched request,
    // while each subscriber retains its own active lifecycle guard.
    if (entryRequest.current?.intent !== intent) {
      entryRequest.current = { intent, promise: getOrCreateConversation(entryReaderId) };
    }
    void entryRequest.current.promise.then(id => {
      if (!active || selection !== selectionIntent.current) return;
      if (id) {
        setSelectedConversationId(id);
        lastConversation.current = id;
        setFocusRequest("thread");
      } else setEntryError(true);
    }).finally(() => { if (active) setEntryPending(false); });
    return () => { active = false; };
  }, [location.key, location.state, readerId, authLoading, getOrCreateConversation, entryRetry]);

  useLayoutEffect(() => {
    if (focusRequest === "inbox" && !selectedConversationId) {
      const control = [...(inbox.current?.querySelectorAll<HTMLElement>("[data-conversation-id]") ?? [])]
        .find(element => element.dataset.conversationId === lastConversation.current);
      (control ?? inboxHeading.current)?.focus({ preventScroll: true });
      setFocusRequest(null);
    } else if (focusRequest === "thread" && selectedConversationId && (messagesLoaded || (!messagesLoading && messagesError))) {
      thread.current?.focus({ preventScroll: true });
      setFocusRequest(null);
    }
  }, [focusRequest, selectedConversationId, messagesLoaded, messagesLoading, messagesError]);
  useLayoutEffect(() => {
    if (!splitPane && selectedConversationId && inbox.current?.contains(document.activeElement)) {
      thread.current?.focus({ preventScroll: true });
    }
  }, [splitPane, selectedConversationId]);

  const selectedConversation = conversations.find(conversation => conversation.id === selectedConversationId);
  const selectedOtherUser = detail?.other_user || selectedConversation?.other_user;
  const selectedIsBlocked = Boolean(detail?.is_blocked || selectedConversation?.is_blocked);
  const selectedMessageEligibility = detail?.message_eligibility || selectedConversation?.message_eligibility || "restricted";
  const singleThread = Boolean(selectedConversationId && !splitPane);
  const title = singleThread ? selectedOtherUser?.display_name || "Conversation" : "Messages";
  const back = selectedConversationId ? { label: "Messages", ariaLabel: "Back to messages", onBack: () => changeConversation(null) } : undefined;

  return (
    <MobileLayout showBottomNav={!singleThread}>
      <div className="messages-page flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          {compactChrome ? <MobileHeader title={title} back={back} /> :
            <NativeHeader title={title} subtitle={singleThread ? undefined : "Private conversations with readers"} back={back} />}
        </div>
        <main ref={workspace} aria-label="Messages" data-messages-layout={splitPane ? "split" : "single"}
          className="relative grid min-h-0 min-w-0 flex-1 gap-3 p-2 sm:p-3"
          style={{ gridTemplateColumns: splitPane ? "minmax(16rem, 19rem) minmax(0, 1fr)" : "minmax(0, 1fr)" }}>
          <span ref={remProbe} aria-hidden="true" className="pointer-events-none absolute h-0 w-[1rem] overflow-hidden" />
          <section ref={inbox} aria-label="Inbox" hidden={singleThread}
            className="min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card"
            style={{ display: singleThread ? "none" : "flex" }}>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-messages-inbox-scroll>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 p-3">
              <div className="min-w-0">
                <h2 ref={inboxHeading} tabIndex={-1} className="font-display text-lg font-semibold">Inbox</h2>
                <p className="font-sans text-sm text-muted-foreground">Private conversations</p>
              </div>
              <Button variant="ghost" className="h-auto min-h-11 whitespace-normal" disabled={loading || entryPending}
                onClick={() => void refetchConversations()}>Refresh inbox</Button>
            </div>
            <div className="p-2">
              <PullToRefresh onRefresh={refetchConversations} disabled={taskPending || entryPending}>
                <LoadingRegion loading={loading && !hasLoaded} refreshing={loading && hasLoaded} label="Loading conversations" className="space-y-3">
                  {error && <LoadingError message={error} onRetry={refetchConversations} />}
                  {entryPending && <p role="status" className="p-3 text-sm text-muted-foreground">Opening conversation...</p>}
                  {entryError && <LoadingError message="Couldn't open this conversation. Your inbox is still available." onRetry={() => setEntryRetry(current => current + 1)} />}
                  {loading && !hasLoaded ? <ConversationsSkeleton /> : hasLoaded ? <ConversationsList
                    conversations={conversations} selectedConversationId={selectedConversationId}
                    onSelectConversation={id => { void changeConversation(id); }} currentUserId={user?.id}
                    onBeforeLeave={beforeLeave} /> : null}
                </LoadingRegion>
              </PullToRefresh>
            </div>
            </div>
          </section>
          <section ref={thread} aria-label="Conversation" tabIndex={-1} hidden={!splitPane && !selectedConversationId}
            className="min-h-0 min-w-0 overflow-hidden rounded-xl border border-border bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ display: !splitPane && !selectedConversationId ? "none" : "block" }}>
            {selectedConversationId ? <LoadingRegion loading={messagesLoading && !messagesLoaded} refreshing={messagesLoading && messagesLoaded}
              label="Loading messages" containerClassName="h-full" className="flex h-full min-h-0 flex-col">
              {messagesError && <LoadingError message={messagesError} onRetry={refetchMessages} />}
              <div className="min-h-0 flex-1">
                {messagesLoading && !messagesLoaded ? <MessageThreadSkeleton isMobile={!splitPane} /> : messagesLoaded ? <MessageThread
                  key={selectedConversationId} messages={messages} onSendMessage={sendMessage} onToggleReaction={toggleReaction}
                  onDeleteMessage={deleteMessage} currentUserId={user?.id} conversationId={selectedConversationId}
                  otherUser={selectedOtherUser} isBlocked={selectedIsBlocked} messageEligibility={selectedMessageEligibility}
                  onBack={() => { void changeConversation(null); }} showParticipantHeader={splitPane}
                  onTaskStateChange={onTaskStateChange} onBeforeLeave={beforeLeave} /> : null}
              </div>
            </LoadingRegion> : <div className="flex h-full items-center justify-center overflow-y-auto p-5">
              <PremiumEmptyState asset="chooseConversation" title="Choose a conversation"
                description="Pick a reader from the inbox to continue the thread." variant="plain" size="large" />
            </div>}
          </section>
        </main>
      </div>
    </MobileLayout>
  );
};

export default Messages;
