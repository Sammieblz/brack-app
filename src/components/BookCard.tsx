import { Book as BookIcon, Plus, EditPencil, Trash, ShareIos } from "iconoir-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { getProgressPercentage } from "@/utils/bookProgress";
import { AddToListDialog } from "@/components/AddToListDialog";
import { ContextMenuNative } from "@/components/ui/context-menu-native";
import { OptimizedImage } from "@/components/OptimizedImage";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import type { Book } from "@/types";
import { useNavigate } from "react-router-dom";
import * as React from "react";
import { cn } from "@/lib/utils";

interface BookCardProps {
  book: Book;
  onClick?: () => void;
  onStatusChange?: (bookId: string, status: string) => void;
  onDelete?: (bookId: string) => void;
  userId?: string;
}

export const BookCard = ({ book, onClick, onStatusChange, onDelete, userId }: BookCardProps) => {
  const navigate = useNavigate();
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  
  // Track previous status for smooth transitions
  const prevStatusRef = React.useRef(book.status);
  const [isTransitioning, setIsTransitioning] = React.useState(false);

  React.useEffect(() => {
    if (prevStatusRef.current !== book.status) {
      setIsTransitioning(true);
      const timer = setTimeout(() => setIsTransitioning(false), 500);
      prevStatusRef.current = book.status;
      return () => clearTimeout(timer);
    }
  }, [book.status]);

  const contextActions = [
    {
      label: "View Details",
      icon: <BookIcon className="h-5 w-5" />,
      onClick: () => onClick?.(),
    },
    {
      label: "Edit",
      icon: <EditPencil className="h-5 w-5" />,
      onClick: () => navigate(`/edit-book/${book.id}`),
    },
    {
      label: "Share",
      icon: <ShareIos className="h-5 w-5" />,
      onClick: () => {
        if (navigator.share) {
          navigator.share({
            title: book.title,
            text: `Check out "${book.title}" by ${book.author || 'Unknown Author'}`,
          });
        }
      },
    },
    {
      label: "Delete",
      icon: <Trash className="h-5 w-5" />,
      variant: 'destructive' as const,
      onClick: () => onDelete?.(book.id),
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 text-white';
      case 'reading':
        return 'bg-orange-500 text-white';
      case 'to_read':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  return (
    <ContextMenuNative
      actions={contextActions}
      title={book.title}
      description="Choose an action"
    >
      <Card 
        className="bg-gradient-card shadow-soft border-0 hover:shadow-medium active:scale-[0.98] transition-all duration-200 group touch-manipulation"
      >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start space-x-3 sm:space-x-4">
          <div onClick={onClick} className="cursor-pointer flex-1 flex items-start space-x-3 sm:space-x-4">
          <div className="flex-shrink-0">
            {book.cover_url ? (
              <ImageLightbox
                src={book.cover_url}
                alt={book.title}
                isOpen={lightboxOpen}
                onClose={() => setLightboxOpen(false)}
              >
                <OptimizedImage
                  src={book.cover_url}
                  alt={book.title}
                  className="w-14 h-20 sm:w-16 sm:h-24 object-cover rounded shadow-sm cursor-zoom-in"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxOpen(true);
                  }}
                />
              </ImageLightbox>
            ) : (
              <div className="w-14 h-20 sm:w-16 sm:h-24 bg-gradient-primary rounded flex items-center justify-center">
                <BookIcon className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-serif font-semibold text-sm sm:text-base text-foreground line-clamp-2 group-hover:text-primary transition-colors">
              {book.title}
            </h3>
            {book.author && (
              <p className="font-serif text-xs sm:text-sm text-muted-foreground truncate mt-0.5">
                by {book.author}
              </p>
            )}
            
            <div className="flex items-center justify-between mt-1.5 sm:mt-2">
              <Badge 
                variant="secondary" 
                className={cn(
                  "text-[10px] sm:text-xs px-2 py-0.5 transition-all duration-500 ease-in-out",
                  getStatusColor(book.status),
                  isTransitioning && "scale-110"
                )}
              >
                {book.status.replace('_', ' ')}
              </Badge>
              
              {book.pages && (
                <span className="text-[10px] sm:text-xs text-muted-foreground">
                  {book.pages} pages
                </span>
              )}
            </div>
            
            {book.genre && (
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                {book.genre}
              </p>
            )}

            {book.tags && book.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {book.tags.slice(0, 3).map((tag) => (
                  <span 
                    key={tag} 
                    className="text-xs bg-muted px-2 py-0.5 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
                {book.tags.length > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{book.tags.length - 3}
                  </span>
                )}
              </div>
            )}
            
            {book.status === 'reading' && book.pages && (
              <div className="mt-2 space-y-1">
                <Progress value={getProgressPercentage(book)} className="h-1.5" />
                <p className="text-xs text-muted-foreground">
                  {book.current_page || 0} / {book.pages} pages ({Math.round(getProgressPercentage(book))}%)
                </p>
              </div>
            )}
          </div>
        </div>
          
          {userId && (
            <div className="flex-shrink-0 ml-1 sm:ml-2" onClick={(e) => e.stopPropagation()}>
              <AddToListDialog 
                bookId={book.id} 
                userId={userId}
                trigger={
                  <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 touch-manipulation">
                    <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                }
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
    </ContextMenuNative>
  );
};
