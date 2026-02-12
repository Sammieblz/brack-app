import { Routes, Route } from "react-router-dom";
import { PageTransition } from "@/components/animations/PageTransition";
import Dashboard from "./screens/Dashboard";
import Auth from "./screens/Auth";
import Welcome from "./screens/Welcome";
import Questionnaire from "./screens/Questionnaire";
import Goals from "./screens/Goals";
import MyBooks from "./screens/MyBooks";
import Analytics from "./screens/Analytics";
import AddBook from "./screens/AddBook";
import BookDetail from "./screens/BookDetail";
import ProgressTracking from "./screens/ProgressTracking";
import EditBook from "./screens/EditBook";
import ScanBarcode from "./screens/ScanBarcode";
import ScanCover from "./screens/ScanCover";
import Profile from "./screens/Profile";
import Settings from "./screens/Settings";
import Achievements from "./screens/Achievements";
import BookLists from "./screens/BookLists";
import BookListDetail from "./screens/BookListDetail";
import GoalsManagement from "./screens/GoalsManagement";
import UserProfile from "./screens/UserProfile";
import Reviews from "./screens/Reviews";
import Feed from "./screens/Feed";
import BookClubs from "./screens/BookClubs";
import BookClubDetail from "./screens/BookClubDetail";
import Readers from "./screens/Readers";
import Messages from "./screens/Messages";
import ReadingHistory from "./screens/ReadingHistory";
import NotFound from "./screens/NotFound";

export const AppRoutes = () => {
  return (
    <PageTransition>
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
        <Route path="/scan-cover" element={<ScanCover />} />
        <Route path="/history" element={<ReadingHistory />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/achievements" element={<Achievements />} />
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
        <Route path="*" element={<NotFound />} />
      </Routes>
    </PageTransition>
  );
};
