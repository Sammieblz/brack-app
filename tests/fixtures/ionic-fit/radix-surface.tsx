import { forwardRef, useImperativeHandle } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { SurfaceHandle, SurfaceProps } from './surface';

export const RadixSurface = forwardRef<SurfaceHandle, SurfaceProps>(function RadixSurface(props, ref) {
  const dismiss = async (role: string) => {
    if (!props.canDismiss(role)) return false;
    props.onDismissed(role);
    return true;
  };
  useImperativeHandle(ref, () => ({ dismiss }));
  return <Dialog open={props.open} onOpenChange={(open) => { if (!open) void dismiss('dismiss'); }}>
    <DialogContent disableHaptic className="fit-radix" aria-labelledby="reading-title" aria-describedby={undefined}
      onOpenAutoFocus={(event) => { event.preventDefault(); props.onPresented(); }}
      onCloseAutoFocus={(event) => event.preventDefault()}>
      <DialogTitle className="sr-only">Reading note</DialogTitle>
      {props.children}
    </DialogContent>
  </Dialog>;
});
