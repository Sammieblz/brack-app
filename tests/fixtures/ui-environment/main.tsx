import { useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link } from "react-router-dom";
import { useUIEnvironment } from "@/hooks/useUIEnvironment";
import { usePlatform } from "@/hooks/usePlatform";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useAppViewportHeight } from "@/hooks/useAppViewportHeight";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { useSwipeToOpenDrawer } from "@/hooks/useSwipeToOpenDrawer";
import { MobileBackButton } from "@/components/mobile/MobileBackButton";
import { NativeScrollView } from "@/components/NativeScrollView";
import { getAuthFlowSurface, getAuthRedirectUrl } from "@/services/platform";
import "@/index.css";

let mounts = 0;
export function EnvironmentFixture() {
  const environment = useUIEnvironment();
  const legacy = usePlatform();
  const breakpoint = useBreakpoint();
  const [draft, setDraft] = useState("");
  const [pages, setPages] = useState(0);
  const [instance] = useState(() => ++mounts);
  const [drawers, setDrawers] = useState(0);
  useAppViewportHeight();
  useSwipeBack();
  useSwipeToOpenDrawer({ onSwipeOpen: () => setDrawers((value) => value + 1) });
  return <NativeScrollView className="mx-auto max-w-3xl space-y-4 p-6">
    <h1 className="text-2xl font-semibold">UI environment fixture</h1>
    <MobileBackButton to="/library" />
    <Link to="/detail" className="block underline">Fixture detail</Link>
    <dl>{Object.entries(environment).map(([key, value]) => <div key={key} className="flex gap-3"><dt>{key}</dt><dd data-testid={key}>{String(value)}</dd></div>)}</dl>
    <p>Legacy platform: <span data-testid="legacy-platform">{legacy.platform}</span></p>
    <p>Legacy phone: <span data-testid="legacy-phone">{String(breakpoint.isPhone)}</span></p>
    <p>Auth surface: <span data-testid="auth-surface">{getAuthFlowSurface()}</span></p>
    <p>Auth redirect: <span data-testid="auth-redirect">{getAuthRedirectUrl()}</span></p>
    <p>Instance: <span data-testid="instance">{instance}</span></p>
    <p>Gesture drawer opens: <span data-testid="drawers">{drawers}</span></p>
    <label htmlFor="draft" className="block">Reading note</label>
    <textarea id="draft" className="w-full border p-3" value={draft} onChange={(event) => setDraft(event.target.value)} />
    <button type="button" className="border p-3" onClick={() => setPages((value) => value + 1)}>Read one page</button>
    <output aria-label="Session pages">{pages}</output>
  </NativeScrollView>;
}
createRoot(document.getElementById("root")!).render(<BrowserRouter><EnvironmentFixture /></BrowserRouter>);
