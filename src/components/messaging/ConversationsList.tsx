import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Conversation } from "@/hooks/useConversations";
import { MessageCircle, Trash2, Eye, EyeOff } from "lucide-react";
import { useSwipeable } from "react-swipeable";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hapticToast } from "@/utils/hapticToast";

interface ConversationsListProps {
  conversations: Conversation[];
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  currentUserId?: string;
}

export const ConversationsList = ({
  conversations,
  selectedConversationId,
  onSelectConversation,
  currentUserId,
}: ConversationsListProps) => {
  const { triggerHaptic } = useHapticFeedback();
  const [swipedId, setSwipedId] = useState<string | null>(null);

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 24) {
      if (diffInHours < 1) return "Just now";
      return `${diffInHours}h ago`;
    }
    return date.toLocaleDateString();
  };

  if (conversations.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No conversations yet</p>
        <p className="text-sm text-muted-foreground mt-2">
          Start a conversation from a user's profile
        </p>
      </div>
    );
  }

  const handleDelete = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('medium');
    
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);
      
      if (error) throw error;
      
      hapticToast.success('Conversation deleted');
      setSwipedId(null);
    } catch (error) {
      hapticToast.error('Failed to delete conversation');
    }
  };

  const handleMarkRead = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    
    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', currentUserId);
      
      hapticToast.success('Marked as read');
      setSwipedId(null);
    } catch (error) {
      hapticToast.error('Failed to update');
    }
  };

  return (
    <div className="space-y-2">
      {conversations.map((conv) => {
        const swipeHandlers = useSwipeable({
          onSwipedLeft: () => {
            triggerHaptic('light');
            setSwipedId(conv.id);
          },
          onSwipedRight: () => {
            triggerHaptic('light');
            setSwipedId(null);
          },
          trackMouse: false,
        });

        const isSwiped = swipedId === conv.id;

        return (
          <div key={conv.id} {...swipeHandlers} className="relative">
            <Card
              className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                selectedConversationId === conv.id ? "bg-muted border-primary" : ""
              } ${isSwiped ? 'translate-x-[-120px]' : ''} transition-transform duration-300`}
              onClick={() => {
                triggerHaptic('selection');
                onSelectConversation(conv.id);
              }}
            >
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={conv.other_user?.avatar_url} />
                  <AvatarFallback>{getInitials(conv.other_user?.display_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold truncate">
                      {conv.other_user?.display_name || "Unknown User"}
                    </p>
                    {conv.last_message && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {formatDate(conv.last_message.created_at)}
                      </span>
                    )}
                  </div>
                  {conv.last_message && (
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.last_message.sender_id === currentUserId && "You: "}
                      {conv.last_message.content}
                    </p>
                  )}
                </div>
                {conv.unread_count && conv.unread_count > 0 && (
                  <Badge variant="default" className="ml-2">
                    {conv.unread_count}
                  </Badge>
                )}
              </div>
            </Card>
            
            {/* Swipe Actions */}
            {isSwiped && (
              <div className="absolute right-0 top-0 h-full flex items-center gap-2 pr-2">
                <button
                  onClick={(e) => handleMarkRead(conv.id, e)}
                  className="bg-blue-500 text-white p-3 rounded-lg"
                >
                  {conv.unread_count ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                </button>
                <button
                  onClick={(e) => handleDelete(conv.id, e)}
                  className="bg-destructive text-destructive-foreground p-3 rounded-lg"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
