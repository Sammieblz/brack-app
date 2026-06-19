import { useState, useCallback, useEffect, useRef, type RefObject } from 'react';
import { Capacitor } from '@capacitor/core';
import { useHapticFeedback } from './useHapticFeedback';
import { toast } from 'sonner';
import { extractIsbnFromScan } from '@/utils/isbn';
import { trackCoreEvent } from '@/services/telemetry';

interface UseBarcodeScannerOptions {
  videoRef?: RefObject<HTMLVideoElement>;
}

interface UseBarcodeScannerReturn {
  isScanning: boolean;
  scannedCode: string | null;
  error: string | null;
  startScan: () => Promise<string | null>;
  stopScan: () => void;
  resetScan: () => void;
}

type VideoInputDevice = { deviceId: string; label?: string };

type WebCodeReader = {
  reset: () => void;
  listVideoInputDevices: () => Promise<VideoInputDevice[]>;
  decodeFromVideoDevice: (
    deviceId: string | null | undefined,
    videoElement: HTMLVideoElement,
    callback: (result: { getText: () => string } | undefined, error: unknown) => void
  ) => Promise<void>;
};

const getPreferredDeviceId = (devices: VideoInputDevice[]) => {
  const rearCamera = devices.find((device) =>
    /back|rear|environment|world/i.test(device.label ?? "")
  );
  return rearCamera?.deviceId ?? devices[0]?.deviceId ?? null;
};

const preparePreviewVideo = (videoElement: HTMLVideoElement) => {
  videoElement.muted = true;
  videoElement.autoplay = true;
  videoElement.playsInline = true;
  videoElement.setAttribute("muted", "true");
  videoElement.setAttribute("autoplay", "true");
  videoElement.setAttribute("playsinline", "true");
};

export const useBarcodeScanner = (
  options: UseBarcodeScannerOptions = {}
): UseBarcodeScannerReturn => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { triggerHaptic } = useHapticFeedback();
  const codeReaderRef = useRef<WebCodeReader | null>(null);
  const timeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const resolveRef = useRef<((value: string | null) => void) | null>(null);

  const cleanupWebScanner = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    codeReaderRef.current?.reset();
    codeReaderRef.current = null;

    const videoElement = options.videoRef?.current;
    if (videoElement) {
      const stream = videoElement.srcObject;
      if (stream instanceof MediaStream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      videoElement.pause();
      videoElement.srcObject = null;
      videoElement.removeAttribute("src");
      videoElement.load();
    }
  }, [options.videoRef]);

  const finishWebScan = useCallback(
    (value: string | null) => {
      const resolve = resolveRef.current;
      resolveRef.current = null;
      cleanupWebScanner();
      setIsScanning(false);
      resolve?.(value);
    },
    [cleanupWebScanner]
  );

  const startScan = useCallback(async (): Promise<string | null> => {
    cleanupWebScanner();
    setIsScanning(true);
    setError(null);
    setScannedCode(null);

    try {
      // Check if we're on a native platform
      if (Capacitor.isNativePlatform()) {
        const {
          CapacitorBarcodeScanner,
          CapacitorBarcodeScannerAndroidScanningLibrary,
          CapacitorBarcodeScannerCameraDirection,
          CapacitorBarcodeScannerScanOrientation,
          CapacitorBarcodeScannerTypeHint,
        } = await import("@capacitor/barcode-scanner");
        const result = await CapacitorBarcodeScanner.scanBarcode({
          hint: CapacitorBarcodeScannerTypeHint.ALL,
          scanInstructions: "Align the ISBN barcode or book QR code inside the frame",
          scanButton: false,
          cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
          scanOrientation: CapacitorBarcodeScannerScanOrientation.ADAPTIVE,
          android: {
            scanningLibrary: CapacitorBarcodeScannerAndroidScanningLibrary.MLKIT,
          },
          web: {
            showCameraSelection: false,
            scannerFPS: 15,
          },
        });

        const isbn = extractIsbnFromScan(result.ScanResult);
        if (!isbn) throw new Error('Scanned code does not contain a valid ISBN');
        setScannedCode(isbn);
        trackCoreEvent("barcode_scan_succeeded", { scanner: "native" });
        triggerHaptic('success');
        setIsScanning(false);
        return isbn;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is not available in this browser");
      }

      if (!window.isSecureContext && window.location.hostname !== "localhost") {
        throw new Error("Camera scanning requires HTTPS or localhost");
      }

      const videoElement = options.videoRef?.current ?? document.createElement("video");
      preparePreviewVideo(videoElement);

      return await new Promise<string | null>((resolve, reject) => {
        resolveRef.current = resolve;

        void (async () => {
          try {
            const { BrowserMultiFormatReader, NotFoundException } = await import("@zxing/library");
            const codeReader = new BrowserMultiFormatReader() as WebCodeReader;
            codeReaderRef.current = codeReader;
            const devices = await codeReader.listVideoInputDevices().catch(() => []);
            const preferredDeviceId = getPreferredDeviceId(devices);

            timeoutRef.current = window.setTimeout(() => {
              setError("Scan timeout. Please try again with the barcode centered in the frame.");
              finishWebScan(null);
            }, 45_000);

            await codeReader.decodeFromVideoDevice(
              preferredDeviceId,
              videoElement,
              (result, scanError) => {
                if (result) {
                  const isbn = extractIsbnFromScan(result.getText());
                  if (isbn) {
                    setScannedCode(isbn);
                    trackCoreEvent("barcode_scan_succeeded", {
                      scanner: "web",
                      device: preferredDeviceId ? "selected" : "default",
                    });
                    triggerHaptic('success');
                    finishWebScan(isbn);
                    return;
                  }

                  setError("Scanned code does not contain a valid ISBN");
                  triggerHaptic("error");
                  trackCoreEvent("barcode_scan_failed", {
                    scanner: "web",
                    reason: "invalid_isbn_payload",
                  });
                  finishWebScan(null);
                }

                if (scanError && !(scanError instanceof NotFoundException)) {
                  const scanMessage =
                    scanError instanceof Error ? scanError.message : "Camera scan failed";
                  console.error("Scan error:", scanError);
                  setError(scanMessage);
                  finishWebScan(null);
                }
              }
            );
          } catch (err) {
            resolveRef.current = null;
            cleanupWebScanner();
            reject(err);
          }
        })();
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Failed to scan barcode');
      console.error('Barcode scan error:', err);
      cleanupWebScanner();
      setError(error.message);
      setIsScanning(false);
      triggerHaptic('error');
      trackCoreEvent("barcode_scan_failed", {
        scanner: Capacitor.isNativePlatform() ? "native" : "web",
        reason: error.message.slice(0, 120),
      });
      
      // Provide user-friendly error messages
      if (error.message.toLowerCase().includes('permission')) {
        toast.error('Camera permission denied. Please enable camera access in settings.');
      } else if (error.message.includes('No barcode found')) {
        toast.error('No barcode detected. Please try again with better lighting.');
      } else {
        toast.error('Failed to scan barcode. Please try again or enter manually.');
      }
      
      return null;
    }
  }, [cleanupWebScanner, finishWebScan, options.videoRef, triggerHaptic]);

  const stopScan = useCallback(() => {
    finishWebScan(null);
    setError(null);
  }, [finishWebScan]);

  const resetScan = useCallback(() => {
    cleanupWebScanner();
    setIsScanning(false);
    setScannedCode(null);
    setError(null);
  }, [cleanupWebScanner]);

  useEffect(() => cleanupWebScanner, [cleanupWebScanner]);

  return {
    isScanning,
    scannedCode,
    error,
    startScan,
    stopScan,
    resetScan,
  };
};
