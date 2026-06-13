import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";

export const EmptyMessages = () => {
  return (
    <PremiumEmptyState
      asset="emptyMessages"
      title="No messages"
      description="Start a conversation with other readers to discuss books and share recommendations."
      size="compact"
    />
  );
};
