import { useState, useRef, useEffect } from 'react';
import { Search, X, Clock, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlatform } from '@/hooks/usePlatform';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import { Button } from '@/components/ui/button';

interface NativeSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export const NativeSearchBar = ({
  value,
  onChange,
  onSearch,
  placeholder = 'Search...',
  autoFocus = false,
  className,
}: NativeSearchBarProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const { platform, isIOS, isAndroid } = usePlatform();
  const { recentSearches, addSearch, removeSearch, clearAll } = useRecentSearches();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleFocus = () => {
    setIsFocused(true);
    setShowRecent(true);
  };

  const handleBlur = () => {
    // Delay to allow click events on recent searches
    setTimeout(() => {
      setIsFocused(false);
      setShowRecent(false);
    }, 200);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      addSearch(value);
      onSearch?.(value);
      inputRef.current?.blur();
    }
  };

  const handleCancel = () => {
    onChange('');
    inputRef.current?.blur();
  };

  const handleRecentClick = (query: string) => {
    onChange(query);
    onSearch?.(query);
    setShowRecent(false);
  };

  return (
    <div className={cn('relative w-full', className)}>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        {/* Search Input Container */}
        <div
          className={cn(
            'relative flex-1 flex items-center transition-all duration-300',
            isIOS && 'rounded-[10px]',
            isAndroid && 'rounded-full',
            !isIOS && !isAndroid && 'rounded-lg'
          )}
        >
          {/* iOS Back Button */}
          {isIOS && isFocused && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              className="absolute left-0 z-10 animate-in slide-in-from-left-5 duration-300"
            >
              <ArrowLeft className="h-5 w-5 text-primary" />
            </Button>
          )}

          {/* Search Icon */}
          <Search
            className={cn(
              'absolute left-3 h-4 w-4 text-muted-foreground transition-all duration-300',
              isIOS && isFocused && 'left-10'
            )}
          />

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            className={cn(
              'w-full h-10 bg-secondary/50 text-foreground placeholder:text-muted-foreground',
              'border border-border focus:border-primary focus:bg-background',
              'transition-all duration-300 outline-none',
              isIOS && 'rounded-[10px] pl-10 pr-10',
              isIOS && isFocused && 'pl-16',
              isAndroid && 'rounded-full pl-10 pr-10',
              isAndroid && isFocused && 'shadow-md',
              !isIOS && !isAndroid && 'rounded-lg pl-10 pr-10'
            )}
          />

          {/* Clear Button */}
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className={cn(
                'absolute right-3 p-1 rounded-full bg-muted hover:bg-muted/80',
                'transition-all duration-200 active:scale-95'
              )}
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* iOS Cancel Button */}
        {isIOS && isFocused && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleCancel}
            className="animate-in slide-in-from-right-5 duration-300 text-primary"
          >
            Cancel
          </Button>
        )}
      </form>

      {/* Recent Searches Dropdown */}
      {showRecent && recentSearches.length > 0 && (
        <div
          className={cn(
            'absolute top-full left-0 right-0 mt-2 bg-background border border-border',
            'overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-200 z-50',
            isIOS && 'rounded-[12px] shadow-lg',
            isAndroid && 'rounded-2xl shadow-xl',
            !isIOS && !isAndroid && 'rounded-lg shadow-md'
          )}
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <span className="text-sm font-medium text-muted-foreground">Recent</span>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-primary hover:underline"
            >
              Clear all
            </button>
          </div>

          <div className="max-h-[200px] overflow-y-auto">
            {recentSearches.map((query, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleRecentClick(query)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left',
                  'hover:bg-secondary/50 active:bg-secondary transition-colors',
                  'border-b border-border last:border-0'
                )}
              >
                <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 text-sm text-foreground truncate">{query}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSearch(query);
                  }}
                  className="p-1 hover:bg-muted rounded-full transition-colors"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
