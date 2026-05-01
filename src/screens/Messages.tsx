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
import { PullToRefresh } from "@/components/PullToRefresh";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeable } from "react-swipeable";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { APP_ICONS } from "@/config/iconography";

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
      
      <main className={isMobile ? "" : "app-page"}>
        {!isMobile && (
          <div className="mb-8 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                <APP_ICONS.nav.messages className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-3xl font-bold text-foreground bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  Messages
                </h1>
                <p className="font-sans text-muted-foreground mt-1">
                  Connect with other readers
                </p>
              </div>
            </div>
          </div>
        )}

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
          <div className="grid h-[calc(var(--app-viewport-height,100dvh)-16rem)] min-h-[24rem] grid-cols-1 gap-6 md:grid-cols-3">
            <div className="md:col-span-1 overflow-y-auto">
              <ConversationsList
                conversations={conversations}
                selectedConversationId={selectedConversationId}
                onSelectConversation={setSelectedConversationId}
                currentUserId={user?.id}
              />
            </div>

            <div className="md:col-span-2 border rounded-lg bg-card">
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
                  <div className="text-center">
                    <APP_ICONS.nav.messages className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="font-sans">Select a conversation to start messaging</p>
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
