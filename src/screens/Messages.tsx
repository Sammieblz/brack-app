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

const Messages = () => {
  const location = useLocation();
  const { conversations, loading, getOrCreateConversation } = useConversations();
  const { user } = useAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const { messages, loading: messagesLoading, sendMessage } = useMessages(selectedConversationId);

  // Handle starting a conversation from another page
  useEffect(() => {
    const startConversationWith = async () => {
      if (location.state?.startConversationWith) {
        const conversationId = await getOrCreateConversation(location.state.startConversationWith);
        if (conversationId) {
          setSelectedConversationId(conversationId);
        }
      }
    };
    startConversationWith();
  }, [location.state]);

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-7xl mx-auto px-4 py-8">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-16rem)]">
          {/* Conversations List */}
          <div className="md:col-span-1 overflow-y-auto">
            <ConversationsList
              conversations={conversations}
              selectedConversationId={selectedConversationId}
              onSelectConversation={setSelectedConversationId}
              currentUserId={user?.id}
            />
          </div>

          {/* Message Thread */}
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
      </main>
    </div>
  );
};

export default Messages;
