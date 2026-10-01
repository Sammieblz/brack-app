import { useEffect, useRef, useState } from 'react';
import type { ImagePickerOptions, PickedImage } from '../../../apps/client/src/hooks/useImagePicker';
import { FIXTURE_IMAGE_BASE64, FIXTURE_IMAGE_URL, requestCapture } from './api';

// The real ImagePickerDialog remains mounted; only the OS/file selection
// boundary is controlled. This does not exercise camera permissions or files.
export function useImagePicker() {
  const [picking, setPicking] = useState(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const pickImage = async (options: ImagePickerOptions = {}): Promise<PickedImage | null> => {
    setPicking(true);
    try {
      const outcome = await requestCapture('picker', { source: options.source ?? 'prompt' });
      if (!mounted.current || outcome === 'cancel' || outcome === 'commit-reject') return null;
      return { dataUrl: FIXTURE_IMAGE_URL, base64: FIXTURE_IMAGE_BASE64, format: 'png' };
    } catch {
      return null;
    } finally {
      if (mounted.current) setPicking(false);
    }
  };
  return { picking, pickImage,
    pickFromCamera: () => pickImage({ source: 'camera' }),
    pickFromPhotos: () => pickImage({ source: 'photos' }),
    pickWithPrompt: () => pickImage({ source: 'prompt' }),
  };
}
