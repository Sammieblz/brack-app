import PullToRefreshLib from 'react-simple-pull-to-refresh';
import { Refresh } from 'iconoir-react';
import { ReactNode } from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  disabled?: boolean;
}

export const PullToRefresh = ({ onRefresh, children, disabled = false }: PullToRefreshProps) => {
  const { triggerHaptic } = useHapticFeedback();

  const handleRefresh = async () => {
    triggerHaptic('medium');
    await onRefresh();
    triggerHaptic('success');
  };

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <PullToRefreshLib
      onRefresh={handleRefresh}
      pullingContent={
        <div className="flex justify-center py-4">
          <div className="font-sans text-muted-foreground text-sm">Pull to refresh</div>
        </div>
      }
      refreshingContent={
        <div className="flex justify-center py-4">
          <Refresh className="h-5 w-5 animate-spin text-primary" />
        </div>
      }
      pullDownThreshold={80}
      maxPullDownDistance={100}
      resistance={2}
    >
      <div>{children}</div>
    </PullToRefreshLib>
  );
};
