import type { ReactNode } from 'react';
export interface SurfaceHandle { dismiss: (role: string) => Promise<boolean>; }
export interface SurfaceProps {
  open: boolean;
  children: ReactNode;
  canDismiss: (role: string) => boolean;
  onDismissed: (role: string) => void;
  onPresented: () => void;
}
