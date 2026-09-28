import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { IonModal } from '@ionic/react';
import { useUIEnvironment } from '@/hooks/useUIEnvironment';
import type { SurfaceHandle, SurfaceProps } from './surface';

export const IonicSurface = forwardRef<SurfaceHandle, SurfaceProps>(function IonicSurface(props, ref) {
  const modal = useRef<HTMLIonModalElement>(null);
  const presentationRevision = useRef(0);
  const environment = useUIEnvironment();
  const mode = environment.runtime === 'ios' ? 'ios' : 'md';
  useEffect(() => () => { presentationRevision.current++; }, []);
  const notifyPresented = () => {
    const element = modal.current;
    const revision = ++presentationRevision.current;
    // Ionic 9 dispatches didPresent before its own fallback focus and final
    // accessibility cleanup. Run the shared initial-focus policy after that
    // synchronous transaction, rather than competing with it inside dispatch.
    queueMicrotask(() => {
      if (revision === presentationRevision.current && element === modal.current && element?.isConnected && element.isOpen) {
        props.onPresented();
      }
    });
  };
  useImperativeHandle(ref, () => ({ dismiss: (role) => modal.current?.dismiss(undefined, role) ?? Promise.resolve(false) }));
  return <IonModal ref={modal} isOpen={props.open} mode={mode} className="fit-modal"
    aria-label="Reading note" animated={!environment.reducedMotion}
    breakpoints={[0, 1]} initialBreakpoint={1} expandToScroll={false}
    canDismiss={async (_data, role) => props.canDismiss(role ?? 'dismiss')}
    onDidPresent={notifyPresented}
    onWillDismiss={() => { presentationRevision.current++; }}
    onDidDismiss={(event) => props.onDismissed(event.detail.role ?? 'dismiss')}>
    {props.children}
  </IonModal>;
});
