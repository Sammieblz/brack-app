import type { ClubChatReactionType } from "@/services/api/clubs";
import type { MessageReactionType } from "@/services/api/messaging";

export type AppReactionType = MessageReactionType | ClubChatReactionType;

export const APP_REACTIONS: Array<{
  type: AppReactionType;
  icon: string;
  title: string;
}> = [
  { type: "like", icon: "\u{1F44D}", title: "Like" },
  { type: "dislike", icon: "\u{1F44E}", title: "Dislike" },
  { type: "heart", icon: "\u{2764}\u{FE0F}", title: "Heart" },
  { type: "laugh", icon: "\u{1F602}", title: "Laugh" },
  { type: "wow", icon: "\u{1F62E}", title: "Wow" },
  { type: "thanks", icon: "\u{1F64F}", title: "Thanks" },
];

export const getReactionMeta = (type: AppReactionType) =>
  APP_REACTIONS.find((reaction) => reaction.type === type) || APP_REACTIONS[0];
