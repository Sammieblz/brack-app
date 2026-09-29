import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { MobileBottomNav } from "./MobileBottomNav";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "./ui/sidebar";
import { ScrollToTop } from "./ScrollToTop";
import { ShellUtilitiesSlot } from "./ShellUtilities";
import { ShellNavigationProvider } from "./ShellNavigation";
import { usePersistentScrollPosition } from "@/hooks/useScrollPosition";
import { useUIEnvironment } from "@/hooks/useUIEnvironment";
import { useOverlayViewport } from "@/hooks/useOverlayViewport";
import { getShellNavigation, isShellEditingTarget } from "@/lib/shellPresentation";

interface MobileLayoutProps {
  children: ReactNode;
  showBottomNav?: boolean;
  showTopNav?: boolean;
}

export const MobileLayout = ({ children, showBottomNav = true, showTopNav = true }: MobileLayoutProps) => {
  const environment = useUIEnvironment();
  const viewport = useOverlayViewport();
  const navigation = showTopNav ? getShellNavigation(environment) : "none";
  const location = useLocation();
  const scrollRef = usePersistentScrollPosition(location.pathname);
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(0);
  const [editing, setEditing] = useState(false);
  const showTabs = navigation === "tabs" && showBottomNav;

  useEffect(() => {
    let frame = 0;
    const update = () => setEditing(Boolean(scrollRef.current?.contains(document.activeElement)) &&
      isShellEditingTarget(document.activeElement));
    const afterFocus = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", afterFocus);
    update();
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", afterFocus);
    };
  }, [scrollRef]);

  useLayoutEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;
    const measure = () => setFooterHeight(footer.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const owner = scrollRef.current;
    if (environment.visualScale !== 1 || !owner) return;
    const header = owner.querySelector("header");
    const reveal = () => {
      const focused = document.activeElement;
      if (!(focused instanceof HTMLElement) || !owner.contains(focused) || header?.contains(focused)) return;
      const bounds = owner.getBoundingClientRect();
      const field = focused.getBoundingClientRect();
      const styles = getComputedStyle(owner);
      const topClearance = parseFloat(styles.scrollPaddingTop) || 0;
      const bottomClearance = parseFloat(styles.scrollPaddingBottom) || 0;
      if (field.bottom > bounds.bottom - bottomClearance || field.top < bounds.top + topClearance) {
        focused.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
      }
    };
    reveal();
    // Keyboard/programmatic return needs the same clearance as resizing.
    // A pointer contact must keep its target still through activation; it also
    // lets readers intentionally scroll a focused field without snapping back.
    const pointers = new Set<number>();
    const pointerDown = (event: PointerEvent) => { pointers.add(event.pointerId); };
    const pointerEnd = (event: PointerEvent) => { pointers.delete(event.pointerId); };
    const resetPointers = () => pointers.clear();
    const focusIn = () => { if (pointers.size === 0) reveal(); };
    owner.addEventListener("pointerdown", pointerDown, true);
    window.addEventListener("pointerup", pointerEnd, true);
    window.addEventListener("pointercancel", pointerEnd, true);
    window.addEventListener("blur", resetPointers);
    owner.addEventListener("focusin", focusIn);
    const observer = header && typeof ResizeObserver !== "undefined" ? new ResizeObserver(reveal) : null;
    if (header && observer) observer.observe(header);
    return () => {
      owner.removeEventListener("pointerdown", pointerDown, true);
      window.removeEventListener("pointerup", pointerEnd, true);
      window.removeEventListener("pointercancel", pointerEnd, true);
      window.removeEventListener("blur", resetPointers);
      owner.removeEventListener("focusin", focusIn);
      observer?.disconnect();
    };
  }, [environment.layoutWidth, viewport.height, viewport.top, footerHeight, environment.visualScale, scrollRef]);

  // Preserve the complete ancestor chain and main node while changing chrome.
  // Safe bottom belongs to this footer once; main needs no guessed tab padding.
  return (
    <ShellNavigationProvider>
      <SidebarProvider defaultOpen keyboardShortcutEnabled={navigation === "sidebar"} className="app-shell min-h-0 overflow-hidden"
        data-shell-navigation={navigation} data-shell-editing={editing}
        style={{ height: viewport.height || "100dvh", marginTop: viewport.top,
          "--app-shell-bottom-height": `${footerHeight}px`,
          "--app-shell-viewport-bottom": `${Math.max(0, environment.layoutHeight - viewport.height - viewport.top)}px`,
        } as CSSProperties}>
        {navigation === "sidebar" && <AppSidebar />}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          <main ref={scrollRef} data-app-scroll-container="true" className="app-scroll-container min-w-0 flex-1">
            {children}
          </main>
          <ScrollToTop containerRef={scrollRef} resetKey={location.pathname} />
          <div ref={footerRef} data-shell-footer className="app-shell-footer" hidden={editing}>
            <ShellUtilitiesSlot />
            {showTabs && <MobileBottomNav />}
          </div>
        </div>
      </SidebarProvider>
    </ShellNavigationProvider>
  );
};
