import { useEffect, useState } from "react";
import { ArrowUp } from "iconoir-react";
import { Button } from "@/components/ui/button";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface ScrollToTopProps {
  containerRef?: React.RefObject<HTMLElement>;
  threshold?: number;
  className?: string;
}

export const ScrollToTop = ({ 
  containerRef, 
  threshold = 300,
  className 
}: ScrollToTopProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const { triggerHaptic } = useHapticFeedback();
  const isMobile = useIsMobile();

  useEffect(() => {
    const container = containerRef?.current || window;
    
    const handleScroll = () => {
      const scrollTop = containerRef?.current 
        ? containerRef.current.scrollTop 
        : window.scrollY || document.documentElement.scrollTop;
      
      setIsVisible(scrollTop > threshold);
    };

    if (containerRef?.current) {
      containerRef.current.addEventListener("scroll", handleScroll);
    } else {
      window.addEventListener("scroll", handleScroll);
    }

    return () => {
      if (containerRef?.current) {
        containerRef.current.removeEventListener("scroll", handleScroll);
      } else {
        window.removeEventListener("scroll", handleScroll);
      }
    };
  }, [containerRef, threshold]);

  const scrollToTop = () => {
    triggerHaptic("light");
    
    if (containerRef?.current) {
      containerRef.current.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } else {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  if (!isVisible) return null;

  return (
    <Button
      onClick={scrollToTop}
      size="icon"
      className={cn(
        "fixed bottom-20 right-4 z-50 rounded-full shadow-lg",
        "bg-primary text-primary-foreground",
        "hover:bg-primary/90",
        "transition-all duration-300",
        "animate-in fade-in slide-in-from-bottom-4",
        isMobile && "bottom-24",
        className
      )}
      aria-label="Scroll to top"
    >
      <ArrowUp className="h-5 w-5" />
    </Button>
  );
};
