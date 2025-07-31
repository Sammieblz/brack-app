import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./screens/Index";
import Auth from "./screens/Auth";
import Welcome from "./screens/Welcome";
import Questionnaire from "./screens/Questionnaire";
import Goals from "./screens/Goals";
import Dashboard from "./screens/Dashboard";
import AddBook from "./screens/AddBook";
import BookDetail from "./screens/BookDetail";
import Timer from "./screens/Timer";
import ScanBarcode from "./screens/ScanBarcode";
import NotFound from "./screens/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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
          <Route path="/add-book" element={<AddBook />} />
          <Route path="/book/:id" element={<BookDetail />} />
          <Route path="/timer" element={<Timer />} />
          <Route path="/scan" element={<ScanBarcode />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
