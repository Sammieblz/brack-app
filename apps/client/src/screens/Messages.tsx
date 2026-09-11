import { useState, useEffect } from "react";
import { ConversationsList } from "@/components/messaging/ConversationsList";
import { MessageThread } from "@/components/messaging/MessageThread";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeable } from "react-swipeable";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { Card, CardContent } from "@/components/ui/card";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";

const Messages = () => {
  const { user } = useAuth();
  return <MessagesContent key={user?.id ?? "anonymous"} />;
};

const MessagesContent = () => {
  const location = useLocation();
  const { conversations, loading, hasLoaded, error, getOrCreateConversation, refetchConversations } = useConversations();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const {
    messages,
    detail,
    loading: messagesLoading,
    hasLoaded: messagesLoaded,
    error: messagesError,
    refetchMessages,
    sendMessage,
    toggleReaction,
    deleteMessage,
  } = useMessages(selectedConversationId);
  const { triggerHaptic } = useHapticFeedback();

  const swipeHandlers = useSwipeable({
    onSwipedRight: () => {
      if (selectedConversationId && isMobile) {
        triggerHaptic("selection");
        setSelectedConversationId(null);
      }
    },
    trackMouse: false,
    preventScrollOnSwipe: false,
  });

  // Handle starting a conversation from another page or deep link
  useEffect(() => {
    let active = true;
    const startConversationWith = async () => {
      // Handle deep link conversation ID
      if (location.state?.conversationId) {
        setSelectedConversationId(location.state.conversationId);
        return;
      }
      
      // Handle starting conversation with a user ID
      if (location.state?.startConversationWith) {
        const conversationId = await getOrCreateConversation(location.state.startConversationWith);
        if (active && conversationId) {
          setSelectedConversationId(conversationId);
        }
      }
    };
    startConversationWith();
    return () => { active = false; };
  }, [location.state, getOrCreateConversation]);

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId);
  const selectedOtherUser = detail?.other_user || selectedConversation?.other_user;
  const selectedIsBlocked = Boolean(detail?.is_blocked || selectedConversation?.is_blocked);

  const inbox = (
    <LoadingRegion loading={loading && !hasLoaded} refreshing={loading && hasLoaded} label="Loading conversations" className="space-y-3">
      {error && <LoadingError message={error} onRetry={refetchConversations} />}
      {loading && !hasLoaded ? <ConversationsSkeleton /> : hasLoaded ? (
        <ConversationsList conversations={conversations} selectedConversationId={selectedConversationId} onSelectConversation={setSelectedConversationId} currentUserId={user?.id} />
      ) : null}
    </LoadingRegion>
  );
  const thread = (
    <LoadingRegion loading={messagesLoading && !messagesLoaded} refreshing={messagesLoading && messagesLoaded} label="Loading messages" containerClassName="h-full" className="flex h-full min-h-0 flex-col">
      {messagesError && <LoadingError message={messagesError} onRetry={refetchMessages} />}
      <div className="min-h-0 flex-1">
        {messagesLoading && !messagesLoaded ? <MessageThreadSkeleton isMobile={isMobile} /> : messagesLoaded && selectedConversationId ? (
          <MessageThread key={selectedConversationId} messages={messages} onSendMessage={sendMessage} onToggleReaction={toggleReaction} onDeleteMessage={deleteMessage} currentUserId={user?.id} conversationId={selectedConversationId} otherUser={selectedOtherUser} isBlocked={selectedIsBlocked} onBack={() => setSelectedConversationId(null)} />
        ) : null}
      </div>
    </LoadingRegion>
  );

  // Mobile: Show message thread in full screen when selected
  if (isMobile && selectedConversationId) {
    return (
      <MobileLayout showBottomNav={false}>
        <MobileHeader 
          title={selectedOtherUser?.display_name || "Message"}
          back={{
            label: "Messages",
            ariaLabel: "Back to messages",
            onBack: () => setSelectedConversationId(null),
          }}
        />
        <div className="h-[calc(var(--app-viewport-height,100dvh)-3.5rem)] native-scroll" {...swipeHandlers}>
          {thread}
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout showBottomNav={!isMobile || !selectedConversationId}>
      {isMobile && (
        <MobileHeader title="Messages" />
      )}
      {!isMobile && (
        <NativeHeader
          title="Messages"
          subtitle="Private conversations with readers"
          showUtilityActions
        />
      )}
      
      <main className={isMobile ? "" : "app-page"}>
        {isMobile ? (
          <PullToRefresh onRefresh={refetchConversations}>
            <div className="min-h-full bg-background pb-4">
              {inbox}
            </div>
          </PullToRefresh>
        ) : (
          <div className="grid h-[calc(var(--app-viewport-height,100dvh)-11rem)] min-h-[28rem] grid-cols-[22rem_minmax(0,1fr)] gap-5 xl:grid-cols-[25rem_minmax(0,1fr)]">
            <Card className="min-h-0 overflow-hidden">
              <CardContent className="flex h-full flex-col p-0">
                <div className="border-b border-border/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-lg font-semibold">Inbox</h2>
                      <p className="font-sans text-sm text-muted-foreground">
                        {hasLoaded ? `${conversations.length} conversation${conversations.length === 1 ? "" : "s"}` : "Your private conversations"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  {inbox}
                </div>
              </CardContent>
            </Card>

            <div className="min-h-0 overflow-hidden rounded-lg border border-border bg-card">
              {selectedConversationId ? (
                thread
              ) : (
                <div className="flex h-full items-center justify-center p-6">
                  <PremiumEmptyState
                    asset="chooseConversation"
                    title="Choose a conversation"
                    description="Pick a reader from the inbox to continue the thread."
                    variant="plain"
                    size="large"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </MobileLayout>
  );
};

export default Messages;
