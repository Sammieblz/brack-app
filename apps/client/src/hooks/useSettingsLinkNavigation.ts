import { useCallback, useContext, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { SettingsTaskContext } from "@/contexts/SettingsTaskContext";

/** Protect shell links only while they are inside the current Settings task. */
export function useSettingsLinkNavigation() {
  const context = useContext(SettingsTaskContext);
  const leave = context?.leave;
  const navigate = useNavigate();
  return useCallback((event: MouseEvent<HTMLAnchorElement>, onAccepted?: () => void): boolean => {
    const anchor = event.currentTarget;
    if (!leave || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
      event.shiftKey || event.altKey || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return false;
    // React clears currentTarget after this event; snapshot the full destination.
    const destination = `${anchor.pathname}${anchor.search}${anchor.hash}`;
    event.preventDefault();
    void leave(() => { onAccepted?.(); navigate(destination); });
    return true;
  }, [leave, navigate]);
}
