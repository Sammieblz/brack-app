import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { TimerProvider } from "@/contexts/TimerContext";
import { FloatingTimerWidget } from "@/components/FloatingTimerWidget";
import Index from "./screens/Index";
import Auth from "./screens/Auth";
import Welcome from "./screens/Welcome";
import Questionnaire from "./screens/Questionnaire";
import Goals from "./screens/Goals";
import Dashboard from "./screens/Dashboard";
import MyBooks from "./screens/MyBooks";
import Analytics from "./screens/Analytics";
import AddBook from "./screens/AddBook";
import BookDetail from "./screens/BookDetail";
import EditBook from "./screens/EditBook";
import ScanBarcode from "./screens/ScanBarcode";
import Profile from "./screens/Profile";
import ProgressTracking from "./screens/ProgressTracking";
import NotFound from "./screens/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TimerProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/questionnaire" element={<Questionnaire />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/books" element={<MyBooks />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/add-book" element={<AddBook />} />
              <Route path="/book/:id" element={<BookDetail />} />
              <Route path="/book/:id/progress" element={<ProgressTracking />} />
              <Route path="/edit-book/:id" element={<EditBook />} />
              <Route path="/scan" element={<ScanBarcode />} />
              <Route path="/profile" element={<Profile />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <FloatingTimerWidget />
          </BrowserRouter>
        </TooltipProvider>
      </TimerProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
