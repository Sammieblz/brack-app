import { useState } from "react";

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
}

export const OptimizedImage = ({
  src,
  alt,
  fallbackSrc = "/placeholder.svg",
  ...rest
}: OptimizedImageProps) => {
  const [imgSrc, setImgSrc] = useState(src);

  return (
    <img
      src={imgSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setImgSrc(fallbackSrc)}
      {...rest}
    />
  );
};
