import React, { useState, useEffect } from 'react';
import { getImageUrl, FALLBACK_IMAGE } from '../utils/imageUrl';

/**
 * Reusable ComplaintImage component with:
 * - Robust URL normalization across Cloudinary and local storage
 * - Automatic fallback for missing/broken files
 * - Safe error handling preventing UI crashes
 */
export default function ComplaintImage({
  src,
  alt = 'Complaint Evidence',
  folder = 'reports',
  fallbackSrc = FALLBACK_IMAGE,
  style = {},
  className = '',
  loading = 'lazy',
  onClick = null,
  ...restProps
}) {
  const [currentSrc, setCurrentSrc] = useState(() => getImageUrl(src, folder));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setCurrentSrc(getImageUrl(src, folder));
    setHasError(false);
  }, [src, folder]);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setCurrentSrc(fallbackSrc);
    }
  };

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      style={{
        ...style,
        backgroundColor: hasError ? '#f1f5f9' : (style.backgroundColor || 'transparent'),
      }}
      loading={loading}
      onError={handleError}
      onClick={onClick}
      {...restProps}
    />
  );
}
