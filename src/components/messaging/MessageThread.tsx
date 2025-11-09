import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Message } from "@/hooks/useMessages";
import { Send } from "lucide-react";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useIsMobile } from "@/hooks/use-mobile";

interface MessageThreadProps {
  messages: Message[];
  onSendMessage: (content: string) => Promise<boolean>;
  currentUserId?: string;
  conversationId: string | null;
  otherUser?: {
    id: string;
    display_name: string;
    avatar_url?: string;
  };
  onBack?: () => void;
}

export const MessageThread = ({
  messages,
  onSendMessage,
  currentUserId,
  conversationId,
  otherUser,
  onBack,
}: MessageThreadProps) => {
  const [messageContent, setMessageContent] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { otherUserTyping, setTyping } = useTypingIndicator(conversationId, currentUserId);
  const { triggerHaptic } = useHapticFeedback();
  const isMobile = useIsMobile();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageContent(e.target.value);
    
    // Notify that user is typing
    setTyping(true);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set typing to false after 2 seconds of no typing
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false);
    }, 2000);
  };

  const handleSend = async () => {
    if (!messageContent.trim() || sending) return;

    triggerHaptic('light');
    setSending(true);
    setTyping(false); // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    const success = await onSendMessage(messageContent);
    if (success) {
      setMessageContent("");
      triggerHaptic('success');
    }
    setSending(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    
    // If today, show just the time
    if (diffInHours < 24 && date.getDate() === now.getDate()) {
      return timeStr;
    }
    
    // If yesterday
    if (diffInHours < 48 && date.getDate() === now.getDate() - 1) {
      return `Yesterday ${timeStr}`;
    }
    
    // If within the last week, show day name
    if (diffInHours < 168) {
      const dayName = date.toLocaleDateString([], { weekday: "short" });
      return `${dayName} ${timeStr}`;
    }
    
    // Otherwise show full date
    return date.toLocaleDateString([], { 
      month: "short", 
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined 
    }) + " " + timeStr;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header - Only show on desktop as mobile has MobileHeader */}
      {!isMobile && (
        <div className="p-4 border-b bg-card">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={otherUser?.avatar_url} />
              <AvatarFallback>{getInitials(otherUser?.display_name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{otherUser?.display_name || "Unknown User"}</p>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto space-y-4 ${isMobile ? 'p-3' : 'p-4'}`}>
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.sender_id === currentUserId;
            return (
              <div
                key={message.id}
                className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
              >
                <div className={`flex gap-2 max-w-[70%] ${isOwnMessage ? "flex-row-reverse" : ""}`}>
                  <Avatar className="h-8 w-8 mt-1">
                    <AvatarImage src={isOwnMessage ? undefined : otherUser?.avatar_url} />
                    <AvatarFallback className="text-xs">
                      {isOwnMessage ? "You" : getInitials(otherUser?.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Card
                      className={`p-3 ${
                        isOwnMessage
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                    </Card>
                    <p className={`text-xs text-muted-foreground/80 mt-1.5 font-medium ${isOwnMessage ? "text-right" : ""}`}>
                      {formatTimestamp(message.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        
        {/* Typing Indicator */}
        {otherUserTyping && (
          <div className="flex gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={otherUser?.avatar_url} />
              <AvatarFallback className="text-xs">
                {getInitials(otherUser?.display_name)}
              </AvatarFallback>
            </Avatar>
            <Card className="bg-muted p-3 flex items-center gap-1">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </Card>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`border-t bg-card ${isMobile ? 'p-3 pb-safe' : 'p-4'}`}>
        <div className="flex gap-2">
          <Textarea
            placeholder="Type a message..."
            value={messageContent}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            rows={isMobile ? 1 : 2}
            className="resize-none"
          />
          <Button
            onClick={handleSend}
            disabled={!messageContent.trim() || sending}
            size="icon"
            className="h-auto"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
