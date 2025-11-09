import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookMarked, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useBookLists } from "@/hooks/useBookLists";
import { useAuth } from "@/hooks/useAuth";
import { useSwipeable } from "react-swipeable";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

export const SwipeableBookListsCarousel = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { lists, loading } = useBookLists(user?.id);
  const { triggerHaptic } = useHapticFeedback();
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (currentIndex < lists.length - 1) {
        triggerHaptic('selection');
        setCurrentIndex(prev => prev + 1);
      }
    },
    onSwipedRight: () => {
      if (currentIndex > 0) {
        triggerHaptic('selection');
        setCurrentIndex(prev => prev - 1);
      }
    },
    trackMouse: true,
    preventScrollOnSwipe: true,
  });

  if (loading || lists.length === 0) {
    return null;
  }

  const currentList = lists[currentIndex];
  const hasMultiple = lists.length > 1;

  const handlePrevious = () => {
    if (currentIndex > 0) {
      triggerHaptic('selection');
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < lists.length - 1) {
      triggerHaptic('selection');
      setCurrentIndex(prev => prev + 1);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base md:text-lg font-semibold flex items-center">
          <BookMarked className="h-4 w-4 md:h-5 md:w-5 mr-2" />
          My Book Lists
        </h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate("/lists")}
        >
          View All
        </Button>
      </div>

      <div className="relative" {...handlers}>
        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow touch-manipulation"
          onClick={() => navigate(`/lists/${currentList.id}`)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <BookMarked className="h-5 w-5 text-primary flex-shrink-0" />
                <CardTitle className="text-base line-clamp-1">{currentList.name}</CardTitle>
              </div>
              <Badge variant="secondary" className="text-xs whitespace-nowrap">
                {currentList.book_count || 0} books
              </Badge>
            </div>
            {currentList.description && (
              <CardDescription className="text-sm line-clamp-2">
                {currentList.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Tap to view list
              </div>
              {hasMultiple && (
                <div className="flex items-center gap-1">
                  {lists.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === currentIndex 
                          ? 'w-6 bg-primary' 
                          : 'w-1.5 bg-muted'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Navigation Buttons for Desktop */}
        {hasMultiple && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm"
              onClick={(e) => {
                e.stopPropagation();
                handlePrevious();
              }}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              disabled={currentIndex === lists.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {hasMultiple && (
        <div className="text-center text-xs text-muted-foreground">
          Swipe to see more lists • {currentIndex + 1} of {lists.length}
        </div>
      )}
    </div>
  );
};
