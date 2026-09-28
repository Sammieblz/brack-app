import { useEffect, useRef, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "reader" } as { id: string } | null,
  mobile: false,
  social: true,
  profileData: vi.fn(),
  historyData: vi.fn(),
  haptic: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user, loading: false }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mocks.mobile }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: mocks.haptic }) }));
vi.mock("@/hooks/useFeatureFlags", () => ({ useFeatureFlags: () => ({ socialEnabled: mocks.social }) }));
vi.mock("@/hooks/useUserProfile", () => ({ useUserProfile: () => ({
  profile: { id: "profile-reader", display_name: "A reader", created_at: "2026-01-01", profile_visibility: "public", current_streak: 2 },
  stats: { totalBooks: 1, booksRead: 1, badges: 0 },
  gamification: null, loading: false, error: null, refetch: vi.fn(),
}) }));
vi.mock("@/hooks/useFollowing", () => ({ useFollowing: () => ({
  followersCount: 0, followingCount: 0, isMutual: false, messageEligibility: "restricted", loading: false,
}) }));
vi.mock("@/services/api", () => ({ fetchUserProfileTabData: mocks.profileData, fetchReadingHistory: mocks.historyData }));
vi.mock("@/components/MobileLayout", () => ({ MobileLayout: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/MobileHeader", () => ({ MobileHeader: () => null }));
vi.mock("@/components/social/FollowButton", () => ({ FollowAction: () => <button type="button">Follow reader</button> }));
vi.mock("@/components/social/PostCard", () => ({ PostCard: () => null }));

import UserProfile from "./UserProfile";
import ReadingHistory from "./ReadingHistory";
import NotFound from "./NotFound";
import { FeatureGate } from "@/components/FeatureGate";
import { AppNavigationProvider } from "@/contexts/AppNavigationProvider";

const book = { id: "book-one", title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", cover_url: null, status: "reading" };
const club = { id: "club-one", name: "Evening readers", description: "Shared reading", is_private: false, cover_image_url: null };
const history = {
  progressLogs: [{ id: "log-one", book_id: book.id, page_number: 20, log_type: "manual", logged_at: "2026-09-20T12:00:00Z", books: book }],
  journalEntries: [{ id: "journal-one", book_id: book.id, entry_type: "note", title: "A thought", content: "Remember this passage", created_at: "2026-09-20T12:00:00Z", books: book }],
};

function Destination({ name }: { name: string }) {
  const navigate = useNavigate();
  return <><h1>{name}</h1><button type="button" onClick={() => navigate(-1)}>Return to source</button></>;
}
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}
function SeedObservedEntries({ entries }: { entries: string[] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cursor = useRef(1);
  useEffect(() => {
    if (cursor.current < entries.length) navigate(entries[cursor.current++]);
  }, [navigate, location.key, entries]);
  return null;
}
function renderRoutes(initialEntries: string[]) {
  window.history.replaceState(window.history.state ?? { idx: 0 }, "", initialEntries[0]);
  return render(<BrowserRouter><AppNavigationProvider accountScope={mocks.user?.id ?? null}>
    <SeedObservedEntries entries={initialEntries} />
    <LocationProbe />
    <Routes>
      <Route path="/users/:userId" element={<FeatureGate feature="social"><UserProfile /></FeatureGate>} />
      <Route path="/history" element={<ReadingHistory />} />
      <Route path="/book/:id" element={<Destination name="Book destination" />} />
      <Route path="/clubs/:clubId" element={<FeatureGate feature="social"><Destination name="Club destination" /></FeatureGate>} />
      <Route path="/dashboard" element={<Destination name="Dashboard destination" />} />
      <Route path="/analytics" element={<Destination name="Analytics destination" />} />
      <Route path="/readers" element={<Destination name="Readers destination" />} />
      <Route path="/my-books" element={<Destination name="Library destination" />} />
      <Route path="/" element={<Destination name="Home destination" />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </AppNavigationProvider></BrowserRouter>);
}

function expectBrowserHandledModifier(link: HTMLElement, modifier: "ctrlKey" | "metaKey") {
  let preventedByApp: boolean | undefined;
  const stopJsdomNavigation = (event: MouseEvent) => {
    // React has already handled the click at the root. Capture whether it left
    // the browser's new-tab action intact, then stop jsdom's unsupported action.
    preventedByApp = event.defaultPrevented;
    event.preventDefault();
  };
  document.addEventListener("click", stopJsdomNavigation, { once: true });
  fireEvent.click(link, { [modifier]: true });
  expect(preventedByApp).toBe(false);
}

beforeEach(() => {
  window.sessionStorage.clear();
  vi.clearAllMocks();
  mocks.user = { id: "reader" };
  mocks.mobile = false;
  mocks.social = true;
  mocks.profileData.mockResolvedValue({ books: [book], posts: [], clubs: [club] });
  mocks.historyData.mockResolvedValue(history);
  window.history.replaceState({ idx: 0 }, "");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, "");
});

describe("profile and history navigation", () => {
  it("opens a canonical club link with Enter and restores the mobile Clubs tab on Back", async () => {
    mocks.mobile = true;
    const user = userEvent.setup();
    renderRoutes(["/users/profile-reader?keep=1"]);
    await user.click(screen.getByRole("tab", { name: "Clubs" }));
    const link = await screen.findByRole("link", { name: "Open Evening readers" });
    expect(link).toHaveAttribute("href", "/clubs/club-one");
    expect(link.querySelector("button, input, select, a, [role=button]")).toBeNull();
    expect(screen.getByTestId("location")).toHaveTextContent("/users/profile-reader?keep=1&tab=clubs");
    expectBrowserHandledModifier(link, "ctrlKey");
    expect(screen.queryByRole("heading", { name: "Club destination" })).toBeNull();
    link.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "Club destination" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Return to source" }));
    expect(await screen.findByRole("link", { name: "Open Evening readers" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Clubs" })).toHaveAttribute("aria-selected", "true");
  });

  it("exposes profile books as independently focusable links", async () => {
    const user = userEvent.setup();
    renderRoutes(["/users/profile-reader?tab=unknown"]);
    const link = await screen.findByRole("link", { name: `Open ${book.title}` });
    expect(link).toHaveAttribute("href", "/book/book-one");
    expect(link.querySelector("button, input, select, a, [role=button]")).toBeNull();
    link.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "Book destination" })).toBeInTheDocument();
  });

  it("keeps progress links modifier-safe and keyboard accessible", async () => {
    const user = userEvent.setup();
    renderRoutes(["/history"]);
    const link = await screen.findByRole("link", { name: /Open The Left Hand of Darkness, progress log/ });
    expect(link).toHaveAttribute("href", "/book/book-one");
    expectBrowserHandledModifier(link, "metaKey");
    expect(screen.getByTestId("location")).toHaveTextContent("/history");
    link.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "Book destination" })).toBeInTheDocument();
  });

  it("restores the Journals tab after a detail visit without adding a tab history entry", async () => {
    window.history.replaceState({ idx: 1 }, "");
    const user = userEvent.setup();
    renderRoutes(["/dashboard", "/history?keep=1"]);
    await user.click(screen.getByRole("tab", { name: /Journal Entries/ }));
    const link = await screen.findByRole("link", { name: /Open The Left Hand of Darkness, A thought/ });
    expect(link.querySelector("button, input, select, a, [role=button]")).toBeNull();
    expect(screen.getByTestId("location")).toHaveTextContent("/history?keep=1&tab=journals");
    link.focus();
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "Return to source" }));
    expect(await screen.findByRole("link", { name: /A thought/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Journal Entries/ })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("button", { name: "Go back" }));
    expect(screen.getByRole("heading", { name: "Dashboard destination" })).toBeInTheDocument();
  });

  it.each([
    { path: "/history", tab: /Journal Entries/, destination: "Analytics destination" },
    { path: "/users/profile-reader", tab: /Clubs/, destination: "Readers destination" },
  ])("uses the safe fallback after replacing a tab on direct entry to $path", async ({ path, tab, destination }) => {
    const user = userEvent.setup();
    renderRoutes([path]);
    await user.click(screen.getByRole("tab", { name: tab }));
    await user.click(screen.getByRole("button", { name: "Go back" }));
    expect(screen.getByRole("heading", { name: destination })).toBeInTheDocument();
  });

  it.each(["/clubs/club-one", "/users/profile-reader?tab=clubs"])("keeps disabled social routes gated for direct entry: %s", async (path) => {
    mocks.social = false;
    renderRoutes([path]);
    expect(await screen.findByRole("heading", { name: "Dashboard destination" })).toBeInTheDocument();
    expect(mocks.profileData).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Club destination" })).toBeNull();
  });
});

describe("unknown route recovery", () => {
  it.each([undefined, 0, -1, "2", 5])("offers a Library link without unsafe Back on direct entry (index %s)", async (idx) => {
    window.history.replaceState({ idx, key: "a-nondefault-key" }, "");
    const user = userEvent.setup();
    renderRoutes(["/missing"]);
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Go back" })).toBeNull();
    const recovery = screen.getByRole("link", { name: "Go to my library" });
    expect(recovery).toHaveAttribute("href", "/my-books");
    await user.click(recovery);
    expect(await screen.findByRole("heading", { name: "Library destination" })).toBeInTheDocument();
  });

  it("offers an in-app Home link for a signed-out reader", async () => {
    mocks.user = null;
    const user = userEvent.setup();
    renderRoutes(["/missing"]);
    await user.click(screen.getByRole("link", { name: "Go home" }));
    expect(screen.getByRole("heading", { name: "Home destination" })).toBeInTheDocument();
  });

  it("goes back when app history exists", async () => {
    window.history.replaceState({ idx: 1 }, "");
    const user = userEvent.setup();
    renderRoutes(["/my-books", "/missing"]);
    await user.click(screen.getByRole("button", { name: "Go back" }));
    expect(screen.getByRole("heading", { name: "Library destination" })).toBeInTheDocument();
  });

  it("falls back safely if app history disappears before Back is activated", async () => {
    window.history.replaceState({ idx: 1 }, "");
    const user = userEvent.setup();
    renderRoutes(["/dashboard", "/missing"]);
    const back = screen.getByRole("button", { name: "Go back" });
    window.history.replaceState({ idx: 0 }, "");
    await user.click(back);
    expect(screen.getByRole("heading", { name: "Library destination" })).toBeInTheDocument();
  });
});
