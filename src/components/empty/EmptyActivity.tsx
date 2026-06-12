import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";

export const EmptyActivity = () => {
  return (
    <PremiumEmptyState
      asset="emptyFeed"
      title="No activity yet"
      description="Start reading and sharing to see activity from you and your friends."
      size="compact"
    />
  );
};
