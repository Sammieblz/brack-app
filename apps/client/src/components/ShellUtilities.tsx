import { createContext, useContext, useLayoutEffect, useRef, useState, type PropsWithChildren } from "react";
import { createPortal } from "react-dom";
import { FloatingTimerWidget } from "@/components/FloatingTimerWidget";
import { ReadingSyncIndicator } from "@/components/ReadingSyncIndicator";

const ShellUtilitiesContext = createContext<HTMLDivElement | null>(null);

/** Keep session controls and sync subscriptions app-owned while their visual
 * host moves between route shells. Changing a portal target would remount them. */
export const ShellUtilitiesProvider = ({ children }: PropsWithChildren) => {
  const [host] = useState(() => {
    if (typeof document === "undefined") return null;
    const element = document.createElement("div");
    element.dataset.shellUtilities = "true";
    return element;
  });

  return <ShellUtilitiesContext.Provider value={host}>
    {children}
    {host && createPortal(<><FloatingTimerWidget /><ReadingSyncIndicator /></>, host)}
  </ShellUtilitiesContext.Provider>;
};

/** The current route supplies geometry, never a new timer/sync lifecycle. */
export const ShellUtilitiesSlot = () => {
  const host = useContext(ShellUtilitiesContext);
  const slotRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!host || !slot) return;
    slot.appendChild(host);
    return () => {
      // A replacement route may already have claimed the host in this commit.
      if (host.parentNode === slot) slot.removeChild(host);
    };
  }, [host]);
  if (!host) return null;
  return <div ref={slotRef} data-shell-utilities-slot />;
};
