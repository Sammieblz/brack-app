import * as React from "react"
import { X, ZoomIn, ZoomOut, RotateCw } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"

interface ImageLightboxProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
  children?: React.ReactNode; // Trigger element
}

export const ImageLightbox = ({ 
  src, 
  alt, 
  isOpen, 
  onClose,
  children 
}: ImageLightboxProps) => {
  const [scale, setScale] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const imageRef = React.useRef<HTMLImageElement>(null);
  const { triggerHaptic } = useHapticFeedback();

  // Reset on open
  React.useEffect(() => {
    if (isOpen) {
      setScale(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  // Keyboard shortcuts
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        case 'r':
        case 'R':
          handleRotate();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, scale]);

  const handleZoomIn = () => {
    triggerHaptic('light');
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    triggerHaptic('light');
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = () => {
    triggerHaptic('selection');
    setRotation(prev => (prev + 90) % 360);
  };

  const handleReset = () => {
    triggerHaptic('light');
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.max(0.5, Math.min(3, prev + delta)));
  };

  return (
    <>
      {children && (
        <div 
          onClick={() => {
            triggerHaptic('light');
            // Open lightbox - handled by parent
          }}
          className="cursor-zoom-in"
        >
          {children}
        </div>
      )}
      
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent 
          className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-0"
          onPointerDownOutside={onClose}
          aria-label="Image viewer"
        >
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 h-11 w-11"
              aria-label="Close image viewer"
            >
              <X className="h-5 w-5" />
            </Button>

            {/* Controls */}
            <div className="absolute top-4 left-4 z-50 flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                disabled={scale >= 3}
                className="text-white hover:bg-white/20 h-11 w-11"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                disabled={scale <= 0.5}
                className="text-white hover:bg-white/20 h-11 w-11"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRotate}
                className="text-white hover:bg-white/20 h-11 w-11"
                aria-label="Rotate image"
              >
                <RotateCw className="h-5 w-5" />
              </Button>
              {scale !== 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleReset}
                  className="text-white hover:bg-white/20 h-11 w-11"
                  aria-label="Reset zoom and rotation"
                >
                  Reset
                </Button>
              )}
            </div>

            {/* Image */}
            <div
              className="flex items-center justify-center w-full h-full cursor-move"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
            >
              <img
                ref={imageRef}
                src={src}
                alt={alt}
                className={cn(
                  "max-w-full max-h-full object-contain transition-transform duration-200 select-none",
                  isDragging && "cursor-grabbing"
                )}
                style={{
                  transform: `scale(${scale}) rotate(${rotation}deg) translate(${position.x / scale}px, ${position.y / scale}px)`,
                  transformOrigin: 'center center',
                }}
                draggable={false}
              />
            </div>

            {/* Zoom indicator */}
            {scale !== 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm">
                {Math.round(scale * 100)}%
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Hook for programmatic control
export const useImageLightbox = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [currentImage, setCurrentImage] = React.useState<{ src: string; alt: string } | null>(null);

  const open = (src: string, alt: string) => {
    setCurrentImage({ src, alt });
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    // Clear image after animation
    setTimeout(() => setCurrentImage(null), 200);
  };

  return {
    isOpen,
    currentImage,
    open,
    close,
  };
};
