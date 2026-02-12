import * as React from "react"
import { cn } from "@/lib/utils"

interface MasonryLayoutProps {
  children: React.ReactNode;
  columns?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: number;
  className?: string;
}

/**
 * Masonry layout component for displaying items in a Pinterest-style grid
 * Uses CSS columns for true masonry effect
 */
export const MasonryLayout = ({
  children,
  columns = { default: 2, sm: 2, md: 3, lg: 4 },
  gap = 4,
  className,
}: MasonryLayoutProps) => {
  const columnClasses = React.useMemo(() => {
    const classes: string[] = [];
    
    // Default columns
    if (columns.default) {
      classes.push(`columns-${columns.default}`);
    }
    
    // Responsive columns
    if (columns.sm) {
      classes.push(`sm:columns-${columns.sm}`);
    }
    if (columns.md) {
      classes.push(`md:columns-${columns.md}`);
    }
    if (columns.lg) {
      classes.push(`lg:columns-${columns.lg}`);
    }
    if (columns.xl) {
      classes.push(`xl:columns-${columns.xl}`);
    }
    
    return classes.join(' ');
  }, [columns]);

  return (
    <div
      className={cn(
        "columns",
        columnClasses,
        `gap-${gap}`,
        "break-inside-avoid",
        className
      )}
      style={{
        columnGap: `${gap * 0.25}rem`,
      }}
    >
      {React.Children.map(children, (child, index) => (
        <div
          key={index}
          className="break-inside-avoid mb-4"
          style={{
            pageBreakInside: 'avoid',
            breakInside: 'avoid',
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
};

/**
 * Alternative masonry using flexbox (better browser support)
 * Items will have varying heights naturally
 */
export const FlexMasonryLayout = ({
  children,
  columns = { default: 2, sm: 2, md: 3, lg: 4 },
  gap = 4,
  className,
}: MasonryLayoutProps) => {
  const [columnCount, setColumnCount] = React.useState(columns.default || 2);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const updateColumns = () => {
      if (!containerRef.current) return;
      
      const width = containerRef.current.offsetWidth;
      let cols = columns.default || 2;
      
      if (columns.xl && width >= 1280) cols = columns.xl;
      else if (columns.lg && width >= 1024) cols = columns.lg;
      else if (columns.md && width >= 768) cols = columns.md;
      else if (columns.sm && width >= 640) cols = columns.sm;
      
      setColumnCount(cols);
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, [columns]);

  const childrenArray = React.Children.toArray(children);
  const columnsArray = Array.from({ length: columnCount }, () => [] as React.ReactNode[]);

  // Distribute children across columns
  childrenArray.forEach((child, index) => {
    columnsArray[index % columnCount].push(child);
  });

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex gap-4",
        className
      )}
      style={{ gap: `${gap * 0.25}rem` }}
    >
      {columnsArray.map((column, colIndex) => (
        <div
          key={colIndex}
          className="flex-1 flex flex-col"
          style={{ gap: `${gap * 0.25}rem` }}
        >
          {column.map((child, childIndex) => (
            <div key={childIndex} className="w-full">
              {child}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
