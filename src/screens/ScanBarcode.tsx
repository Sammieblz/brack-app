import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, X, CheckCircle } from "lucide-react";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

const ScanBarcode = () => {
  const navigate = useNavigate();
  const { isScanning, scannedCode, error, startScan, stopScan, resetScan } = useBarcodeScanner();
  const { triggerHaptic } = useHapticFeedback();

  useEffect(() => {
    if (scannedCode) {
      // Validate ISBN format (ISBN-10 or ISBN-13)
      const isbn = scannedCode.replace(/[^0-9X]/g, '');
      if (isbn.length === 10 || isbn.length === 13) {
        triggerHaptic('success');
        toast.success(`ISBN scanned: ${isbn}`);
        // Navigate to add book with ISBN pre-filled
        navigate(`/add-book?isbn=${isbn}`);
      } else {
        toast.error('Invalid ISBN format. Please try again.');
        resetScan();
      }
    }
  }, [scannedCode, navigate, resetScan, triggerHaptic]);

  const handleStartScan = async () => {
    triggerHaptic('light');
    const code = await startScan();
    if (code) {
      // Navigation handled in useEffect
    }
  };

  const handleCancelScan = () => {
    stopScan();
    triggerHaptic('light');
  };

  const handleManualEntry = () => {
    navigate("/add-book");
    triggerHaptic('light');
  };

  const isMobile = useIsMobile();

  return (
    <MobileLayout>
      {isMobile && <MobileHeader title="Scan Barcode" showBack />}
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-md">

        {/* Scanner Card */}
        <Card className="bg-gradient-card shadow-medium border-0 animate-scale-in">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-xl font-bold text-foreground">
              Scan Book ISBN
            </CardTitle>
            <p className="font-sans text-muted-foreground text-sm">
              Point your camera at the book's barcode
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Camera Viewfinder */}
            <div className="relative">
              <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center border-2 border-dashed border-border/50 overflow-hidden">
                {isScanning ? (
                  <div className="text-center w-full h-full flex flex-col items-center justify-center">
                    <div className="animate-pulse">
                      <Camera className="h-16 w-16 text-primary mx-auto mb-4" />
                      <p className="font-sans text-muted-foreground font-medium">Scanning barcode...</p>
                      <p className="font-sans text-xs text-muted-foreground mt-2">Point camera at ISBN barcode</p>
                    </div>
                    {/* Scanning overlay */}
                    <div className="absolute inset-4 border-2 border-primary rounded-lg animate-pulse pointer-events-none"></div>
                  </div>
                ) : scannedCode ? (
                  <div className="text-center">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <p className="font-sans text-green-500 font-medium">Barcode scanned!</p>
                    <p className="font-sans text-xs text-muted-foreground mt-2">{scannedCode}</p>
                  </div>
                ) : error ? (
                  <div className="text-center p-4">
                    <Camera className="h-16 w-16 text-destructive/50 mx-auto mb-4" />
                    <p className="font-sans text-destructive text-sm font-medium">Scan failed</p>
                    <p className="font-sans text-xs text-muted-foreground mt-2">{error}</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Camera className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="font-sans text-muted-foreground">Ready to scan</p>
                    <p className="font-sans text-xs text-muted-foreground mt-2">Tap "Start Scanning" to begin</p>
                  </div>
                )}
              </div>
            </div>

            {/* Control Buttons */}
            <div className="space-y-3">
              {!isScanning && !scannedCode ? (
                <Button
                  onClick={handleStartScan}
                  className="w-full h-12 bg-gradient-primary hover:shadow-glow transition-all duration-300 text-white font-medium"
                  disabled={isScanning}
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Start Scanning
                </Button>
              ) : isScanning ? (
                <Button
                  onClick={handleCancelScan}
                  variant="outline"
                  className="w-full h-12 border-destructive/50 text-destructive hover:bg-destructive/10 transition-all duration-300"
                >
                  <X className="mr-2 h-5 w-5" />
                  Cancel Scanning
                </Button>
              ) : null}

              {scannedCode && (
                <Button
                  onClick={resetScan}
                  variant="outline"
                  className="w-full h-12 border-border/50 hover:shadow-soft transition-all duration-300"
                >
                  Scan Another
                </Button>
              )}

              <Button
                onClick={handleManualEntry}
                variant="outline"
                className="w-full h-12 border-border/50 hover:shadow-soft transition-all duration-300"
              >
                Enter ISBN Manually
              </Button>
            </div>

            {/* Instructions */}
            <div className="text-center font-sans text-sm text-muted-foreground space-y-1 p-4 bg-muted/20 rounded-lg">
              <p className="font-medium">How to scan:</p>
              <p>1. Hold your device steady</p>
              <p>2. Point camera at the barcode</p>
              <p>3. Wait for automatic detection</p>
              <p className="text-xs pt-2 border-t border-border/20 mt-2">
                Note: Camera scanning requires device permission
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
};

export default ScanBarcode;
