import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Plus, Search, Filter, Timer } from "lucide-react";
import { BookCard } from "@/components/BookCard";
import { useAuth } from "@/hooks/useAuth";
import { useBooks } from "@/hooks/useBooks";
import { Navbar } from "@/components/Navbar";
import LoadingSpinner from "@/components/LoadingSpinner";

const MyBooks = () => {
  const { user } = useAuth();
  const { books, loading } = useBooks(user?.id);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const handleBookClick = (bookId: string) => {
    navigate(`/book/${bookId}`);
  };

  const filteredBooks = books.filter((book) => {
    const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         book.author?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         book.genre?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || book.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const bookStats = {
    total: books.length,
    reading: books.filter(book => book.status === "reading").length,
    completed: books.filter(book => book.status === "completed").length,
    toRead: books.filter(book => book.status === "to_read").length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner size="lg" text="Loading your books..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background">
      <Navbar />
      
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <BookOpen className="mr-3 h-8 w-8 text-primary" />
              My Books
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your personal library
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={() => navigate("/timer")} variant="outline">
              <Timer className="mr-2 h-4 w-4" />
              Reading Timer
            </Button>
            <Button onClick={() => navigate("/add-book")}>
              <Plus className="mr-2 h-4 w-4" />
              Add Book
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{bookStats.total}</div>
              <div className="text-sm text-muted-foreground">Total Books</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-500">{bookStats.reading}</div>
              <div className="text-sm text-muted-foreground">Currently Reading</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-500">{bookStats.completed}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-500">{bookStats.toRead}</div>
              <div className="text-sm text-muted-foreground">To Read</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search books by title, author, or genre..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Books</SelectItem>
                    <SelectItem value="reading">Currently Reading</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="to_read">To Read</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Books Grid */}
        {filteredBooks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              {books.length === 0 ? (
                <>
                  <h3 className="text-lg font-semibold mb-2">No books yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start building your digital library by adding your first book.
                  </p>
                  <Button onClick={() => navigate("/add-book")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Book
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold mb-2">No books found</h3>
                  <p className="text-muted-foreground">
                    Try adjusting your search or filter criteria.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredBooks.map((book) => (
              <BookCard 
                key={book.id} 
                book={book} 
                onClick={() => handleBookClick(book.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyBooks;