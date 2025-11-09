import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Search, Filter, Loader2, BarChart3 } from "lucide-react";
import { BookCard } from "@/components/BookCard";
import { useAuth } from "@/hooks/useAuth";
import { useBooks } from "@/hooks/useBooks";
import { BookCardSkeleton } from "@/components/skeletons/BookCardSkeleton";
import { StatCardSkeleton } from "@/components/skeletons/StatCardSkeleton";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { PullToRefresh } from "@/components/PullToRefresh";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MyBooks = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { books, loading, loadingMore, hasMore, loadMore, refetchBooks } = useBooks(user?.id);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  const loadMoreRef = useInfiniteScroll({
    hasMore,
    loading: loadingMore,
    onLoadMore: loadMore,
  });

  const handleBookClick = (bookId: string) => {
    navigate(`/book/${bookId}`);
  };

  // Use activeTab on mobile, statusFilter on desktop
  const effectiveFilter = isMobile ? activeTab : statusFilter;

  const filteredBooks = books.filter((book) => {
    const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         book.author?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         book.genre?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = effectiveFilter === "all" || book.status === effectiveFilter;
    return matchesSearch && matchesStatus;
  });

  const bookStats = {
    total: books.length,
    reading: books.filter(book => book.status === "reading").length,
    completed: books.filter(book => book.status === "completed").length,
    toRead: books.filter(book => book.status === "to_read").length,
  };

  return (
    <MobileLayout>
      <PullToRefresh onRefresh={async () => await refetchBooks()}>
        {isMobile && (
          <MobileHeader 
            title="Library" 
            action={
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate("/analytics")}
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
            }
          />
        )}
        
        <div className="max-w-6xl mx-auto px-4 py-4 md:p-6 space-y-4 md:space-y-6">
          {/* Desktop Header */}
          {!isMobile && (
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold flex items-center">
                  <BookOpen className="mr-3 h-8 w-8 text-primary" />
                  My Books
                </h1>
                <p className="text-muted-foreground mt-1">Manage your personal library</p>
              </div>
              
              <div className="flex gap-3">
                <Button 
                  onClick={() => navigate("/book-lists")}
                  variant="outline"
                >
                  Book Lists
                </Button>
                <Button 
                  onClick={() => navigate("/analytics")}
                  variant="outline"
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Analytics
                </Button>
                <Button onClick={() => navigate("/add-book")}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Add Book
                </Button>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {loading ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <Card>
                  <CardContent className="p-3 md:p-4 text-center">
                    <div className="text-xl md:text-2xl font-bold text-primary">{bookStats.total}</div>
                    <div className="text-xs md:text-sm text-muted-foreground">Total</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 md:p-4 text-center">
                    <div className="text-xl md:text-2xl font-bold text-blue-500">{bookStats.reading}</div>
                    <div className="text-xs md:text-sm text-muted-foreground">Reading</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 md:p-4 text-center">
                    <div className="text-xl md:text-2xl font-bold text-green-500">{bookStats.completed}</div>
                    <div className="text-xs md:text-sm text-muted-foreground">Done</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 md:p-4 text-center">
                    <div className="text-xl md:text-2xl font-bold text-orange-500">{bookStats.toRead}</div>
                    <div className="text-xs md:text-sm text-muted-foreground">To Read</div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Mobile Tabs */}
          {isMobile && (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="reading" className="text-xs">Reading</TabsTrigger>
                <TabsTrigger value="completed" className="text-xs">Done</TabsTrigger>
                <TabsTrigger value="to_read" className="text-xs">To Read</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search books..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Desktop Filter */}
          {!isMobile && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
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
          )}

          {/* Books Grid */}
          {loading ? (
            <div className="space-y-3">
              <BookCardSkeleton />
              <BookCardSkeleton />
              <BookCardSkeleton />
            </div>
          ) : filteredBooks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                {books.length === 0 ? (
                  <>
                    <h3 className="font-semibold mb-2">No books yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Start building your digital library
                    </p>
                    {!isMobile && (
                      <Button onClick={() => navigate("/add-book")}>
                        <BookOpen className="mr-2 h-4 w-4" />
                        Add Your First Book
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <h3 className="font-semibold mb-2">No books found</h3>
                    <p className="text-sm text-muted-foreground">
                      Try adjusting your search or filter
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
                  userId={user?.id}
                />
              ))}
              
              {hasMore && (
                <div ref={loadMoreRef} className="py-8 flex justify-center">
                  {loadingMore && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading more...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </PullToRefresh>
      
      {/* Mobile FAB */}
      {isMobile && <FloatingActionButton />}
    </MobileLayout>
  );
};

export default MyBooks;
