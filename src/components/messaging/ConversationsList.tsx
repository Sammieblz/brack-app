import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Conversation } from "@/hooks/useConversations";
import { MessageCircle } from "lucide-react";

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

  return (
    <div className="space-y-2">
      {conversations.map((conv) => (
        <Card
          key={conv.id}
          className={`p-4 cursor-pointer transition-all hover:shadow-md ${
            selectedConversationId === conv.id ? "bg-muted border-primary" : ""
          }`}
          onClick={() => onSelectConversation(conv.id)}
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
      ))}
    </div>
  );
};
