import { useState } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestOverlayBack } from "@/lib/backLayers";
import { ProfileDrawer } from "./ProfileDrawer";
import { ShellNavigationProvider, ShellNavigationTrigger } from "./ShellNavigation";

const state = vi.hoisted(() => ({ social: true, signOut: vi.fn(), theme: vi.fn(), conversations: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "reader", email: "reader@example.test" }, signOut: state.signOut }) }));
vi.mock("@/contexts/ProfileContext", () => ({ useProfileContext: () => ({ profile: { display_name: "A reader" }, isLoading: false }) }));
vi.mock("@/hooks/useFollowing", () => ({ useFollowing: () => ({ followersCount: 3, followingCount: 5 }) }));
vi.mock("@/hooks/useConversations", () => ({ useConversations: () => {
  state.conversations();
  return { conversations: [{ unread_count: 2 }, { unread_count: 3 }] };
} }));
vi.mock("@/hooks/useFeatureFlags", () => ({ useFeatureFlags: () => ({ socialEnabled: state.social }) }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));
vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ resolvedTheme: "light", setThemeMode: state.theme }) }));

const Location = () => <output aria-label="Current route">{useLocation().pathname}</output>;
const menu = () => screen.getByRole("dialog", { name: "Your reading space" });
const renderMenu = (route = "/dashboard") => render(<MemoryRouter initialEntries={[route]}>
  <ShellNavigationProvider><ShellNavigationTrigger /><Location /></ShellNavigationProvider>
</MemoryRouter>);

beforeEach(() => { vi.clearAllMocks(); state.social = true; });
afterEach(cleanup);

describe("Shell navigation", () => {
  it("does not subscribe to menu data until it is first requested", () => {
    renderMenu();
    expect(state.conversations).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(state.conversations).toHaveBeenCalled();
  });

  it("has one semantic link per destination, gated primary order and the active route", () => {
    renderMenu("/book/example");
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const navigation = within(menu()).getByRole("navigation", { name: "Main navigation" });
    const links = within(navigation).getAllByRole("link");
    expect(links.slice(0, 5).map((link) => link.textContent)).toEqual(["Home", "Library", "Lists", "Feed", "Readers"]);
    const destinations = links.map((link) => link.getAttribute("href"));
    expect(new Set(destinations).size).toBe(destinations.length);
    expect(within(navigation).getByRole("link", { name: "Library" })).toHaveAttribute("aria-current", "page");
    expect(within(navigation).getByRole("link", { name: "Messages 5 unread" })).toHaveAttribute("href", "/messages");
    expect(within(navigation).getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/profile");
    expect(within(navigation).getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("removes all social destinations when the existing feature gate is disabled", () => {
    state.social = false;
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    for (const name of ["Feed", "Readers", "Clubs", "Reviews", /Messages/]) {
      expect(within(menu()).queryByRole("link", { name })).not.toBeInTheDocument();
    }
    expect(within(menu()).queryByRole("region", { name: "Community" })).not.toBeInTheDocument();
    expect(within(menu()).getByRole("link", { name: "Goals" })).toBeInTheDocument();
    expect(within(menu()).queryByText(/followers/)).not.toBeInTheDocument();
  });

  it.each(["close", "back"])("restores the visible trigger after ordinary %s dismissal", async (method) => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: "Menu" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    if (method === "close") fireEvent.click(within(menu()).getByRole("button", { name: "Close" }));
    else act(() => { expect(requestOverlayBack()).toBe(true); });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("preserves modifier-link behavior and dismisses on ordinary navigation without refocusing the outgoing trigger", async () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(trigger);
    const library = within(menu()).getByRole("link", { name: "Library" });
    let preventedByApp: boolean | undefined;
    window.addEventListener("click", (event) => {
      preventedByApp = event.defaultPrevented;
      // Observe the app's native-link contract, then cancel only jsdom's
      // unimplemented document navigation at the final window bubble stage.
      event.preventDefault();
    }, { once: true });
    fireEvent.click(library, { ctrlKey: true });
    expect(preventedByApp).toBe(false);
    expect(menu()).toBeInTheDocument();
    expect(screen.getByLabelText("Current route")).toHaveTextContent("/dashboard");
    const restore = vi.spyOn(trigger, "focus");
    fireEvent.click(library);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByLabelText("Current route")).toHaveTextContent("/my-books");
    expect(restore).not.toHaveBeenCalled();
  });

  it("retains the same open dialog when responsive header parents change and restores the replacement trigger", async () => {
    function Layout({ expanded }: { expanded: boolean }) {
      return <MemoryRouter><ShellNavigationProvider>
        {expanded ? <header><ShellNavigationTrigger /></header> : <section><ShellNavigationTrigger /></section>}
      </ShellNavigationProvider></MemoryRouter>;
    }
    const view = render(<Layout expanded={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const surface = menu();
    const goals = within(surface).getByRole("link", { name: "Goals" });
    goals.focus();
    view.rerender(<Layout expanded />);
    expect(menu()).toBe(surface);
    expect(goals).toHaveFocus();
    act(() => { requestOverlayBack(); });
    await waitFor(() => expect(screen.getByRole("button", { name: "Menu" })).toHaveFocus());
  });

  it("lets the controlled owner refuse close and keeps appearance available", () => {
    const change = vi.fn();
    render(<MemoryRouter><ProfileDrawer open onOpenChange={change} /></MemoryRouter>);
    fireEvent.click(within(menu()).getByRole("button", { name: "Close" }));
    expect(change).toHaveBeenCalledExactlyOnceWith(false);
    expect(menu()).toBeInTheDocument();
    fireEvent.click(within(menu()).getByRole("button", { name: "Switch to dark mode" }));
    expect(state.theme).toHaveBeenCalledExactlyOnceWith("dark");
  });

  it.each([undefined, "0"])("restores a visible page heading when resizing removes the invoker, preserving tabindex %s", async (tabIndex) => {
    function Layout({ expanded }: { expanded: boolean }) {
      return <MemoryRouter><ShellNavigationProvider>
        {!expanded && <ShellNavigationTrigger />}
        <main data-app-scroll-container><h1 tabIndex={tabIndex === undefined ? undefined : Number(tabIndex)}>My library</h1></main>
      </ShellNavigationProvider></MemoryRouter>;
    }
    const view = render(<Layout expanded={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const surface = menu();
    view.rerender(<Layout expanded />);
    expect(menu()).toBe(surface);
    fireEvent.click(within(menu()).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "My library" })).toHaveFocus());
    expect(screen.getByRole("heading", { name: "My library" })).toHaveAttribute("tabindex", tabIndex ?? "-1");
  });

  it("closes when another app action navigates while the menu is open", async () => {
    function App() {
      const navigate = useNavigate();
      const [open, setOpen] = useState(true);
      return <><button onClick={() => navigate("/settings")}>External navigation</button><ProfileDrawer open={open} onOpenChange={setOpen} /><Location /></>;
    }
    render(<MemoryRouter><App /></MemoryRouter>);
    fireEvent.click(screen.getByText("External navigation"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByLabelText("Current route")).toHaveTextContent("/settings");
  });

  it("does not create an inert Menu button outside the shell provider", () => {
    render(<ShellNavigationTrigger />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
