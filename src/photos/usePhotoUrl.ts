import { useEffect, useState } from 'react';
import { getPhoto } from './photoDb';

/** Object URL for a stored photo (or its thumbnail), revoked on unmount. */
export function usePhotoUrl(photoId: string | null | undefined, variant: 'thumb' | 'full' = 'full'): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photoId) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    void getPhoto(photoId).then((photo) => {
      if (cancelled || !photo) return;
      const blob = variant === 'thumb' ? (photo.thumb ?? photo.blob) : photo.blob;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [photoId, variant]);

  return url;
}
