import { useState, useCallback } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { Camera, CameraResultType } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { useHapticFeedback } from './useHapticFeedback';
import { toast } from 'sonner';

// Helper to validate ISBN format
const isValidISBN = (code: string): boolean => {
  const cleaned = code.replace(/[^0-9X]/g, '');
  return cleaned.length === 10 || cleaned.length === 13;
};

interface UseBarcodeScannerReturn {
  isScanning: boolean;
  scannedCode: string | null;
  error: string | null;
  startScan: () => Promise<string | null>;
  stopScan: () => void;
  resetScan: () => void;
}

export const useBarcodeScanner = (): UseBarcodeScannerReturn => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { triggerHaptic } = useHapticFeedback();

  const startScan = useCallback(async (): Promise<string | null> => {
    setIsScanning(true);
    setError(null);
    setScannedCode(null);

    try {
      // Check if we're on a native platform
      if (Capacitor.isNativePlatform()) {
        // Use Capacitor Camera to take a photo
        const image = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: 'camera',
        });

        if (!image.dataUrl) {
          throw new Error('No image data received');
        }

        // Use ZXing to decode the barcode from the image
        const codeReader = new BrowserMultiFormatReader();
        const result = await codeReader.decodeFromImageUrl(image.dataUrl);

        if (result && result.getText()) {
          const code = result.getText();
          // Validate ISBN format
          if (isValidISBN(code)) {
            setScannedCode(code);
            triggerHaptic('success');
            setIsScanning(false);
            return code;
          } else {
            throw new Error('Scanned code is not a valid ISBN');
          }
        } else {
          throw new Error('No barcode found in image');
        }
      } else {
        // Web fallback: For web, we'll use the camera API directly
        // Note: This requires HTTPS or localhost
        const codeReader = new BrowserMultiFormatReader();
        
        try {
          // Try to get video stream
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          
          // Create video element
          const video = document.createElement('video');
          video.srcObject = stream;
          video.setAttribute('playsinline', 'true');
          video.setAttribute('autoplay', 'true');
          await video.play();
          
          // Decode from video stream
          return new Promise((resolve) => {
            const timeout = setTimeout(() => {
              stream.getTracks().forEach(track => track.stop());
              setError('Scan timeout. Please try again.');
              setIsScanning(false);
              resolve(null);
            }, 30000); // 30 second timeout
            
            codeReader.decodeFromVideoDevice(null, video, (result, error) => {
              if (result) {
                clearTimeout(timeout);
                const code = result.getText();
                if (isValidISBN(code)) {
                  stream.getTracks().forEach(track => track.stop());
                  setScannedCode(code);
                  triggerHaptic('success');
                  codeReader.reset();
                  setIsScanning(false);
                  resolve(code);
                } else {
                  setError('Scanned code is not a valid ISBN');
                  setIsScanning(false);
                  resolve(null);
                }
              }
              if (error && !(error instanceof NotFoundException)) {
                clearTimeout(timeout);
                console.error('Scan error:', error);
                stream.getTracks().forEach(track => track.stop());
                setError(error.message);
                setIsScanning(false);
                resolve(null);
              }
            });
          });
        } catch (err: any) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            throw new Error('Camera permission denied');
          }
          throw err;
        }
      }
    } catch (err: any) {
      console.error('Barcode scan error:', err);
      setError(err.message || 'Failed to scan barcode');
      setIsScanning(false);
      triggerHaptic('error');
      
      // Provide user-friendly error messages
      if (err.message?.includes('permission')) {
        toast.error('Camera permission denied. Please enable camera access in settings.');
      } else if (err.message?.includes('No barcode found')) {
        toast.error('No barcode detected. Please try again with better lighting.');
      } else {
        toast.error('Failed to scan barcode. Please try again or enter manually.');
      }
      
      return null;
    }
  }, [triggerHaptic]);

  const stopScan = useCallback(() => {
    setIsScanning(false);
    setError(null);
  }, []);

  const resetScan = useCallback(() => {
    setIsScanning(false);
    setScannedCode(null);
    setError(null);
  }, []);

  return {
    isScanning,
    scannedCode,
    error,
    startScan,
    stopScan,
    resetScan,
  };
};
