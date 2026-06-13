import { useState, useEffect } from "react";
import { imageCache } from "@/services/imageCache";
import { cn } from "@/lib/utils";

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  enableCache?: boolean;
  blurPlaceholder?: boolean;
  showErrorState?: boolean;
}

export const OptimizedImage = ({
  src,
  alt,
  fallbackSrc = "/placeholder.svg",
  enableCache = true,
  blurPlaceholder = true,
  showErrorState = true,
  className,
  ...rest
}: OptimizedImageProps) => {
  const [imgSrc, setImgSrc] = useState(src);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) {
      setImgSrc(fallbackSrc);
      setLoading(false);
      return;
    }

    setError(false);
    setLoading(true);

    // Skip caching for external APIs (Google Books, etc.) that have CORS restrictions
    // These images should be loaded directly by the browser
    const isExternalAPI = src.includes('books.google.com') || 
                         src.includes('googleapis.com') ||
                         src.startsWith('http://') ||
                         (!src.startsWith('/') && !src.startsWith('data:'));
    
    if (!enableCache || isExternalAPI) {
      // For external APIs, use the img tag directly (browser handles CORS)
      setImgSrc(src);
      setLoading(false);
      return;
    }

    // Try to get from cache first (only for same-origin images)
    imageCache.getCachedImage(src).then((cached) => {
      if (cached) {
        setImgSrc(cached);
        setLoading(false);
      } else {
        // Not in cache, fetch and cache it
        fetch(src)
          .then((response) => {
            if (!response.ok) throw new Error('Failed to fetch image');
            return response.blob();
          })
          .then((blob) => {
            // Cache the image
            imageCache.cacheImage(src, blob).then((cachedUrl) => {
              setImgSrc(cachedUrl);
              setLoading(false);
            });
          })
          .catch(() => {
            // If fetch fails, use original src
            setImgSrc(src);
            setLoading(false);
          });
      }
    });
  }, [src, enableCache, fallbackSrc]);

  const handleError = () => {
    setError(true);
    setLoading(false);
    if (fallbackSrc && imgSrc !== fallbackSrc) {
      setImgSrc(fallbackSrc);
    }
  };

  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Blur placeholder */}
      {blurPlaceholder && loading && !error && (
        <div 
          className="absolute inset-0 bg-muted animate-pulse"
          style={{
            backgroundImage: imgSrc ? `url(${imgSrc})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(20px)',
            transform: 'scale(1.1)', // Prevent blur edge artifacts
          }}
          aria-hidden="true"
        />
      )}
      
      {/* Main image */}
      <img
        src={imgSrc}
        alt={alt || ''}
        loading="lazy"
        decoding="async"
        onError={handleError}
        onLoad={handleLoad}
        className={cn(
          "transition-opacity duration-300",
          loading && !error ? "opacity-0" : "opacity-100",
          error && showErrorState && "opacity-50"
        )}
        {...rest}
      />
      
      {/* Error state overlay */}
      {error && showErrorState && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-muted/50"
          aria-label="Image failed to load"
        >
          <svg 
            className="h-8 w-8 text-muted-foreground" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
            aria-hidden="true"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
            />
          </svg>
        </div>
      )}
    </div>
  );
};
