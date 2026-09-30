import { useState, type MouseEvent, type PropsWithChildren } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsTaskProvider } from "@/contexts/SettingsTaskProvider";
import { useRegisterSettingsSignOut, useSettingsTask } from "@/contexts/SettingsTaskContext";
import { useSettingsLinkNavigation } from "@/hooks/useSettingsLinkNavigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ProfileDrawer } from "./ProfileDrawer";
import { MobileBottomNav } from "./MobileBottomNav";

const mocks = vi.hoisted(() => ({ signOut: vi.fn(), openSignOut: vi.fn(), haptic: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "reader", email: "reader@example.test" }, signOut: mocks.signOut }) }));
vi.mock("@/contexts/ProfileContext", () => ({ useProfileContext: () => ({ profile: { display_name: "Reader" }, isLoading: false }) }));
vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ resolvedTheme: "light", setThemeMode: vi.fn() }) }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: mocks.haptic }) }));
vi.mock("@/hooks/useFeatureFlags", () => ({ useFeatureFlags: () => ({ socialEnabled: false }) }));
vi.mock("@/hooks/useFollowing", () => ({ useFollowing: () => ({ followersCount: 0, followingCount: 0 }) }));
vi.mock("@/hooks/useConversations", () => ({ useConversations: () => ({ conversations: [] }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

type Surface = "sidebar" | "drawer" | "tabs";
function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}{location.hash}</output>;
}
function Surface({ surface }: { surface: Surface }) {
  const [open, setOpen] = useState(true);
  if (surface === "drawer") return <><ProfileDrawer open={open} onOpenChange={setOpen} /><output data-testid="menu-open">{String(open)}</output></>;
  if (surface === "sidebar") return <SidebarProvider><AppSidebar /></SidebarProvider>;
  return <MobileBottomNav />;
}
function Task({ dirty = true, pending = false }: { dirty?: boolean; pending?: boolean }) {
  useSettingsTask({ dirty, pending });
  useRegisterSettingsSignOut(mocks.openSignOut);
  return null;
}
function Fixture({ surface, dirty = true, pending = false, settings = true }: {
  surface: Surface; dirty?: boolean; pending?: boolean; settings?: boolean;
}) {
  const content = <><Task dirty={dirty} pending={pending} /><Surface surface={surface} /><Location /></>;
  return <MemoryRouter initialEntries={["/settings?section=profile"]}>
    {settings ? <SettingsTaskProvider>{content}</SettingsTaskProvider> : content}
  </MemoryRouter>;
}

beforeEach(() => { vi.clearAllMocks(); mocks.signOut.mockResolvedValue(undefined); });
afterEach(cleanup);

describe("Settings shell departure", () => {
  it.each<Surface>(["sidebar", "drawer", "tabs"])("%s keeps a declined draft, then navigates once after accepted discard", async surface => {
    render(<Fixture surface={surface} />);
    fireEvent.click(screen.getByRole("link", { name: "Home" }));
    expect(screen.getByRole("dialog", { name: "Discard unsaved changes?" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/settings?section=profile");
    if (surface === "drawer") expect(screen.getByTestId("menu-open")).toHaveTextContent("true");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Keep editing" })));
    fireEvent.click(screen.getByRole("link", { name: "Home" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Discard changes" })));
    expect(screen.getByTestId("location")).toHaveTextContent("/dashboard");
    if (surface === "drawer") expect(screen.getByTestId("menu-open")).toHaveTextContent("false");
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it.each<Surface>(["sidebar", "drawer", "tabs"])("%s cannot abandon a pending Settings write", async surface => {
    render(<Fixture surface={surface} pending />);
    await act(async () => fireEvent.click(screen.getByRole("link", { name: "Home" })));
    expect(screen.getByTestId("location")).toHaveTextContent("/settings?section=profile");
    expect(screen.queryByRole("dialog", { name: "Discard unsaved changes?" })).not.toBeInTheDocument();
    if (surface === "drawer") expect(screen.getByTestId("menu-open")).toHaveTextContent("true");
  });

  it.each<Surface>(["sidebar", "drawer"])("%s delegates sign-out to Settings only after its pending/dirty guard", async surface => {
    const view = render(<Fixture surface={surface} pending />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sign out" })));
    expect(mocks.openSignOut).not.toHaveBeenCalled(); expect(mocks.signOut).not.toHaveBeenCalled();
    view.rerender(<Fixture surface={surface} />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Keep editing" })));
    expect(mocks.openSignOut).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Discard changes" })));
    expect(mocks.openSignOut).toHaveBeenCalledOnce(); expect(mocks.signOut).not.toHaveBeenCalled();
    expect(screen.getByTestId("location")).toHaveTextContent("/settings?section=profile");
    if (surface === "drawer") expect(screen.getByTestId("menu-open")).toHaveTextContent("false");
  });

  it.each<Surface>(["sidebar", "drawer", "tabs"])("%s keeps normal link navigation outside Settings", async surface => {
    render(<Fixture surface={surface} settings={false} />);
    fireEvent.click(screen.getByRole("link", { name: "Home" }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/dashboard"));
    expect(screen.queryByRole("dialog", { name: "Discard unsaved changes?" })).not.toBeInTheDocument();
  });

  it.each<Surface>(["sidebar", "drawer"])("%s keeps its existing sign-out service outside Settings", async surface => {
    render(<Fixture surface={surface} settings={false} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sign out" })));
    expect(mocks.signOut).toHaveBeenCalledOnce(); expect(mocks.openSignOut).not.toHaveBeenCalled();
    expect(screen.getByTestId("location")).toHaveTextContent("/");
    if (surface === "drawer") expect(screen.getByTestId("menu-open")).toHaveTextContent("false");
  });

  it("retains browser modifier/target behavior and captures the complete link before awaiting", async () => {
    const wrapper = ({ children }: PropsWithChildren) => <MemoryRouter initialEntries={["/settings"]}><SettingsTaskProvider>{children}</SettingsTaskProvider></MemoryRouter>;
    const hook = renderHook(() => ({ handle: useSettingsLinkNavigation(), location: useLocation() }), { wrapper });
    const anchor = document.createElement("a");
    anchor.href = "/profile?tab=books#recent";
    const event = (changes: Partial<MouseEvent<HTMLAnchorElement>> = {}) => ({
      currentTarget: anchor, defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false,
      altKey: false, shiftKey: false, preventDefault: vi.fn(), ...changes,
    } as unknown as MouseEvent<HTMLAnchorElement>);
    for (const changes of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { defaultPrevented: true }]) {
      const click = event(changes);
      expect(hook.result.current.handle(click)).toBe(false); expect(click.preventDefault).not.toHaveBeenCalled();
    }
    anchor.target = "_blank";
    expect(hook.result.current.handle(event())).toBe(false);
    anchor.target = ""; anchor.setAttribute("download", "books");
    expect(hook.result.current.handle(event())).toBe(false);
    anchor.removeAttribute("download");
    const click = event();
    const accepted = vi.fn();
    await act(async () => {
      expect(hook.result.current.handle(click, accepted)).toBe(true);
      anchor.href = "/changed-after-click";
    });
    expect(click.preventDefault).toHaveBeenCalledOnce(); expect(accepted).toHaveBeenCalledOnce();
    expect(hook.result.current.location).toMatchObject({ pathname: "/profile", search: "?tab=books", hash: "#recent" });
  });
});
