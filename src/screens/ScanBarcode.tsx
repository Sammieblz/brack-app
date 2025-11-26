import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Camera, X } from "lucide-react";
import { toast } from "sonner";

const ScanBarcode = () => {
  const [isScanning, setIsScanning] = useState(false);
  const navigate = useNavigate();

  const handleStartScan = () => {
    setIsScanning(true);
    // In a real implementation, you would integrate with a camera/barcode scanning library
    // For now, we'll simulate the scanning process
    toast.info("Camera scanning not implemented yet. Please enter ISBN manually.");
    setTimeout(() => {
      setIsScanning(false);
    }, 2000);
  };

  const handleCancelScan = () => {
    setIsScanning(false);
  };

  const handleManualEntry = () => {
    navigate("/add-book");
  };

  return (
    <div className="min-h-screen bg-gradient-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/add-book")}
            className="border-border/50 hover:shadow-soft transition-all duration-300"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Scanner Card */}
        <Card className="bg-gradient-card shadow-medium border-0 animate-scale-in">
          <CardHeader className="text-center">
            <CardTitle className="text-xl font-bold text-foreground">
              Scan Book ISBN
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              Point your camera at the book's barcode
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Camera Viewfinder Placeholder */}
            <div className="relative">
              <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center border-2 border-dashed border-border/50">
                {isScanning ? (
                  <div className="text-center">
                    <div className="animate-pulse">
                      <Camera className="h-16 w-16 text-primary mx-auto mb-4" />
                      <p className="text-muted-foreground">Scanning...</p>
                    </div>
                    {/* Scanning overlay */}
                    <div className="absolute inset-4 border-2 border-primary rounded-lg animate-pulse"></div>
                  </div>
                ) : (
                  <div className="text-center">
                    <Camera className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">Camera Preview</p>
                  </div>
                )}
              </div>
            </div>

            {/* Control Buttons */}
            <div className="space-y-3">
              {!isScanning ? (
                <Button
                  onClick={handleStartScan}
                  className="w-full h-12 bg-gradient-primary hover:shadow-glow transition-all duration-300 text-white font-medium"
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Start Scanning
                </Button>
              ) : (
                <Button
                  onClick={handleCancelScan}
                  variant="outline"
                  className="w-full h-12 border-destructive/50 text-destructive hover:bg-destructive/10 transition-all duration-300"
                >
                  <X className="mr-2 h-5 w-5" />
                  Stop Scanning
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
            <div className="text-center text-sm text-muted-foreground space-y-1 p-4 bg-muted/20 rounded-lg">
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
    </div>
  );
};

export default ScanBarcode;
