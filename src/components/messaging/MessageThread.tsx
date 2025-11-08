import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Message } from "@/hooks/useMessages";
import { Send } from "lucide-react";

interface MessageThreadProps {
  messages: Message[];
  onSendMessage: (content: string) => Promise<boolean>;
  currentUserId?: string;
  otherUser?: {
    id: string;
    display_name: string;
    avatar_url?: string;
  };
}

export const MessageThread = ({
  messages,
  onSendMessage,
  currentUserId,
  otherUser,
}: MessageThreadProps) => {
  const [messageContent, setMessageContent] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!messageContent.trim() || sending) return;

    setSending(true);
    const success = await onSendMessage(messageContent);
    if (success) {
      setMessageContent("");
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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                    <p className={`text-xs text-muted-foreground mt-1 ${isOwnMessage ? "text-right" : ""}`}>
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-card">
        <div className="flex gap-2">
          <Textarea
            placeholder="Type a message..."
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            onKeyPress={handleKeyPress}
            rows={2}
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
