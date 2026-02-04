import { useState, useEffect } from "react";
import { imageCache } from "@/services/imageCache";

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  enableCache?: boolean;
}

export const OptimizedImage = ({
  src,
  alt,
  fallbackSrc = "/placeholder.svg",
  enableCache = true,
  ...rest
}: OptimizedImageProps) => {
  const [imgSrc, setImgSrc] = useState(src);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!src || !enableCache) {
      setImgSrc(src);
      setLoading(false);
      return;
    }

    // Try to get from cache first
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
  }, [src, enableCache]);

  return (
    <img
      src={imgSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setImgSrc(fallbackSrc)}
      style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}
      {...rest}
    />
  );
};
