import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { ConversationsList } from "@/components/messaging/ConversationsList";
import { MessageThread } from "@/components/messaging/MessageThread";
import { useConversations } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { useAuth } from "@/hooks/useAuth";
import { MessageCircle } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useLocation } from "react-router-dom";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeable } from "react-swipeable";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

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
        {!isMobile && <Navbar />}
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
          showBack={true}
        />
        <div className="h-[calc(100vh-3.5rem)] native-scroll" {...swipeHandlers}>
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
      {!isMobile && <Navbar />}
      
      {isMobile && (
        <MobileHeader title="Messages" />
      )}
      
      <main className={`${isMobile ? '' : 'container max-w-7xl mx-auto px-4 py-8'}`}>
        {!isMobile && (
          <div className="mb-8 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                <MessageCircle className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  Messages
                </h1>
                <p className="text-muted-foreground mt-1">
                  Connect with other readers
                </p>
              </div>
            </div>
          </div>
        )}

        {isMobile ? (
          <PullToRefresh onRefresh={refetchConversations}>
            <div className="min-h-screen bg-background pb-4">
              <ConversationsList
                conversations={conversations}
                selectedConversationId={selectedConversationId}
                onSelectConversation={setSelectedConversationId}
                currentUserId={user?.id}
              />
            </div>
          </PullToRefresh>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-16rem)]">
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
                    <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>Select a conversation to start messaging</p>
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
