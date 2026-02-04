import { Suspense, lazy, useMemo, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { TimerProvider } from "@/contexts/TimerContext";
import { FloatingTimerWidget } from "@/components/FloatingTimerWidget";
import { SwipeBackHandler } from "@/components/SwipeBackHandler";
import { JournalPromptHandler } from "@/components/JournalPromptHandler";
import LoadingSpinner from "@/components/LoadingSpinner";
import Index from "./screens/Index";
import Auth from "./screens/Auth";
import Welcome from "./screens/Welcome";
import Questionnaire from "./screens/Questionnaire";
import Goals from "./screens/Goals";
import Dashboard from "./screens/Dashboard";
import MyBooks from "./screens/MyBooks";
import AddBook from "./screens/AddBook";
import BookDetail from "./screens/BookDetail";
import EditBook from "./screens/EditBook";
import ScanBarcode from "./screens/ScanBarcode";
import Profile from "./screens/Profile";
import BookLists from "./screens/BookLists";
import BookListDetail from "./screens/BookListDetail";
import GoalsManagement from "./screens/GoalsManagement";
import { ProfileProvider } from "./contexts/ProfileContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import UserProfile from "./screens/UserProfile";
import Reviews from "./screens/Reviews";
import Feed from "./screens/Feed";
import Readers from "./screens/Readers";
import NotFound from "./screens/NotFound";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { ConfirmDialogProvider } from "./contexts/ConfirmDialogContext";
import { initSentry } from "./lib/sentry";
import { usePushNotifications } from "./hooks/usePushNotifications";

// Initialize Sentry error tracking
initSentry();

const Analytics = lazy(() => import("./screens/Analytics"));
const BookClubs = lazy(() => import("./screens/BookClubs"));
const BookClubDetail = lazy(() => import("./screens/BookClubDetail"));
const Messages = lazy(() => import("./screens/Messages"));
const ProgressTracking = lazy(() => import("./screens/ProgressTracking"));
const ReadingHistory = lazy(() => import("./screens/ReadingHistory"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: "always",
    },
    mutations: {
      retry: 1,
    },
  },
});

const App = () => {
  useNetworkStatus();
  const { register: registerPushNotifications } = usePushNotifications();
  
  // Register for push notifications on app start (native only)
  useEffect(() => {
    registerPushNotifications().catch(console.error);
  }, [registerPushNotifications]);

  const persister = useMemo(
    () => createSyncStoragePersister({ storage: window.localStorage }),
    []
  );

  return (
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 1000 * 60 * 60 * 24,
        }}
      >
        <ConfirmDialogProvider>
          <ThemeProvider>
            <ProfileProvider>
              <TimerProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <Suspense fallback={<div className="p-10 flex justify-center"><LoadingSpinner size="lg" /></div>}>
                    <BrowserRouter>
                      <SwipeBackHandler>
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/auth" element={<Auth />} />
                          <Route path="/welcome" element={<Welcome />} />
                          <Route path="/questionnaire" element={<Questionnaire />} />
                          <Route path="/goals" element={<Goals />} />
                          <Route path="/dashboard" element={<Dashboard />} />
                          <Route path="/my-books" element={<MyBooks />} />
                          <Route path="/books" element={<MyBooks />} />
                          <Route path="/analytics" element={<Analytics />} />
                          <Route path="/add-book" element={<AddBook />} />
                          <Route path="/book/:id" element={<BookDetail />} />
                          <Route path="/book/:id/progress" element={<ProgressTracking />} />
                          <Route path="/edit-book/:id" element={<EditBook />} />
                          <Route path="/scan-barcode" element={<ScanBarcode />} />
                          <Route path="/scan" element={<ScanBarcode />} />
                          <Route path="/history" element={<ReadingHistory />} />
                          <Route path="/profile" element={<Profile />} />
                          <Route path="/book-lists" element={<BookLists />} />
                          <Route path="/lists" element={<BookLists />} />
                          <Route path="/lists/:listId" element={<BookListDetail />} />
                          <Route path="/goals-management" element={<GoalsManagement />} />
                          <Route path="/users/:userId" element={<UserProfile />} />
                          <Route path="/reviews" element={<Reviews />} />
                          <Route path="/feed" element={<Feed />} />
                          <Route path="/clubs" element={<BookClubs />} />
                          <Route path="/clubs/:clubId" element={<BookClubDetail />} />
                          <Route path="/readers" element={<Readers />} />
                          <Route path="/messages" element={<Messages />} />
                          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                        <FloatingTimerWidget />
                        <JournalPromptHandler />
                      </SwipeBackHandler>
                    </BrowserRouter>
                  </Suspense>
                </TooltipProvider>
              </TimerProvider>
            </ProfileProvider>
          </ThemeProvider>
        </ConfirmDialogProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
