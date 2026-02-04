import { useState, useCallback } from 'react';
import { Camera, CameraResultType } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { createWorker } from 'tesseract.js';
import { useHapticFeedback } from './useHapticFeedback';
import { toast } from 'sonner';
import { preprocessImageForOCR, parseBookCoverText, type ExtractedBookInfo } from '@/utils/ocrHelpers';

interface UseCoverScannerReturn {
  isScanning: boolean;
  scannedInfo: ExtractedBookInfo | null;
  error: string | null;
  progress: number;
  startScan: () => Promise<ExtractedBookInfo | null>;
  stopScan: () => void;
  resetScan: () => void;
}

export const useCoverScanner = (): UseCoverScannerReturn => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedInfo, setScannedInfo] = useState<ExtractedBookInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const { triggerHaptic } = useHapticFeedback();

  const startScan = useCallback(async (): Promise<ExtractedBookInfo | null> => {
    setIsScanning(true);
    setError(null);
    setScannedInfo(null);
    setProgress(0);

    try {
      // Step 1: Capture photo (10%)
      setProgress(10);
      
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: Capacitor.isNativePlatform() ? 'camera' : 'photos',
      });

      if (!image.dataUrl) {
        throw new Error('No image data received');
      }

      // Step 2: Preprocess image (30%)
      setProgress(30);
      const preprocessedImage = await preprocessImageForOCR(image.dataUrl);

      // Step 3: Initialize Tesseract worker (40%)
      setProgress(40);
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          // Track OCR progress
          if (m.status === 'recognizing text') {
            const ocrProgress = 40 + (m.progress * 50); // 40-90%
            setProgress(Math.round(ocrProgress));
          }
        },
      });

      // Step 4: Perform OCR
      const { data } = await worker.recognize(preprocessedImage);
      
      // Step 5: Parse extracted text (95%)
      setProgress(95);
      const extractedText = data.text;
      const bookInfo = parseBookCoverText(extractedText);

      // Cleanup worker
      await worker.terminate();

      // Step 6: Complete (100%)
      setProgress(100);

      if (!bookInfo.title) {
        throw new Error('Could not extract book information from cover');
      }

      // Show warning if confidence is low
      if (bookInfo.confidence < 50) {
        toast.warning(`Low confidence (${bookInfo.confidence}%). Please verify the extracted information.`);
      }

      setScannedInfo(bookInfo);
      triggerHaptic('success');
      setIsScanning(false);
      
      return bookInfo;
    } catch (err: any) {
      console.error('Cover scan error:', err);
      setError(err.message || 'Failed to scan book cover');
      setIsScanning(false);
      setProgress(0);
      triggerHaptic('error');
      
      // Provide user-friendly error messages
      if (err.message?.includes('permission')) {
        toast.error('Camera permission denied. Please enable camera access in settings.');
      } else if (err.message?.includes('extract book information')) {
        toast.error('Could not read text from cover. Try again with better lighting or enter manually.');
      } else if (err.message?.includes('No image data')) {
        toast.error('No image captured. Please try again.');
      } else {
        toast.error('Failed to scan cover. Please try again or enter manually.');
      }
      
      return null;
    }
  }, [triggerHaptic]);

  const stopScan = useCallback(() => {
    setIsScanning(false);
    setError(null);
    setProgress(0);
  }, []);

  const resetScan = useCallback(() => {
    setIsScanning(false);
    setScannedInfo(null);
    setError(null);
    setProgress(0);
  }, []);

  return {
    isScanning,
    scannedInfo,
    error,
    progress,
    startScan,
    stopScan,
    resetScan,
  };
};
