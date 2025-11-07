import { BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getProgressPercentage } from "@/utils/bookProgress";
import type { Book } from "@/types";

interface BookCardProps {
  book: Book;
  onClick?: () => void;
  onStatusChange?: (bookId: string, status: string) => void;
}

export const BookCard = ({ book, onClick, onStatusChange }: BookCardProps) => {
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
    <Card 
      className="bg-gradient-card shadow-soft border-0 hover:shadow-medium transition-all duration-300 cursor-pointer group"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            {book.cover_url ? (
              <img
                src={book.cover_url}
                alt={book.title}
                className="w-12 h-16 object-cover rounded shadow-sm"
              />
            ) : (
              <div className="w-12 h-16 bg-gradient-primary rounded flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {book.title}
            </h3>
            {book.author && (
              <p className="text-sm text-muted-foreground truncate">
                by {book.author}
              </p>
            )}
            
            <div className="flex items-center justify-between mt-2">
              <Badge 
                variant="secondary" 
                className={`text-xs ${getStatusColor(book.status)}`}
              >
                {book.status.replace('_', ' ')}
              </Badge>
              
              {book.pages && (
                <span className="text-xs text-muted-foreground">
                  {book.pages} pages
                </span>
              )}
            </div>
            
            {book.genre && (
              <p className="text-xs text-muted-foreground mt-1">
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
      </CardContent>
    </Card>
  );
};