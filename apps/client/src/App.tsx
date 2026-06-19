import { Suspense, lazy, useMemo, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PageTransition } from "@/components/animations/PageTransition";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { TimerProvider } from "@/contexts/TimerContext";
import { FloatingTimerWidget } from "@/components/FloatingTimerWidget";
import { SwipeBackHandler } from "@/components/SwipeBackHandler";
import { JournalPromptHandler } from "@/components/JournalPromptHandler";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { syncService } from "@/services/syncService";
import { deepLinkService } from "@/services/deepLinkService";
import { DeepLinkHandler } from "@/components/DeepLinkHandler";
import LoadingSpinner from "@/components/LoadingSpinner";
// Critical path screens - keep synchronous for instant loading
import Index from "./screens/Index";
import Auth from "./screens/Auth";
import AuthCallback from "./screens/AuthCallback";
import ResetPassword from "./screens/ResetPassword";
import NotFound from "./screens/NotFound";

import { ProfileProvider } from "./contexts/ProfileContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { ConfirmDialogProvider } from "./contexts/ConfirmDialogContext";
import { initSentry } from "./lib/sentry";
import { usePushNotifications } from "./hooks/usePushNotifications";
import { usePresenceHeartbeat } from "./hooks/usePresenceHeartbeat";
import { LiveRegion } from "./components/ui/live-region";
import { BadgeCelebrationProvider } from "./contexts/BadgeCelebrationContext";
import { useAppViewportHeight } from "./hooks/useAppViewportHeight";
import { OnboardingRouteGuard } from "./components/OnboardingRouteGuard";
import { OnboardingEntryRedirect } from "./components/OnboardingEntryRedirect";
import { FeatureGate } from "./components/FeatureGate";

// Initialize Sentry error tracking
initSentry();

const Analytics = lazy(() => import("./screens/Analytics"));
const Onboarding = lazy(() => import("./screens/Onboarding"));
const Dashboard = lazy(() => import("./screens/Dashboard"));
const MyBooks = lazy(() => import("./screens/MyBooks"));
const AddBook = lazy(() => import("./screens/AddBook"));
const BookDetail = lazy(() => import("./screens/BookDetail"));
const EditBook = lazy(() => import("./screens/EditBook"));
const ScanBarcode = lazy(() => import("./screens/ScanBarcode"));
const ScanCover = lazy(() => import("./screens/ScanCover"));
const Profile = lazy(() => import("./screens/Profile"));
const Settings = lazy(() => import("./screens/Settings"));
const Achievements = lazy(() => import("./screens/Achievements"));
const BookLists = lazy(() => import("./screens/BookLists"));
const BookListDetail = lazy(() => import("./screens/BookListDetail"));
const GoalsManagement = lazy(() => import("./screens/GoalsManagement"));
const UserProfile = lazy(() => import("./screens/UserProfile"));
const Reviews = lazy(() => import("./screens/Reviews"));
const ReviewDetail = lazy(() => import("./screens/ReviewDetail"));
const Feed = lazy(() => import("./screens/Feed"));
const PostDetail = lazy(() => import("./screens/PostDetail"));
const Readers = lazy(() => import("./screens/Readers"));
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
  useAppViewportHeight();
  useNetworkStatus();
  usePresenceHeartbeat();
  const { register: registerPushNotifications } = usePushNotifications();
  
  // Register for push notifications on app start (native only)
  useEffect(() => {
    registerPushNotifications().catch(console.error);
    syncService.manualSync().catch(console.error);
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
                  <LiveRegion level="polite" />
                  <Suspense fallback={<div className="p-10 flex justify-center"><LoadingSpinner size="lg" /></div>}>
                    <BrowserRouter>
                      <BadgeCelebrationProvider>
                        <DeepLinkHandler />
                        <OnboardingRouteGuard />
                        <SwipeBackHandler>
                          <PageTransition>
                            <Routes>
                            <Route path="/" element={<Index />} />
                            <Route path="/auth" element={<Auth />} />
                            <Route path="/auth/callback" element={<AuthCallback />} />
                            <Route path="/auth/reset-password" element={<ResetPassword />} />
                            <Route path="/onboarding" element={<Onboarding />} />
                            <Route path="/welcome" element={<OnboardingEntryRedirect />} />
                            <Route path="/questionnaire" element={<OnboardingEntryRedirect />} />
                            <Route path="/goals" element={<OnboardingEntryRedirect />} />
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
                            <Route path="/scan-cover" element={<ScanCover />} />
                            <Route path="/history" element={<ReadingHistory />} />
                            <Route path="/profile" element={<Profile />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/achievements" element={<Achievements />} />
                            <Route path="/book-lists" element={<BookLists />} />
                            <Route path="/lists" element={<BookLists />} />
                            <Route path="/lists/:listId" element={<BookListDetail />} />
                            <Route path="/goals-management" element={<GoalsManagement />} />
                            <Route path="/users/:userId" element={<FeatureGate feature="social"><UserProfile /></FeatureGate>} />
                            <Route path="/reviews" element={<FeatureGate feature="social"><Reviews /></FeatureGate>} />
                            <Route path="/reviews/:reviewId" element={<FeatureGate feature="social"><ReviewDetail /></FeatureGate>} />
                            <Route path="/feed" element={<FeatureGate feature="social"><Feed /></FeatureGate>} />
                            <Route path="/posts/:postId" element={<FeatureGate feature="social"><PostDetail /></FeatureGate>} />
                            <Route path="/clubs" element={<FeatureGate feature="social"><BookClubs /></FeatureGate>} />
                            <Route path="/clubs/:clubId" element={<FeatureGate feature="social"><BookClubDetail /></FeatureGate>} />
                            <Route path="/readers" element={<FeatureGate feature="social"><Readers /></FeatureGate>} />
                            <Route path="/messages" element={<FeatureGate feature="social"><Messages /></FeatureGate>} />
                            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </PageTransition>
                        <FloatingTimerWidget />
                        <JournalPromptHandler />
                        <OfflineIndicator />
                      </SwipeBackHandler>
                      </BadgeCelebrationProvider>
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
