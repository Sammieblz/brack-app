import { useState, useEffect } from "react";
import { ConversationsList } from "@/components/messaging/ConversationsList";
import { MessageThread } from "@/components/messaging/MessageThread";
import { useConversations } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { useAuth } from "@/hooks/useAuth";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useLocation } from "react-router-dom";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { NativeHeader } from "@/components/NativeHeader";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeable } from "react-swipeable";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { APP_ICONS } from "@/config/iconography";
import { Card, CardContent } from "@/components/ui/card";

const Messages = () => {
  const location = useLocation();
  const { conversations, loading, getOrCreateConversation, refetchConversations } = useConversations();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const { messages, loading: messagesLoading, sendMessage } = useMessages(selectedConversationId);
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
    const startConversationWith = async () => {
      // Handle deep link conversation ID
      if (location.state?.conversationId) {
        setSelectedConversationId(location.state.conversationId);
        return;
      }
      
      // Handle starting conversation with a user ID
      if (location.state?.startConversationWith) {
        const conversationId = await getOrCreateConversation(location.state.startConversationWith);
        if (conversationId) {
          setSelectedConversationId(conversationId);
        }
      }
    };
    startConversationWith();
  }, [location.state, getOrCreateConversation]);

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  if (loading) {
    return (
      <MobileLayout showBottomNav={!isMobile || !selectedConversationId}>
        <LoadingSpinner />
      </MobileLayout>
    );
  }

  // Mobile: Show message thread in full screen when selected
  if (isMobile && selectedConversationId) {
    return (
      <MobileLayout showBottomNav={false}>
        <MobileHeader 
          title={selectedConversation?.other_user?.display_name || "Message"}
          back={{
            label: "Messages",
            ariaLabel: "Back to messages",
            onBack: () => setSelectedConversationId(null),
          }}
        />
        <div className="h-[calc(var(--app-viewport-height,100dvh)-3.5rem)] native-scroll" {...swipeHandlers}>
          {messagesLoading ? (
            <LoadingSpinner />
          ) : (
            <MessageThread
              messages={messages}
              onSendMessage={sendMessage}
              currentUserId={user?.id}
              conversationId={selectedConversationId}
              otherUser={selectedConversation?.other_user}
              onBack={() => setSelectedConversationId(null)}
            />
          )}
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
              <ConversationsList
                conversations={conversations}
                selectedConversationId={selectedConversationId}
                onSelectConversation={setSelectedConversationId}
                currentUserId={user?.id}
              />
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
                        {conversations.length} conversation{conversations.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <APP_ICONS.nav.messages className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  <ConversationsList
                    conversations={conversations}
                    selectedConversationId={selectedConversationId}
                    onSelectConversation={setSelectedConversationId}
                    currentUserId={user?.id}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="min-h-0 overflow-hidden rounded-lg border border-border bg-card">
              {selectedConversationId ? (
                messagesLoading ? (
                  <LoadingSpinner />
                ) : (
                  <MessageThread
                    messages={messages}
                    onSendMessage={sendMessage}
                    currentUserId={user?.id}
                    conversationId={selectedConversationId}
                    otherUser={selectedConversation?.other_user}
                  />
                )
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="max-w-sm text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <APP_ICONS.nav.messages className="h-7 w-7" />
                    </div>
                    <h2 className="font-display text-xl font-semibold text-foreground">
                      Choose a conversation
                    </h2>
                    <p className="mt-2 font-sans text-sm">
                      Pick a reader from the inbox to continue the thread.
                    </p>
                  </div>
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
