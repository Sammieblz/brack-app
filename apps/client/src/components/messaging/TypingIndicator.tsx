import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface TypingUser {
  id?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
}

interface TypingIndicatorProps {
  users: TypingUser[];
  align?: "left" | "right";
  className?: string;
}

const initials = (name?: string | null) =>
  (name || "R")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const labelForUsers = (users: TypingUser[]) => {
  if (users.length === 0) return "";
  if (users.length === 1) return `${users[0].name || "Someone"} is typing`;
  if (users.length === 2) {
    return `${users[0].name || "Someone"} and ${users[1].name || "someone"} are typing`;
  }
  return `${users[0].name || "Someone"} and ${users.length - 1} others are typing`;
};

export const TypingIndicator = ({ users, align = "left", className }: TypingIndicatorProps) => {
  if (users.length === 0) return null;
  const firstUser = users[0];

  return (
    <div
      className={cn(
        "flex items-end gap-2 py-1",
        align === "right" && "justify-end",
        className
      )}
      aria-live="polite"
      aria-label={labelForUsers(users)}
    >
      {align === "left" && (
        <Avatar className="h-8 w-8 border border-border/70">
          <AvatarImage src={firstUser.avatarUrl || undefined} />
          <AvatarFallback className="text-xs">{initials(firstUser.name)}</AvatarFallback>
        </Avatar>
      )}
      <div className="max-w-[78%] space-y-1">
        <p className="font-sans text-xs text-muted-foreground">{labelForUsers(users)}</p>
        <div className="flex w-fit items-center gap-1 rounded-2xl border border-border bg-muted/70 px-3 py-2 shadow-sm">
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary/70" />
          <span
            className="h-2 w-2 animate-bounce rounded-full bg-primary/70"
            style={{ animationDelay: "140ms" }}
          />
          <span
            className="h-2 w-2 animate-bounce rounded-full bg-primary/70"
            style={{ animationDelay: "280ms" }}
          />
        </div>
      </div>
    </div>
  );
};
