import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Xmark, CheckCircle, EditPencil, Sparks } from "iconoir-react";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { useCoverScanner } from "@/hooks/useCoverScanner";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { buildSearchQuery } from "@/utils/ocrHelpers";
import { Progress } from "@/components/ui/progress";

const ScanCover = () => {
  const navigate = useNavigate();
  const { isScanning, scannedInfo, error, progress, startScan, stopScan, resetScan } = useCoverScanner();
  const { triggerHaptic } = useHapticFeedback();
  const [editMode, setEditMode] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedAuthor, setEditedAuthor] = useState("");

  useEffect(() => {
    if (scannedInfo) {
      setEditedTitle(scannedInfo.title);
      setEditedAuthor(scannedInfo.author || "");
    }
  }, [scannedInfo]);

  const handleStartScan = async () => {
    triggerHaptic('light');
    setEditMode(false);
    const info = await startScan();
    if (info) {
      // Success handled by useEffect
    }
  };

  const handleCancelScan = () => {
    stopScan();
    triggerHaptic('light');
  };

  const handleSearch = () => {
    if (!editedTitle.trim()) {
      toast.error('Please enter a book title');
      return;
    }

    // Use buildSearchQuery to properly format the search query
    const bookInfo = {
      title: editedTitle.trim(),
      author: editedAuthor.trim() || undefined,
      confidence: scannedInfo?.confidence || 0,
      rawText: scannedInfo?.rawText || '',
    };
    
    const query = buildSearchQuery(bookInfo);
    
    triggerHaptic('light');
    navigate(`/add-book?search=${encodeURIComponent(query)}`);
  };

  const handleManualEntry = () => {
    navigate("/add-book");
    triggerHaptic('light');
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return "text-green-500";
    if (confidence >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  const isMobile = useIsMobile();

  return (
    <MobileLayout>
      {isMobile && <MobileHeader title="Scan Cover" showBack />}
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-md">

        {/* Scanner Card */}
        <Card className="bg-gradient-card shadow-medium border-0 animate-scale-in">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-xl font-bold text-foreground">
              Scan Book Cover
            </CardTitle>
            <p className="font-sans text-muted-foreground text-sm">
              Take a photo of the book cover to extract title and author
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Camera Viewfinder / Results */}
            <div className="relative">
              <div className="aspect-[3/4] bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center border-2 border-dashed border-border/50 overflow-hidden">
                {isScanning ? (
                  <div className="text-center w-full h-full flex flex-col items-center justify-center p-6">
                    <div className="w-full">
                      <Sparks className="h-16 w-16 text-primary mx-auto mb-4 animate-pulse" />
                      <p className="font-sans text-muted-foreground font-medium mb-2">
                        {progress < 30 ? 'Capturing image...' :
                         progress < 40 ? 'Preprocessing...' :
                         progress < 90 ? 'Reading text...' :
                         'Processing...'}
                      </p>
                      <Progress value={progress} className="w-full" />
                      <p className="font-sans text-xs text-muted-foreground mt-2">{progress}% complete</p>
                    </div>
                  </div>
                ) : scannedInfo && !editMode ? (
                  <div className="text-center p-6 w-full">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <p className="font-sans text-green-500 font-medium mb-4">Cover scanned!</p>
                    
                    <div className="space-y-3 text-left bg-background/50 p-4 rounded-lg">
                      <div>
                        <p className="font-sans text-xs text-muted-foreground mb-1">Title:</p>
                        <p className="font-serif font-semibold text-foreground">{scannedInfo.title}</p>
                      </div>
                      {scannedInfo.author && (
                        <div>
                          <p className="font-sans text-xs text-muted-foreground mb-1">Author:</p>
                          <p className="font-serif font-medium text-foreground">{scannedInfo.author}</p>
                        </div>
                      )}
                      <div>
                        <p className="font-sans text-xs text-muted-foreground mb-1">Confidence:</p>
                        <p className={`font-sans font-medium ${getConfidenceColor(scannedInfo.confidence)}`}>
                          {scannedInfo.confidence}%
                        </p>
                      </div>
                    </div>
                  </div>
                ) : scannedInfo && editMode ? (
                  <div className="text-center p-6 w-full">
                    <EditPencil className="h-12 w-12 text-primary mx-auto mb-4" />
                    <p className="font-sans text-muted-foreground font-medium mb-4">Edit extracted info</p>
                    
                    <div className="space-y-3 text-left">
                      <div>
                        <Label htmlFor="edit-title" className="text-xs">Title</Label>
                        <Input
                          id="edit-title"
                          value={editedTitle}
                          onChange={(e) => setEditedTitle(e.target.value)}
                          placeholder="Book title"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-author" className="text-xs">Author</Label>
                        <Input
                          id="edit-author"
                          value={editedAuthor}
                          onChange={(e) => setEditedAuthor(e.target.value)}
                          placeholder="Author name"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                ) : error ? (
                  <div className="text-center p-4">
                    <Camera className="h-16 w-16 text-destructive/50 mx-auto mb-4" />
                    <p className="font-sans text-destructive text-sm font-medium">Scan failed</p>
                    <p className="font-sans text-xs text-muted-foreground mt-2">{error}</p>
                  </div>
                ) : (
                  <div className="text-center p-6">
                    <Camera className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="font-sans text-muted-foreground">Ready to scan</p>
                    <p className="font-sans text-xs text-muted-foreground mt-2">Tap "Scan Cover" to begin</p>
                  </div>
                )}
              </div>
            </div>

            {/* Control Buttons */}
            <div className="space-y-3">
              {!isScanning && !scannedInfo ? (
                <Button
                  onClick={handleStartScan}
                  className="w-full h-12 bg-gradient-primary hover:shadow-glow transition-all duration-300 text-white font-medium"
                  disabled={isScanning}
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Scan Cover
                </Button>
              ) : isScanning ? (
                <Button
                  onClick={handleCancelScan}
                  variant="outline"
                  className="w-full h-12 border-destructive/50 text-destructive hover:bg-destructive/10 transition-all duration-300"
                  disabled={progress > 50} // Can't cancel mid-OCR
                >
                  <Xmark className="mr-2 h-5 w-5" />
                  Cancel
                </Button>
              ) : null}

              {scannedInfo && !editMode && (
                <>
                  <Button
                    onClick={handleSearch}
                    className="w-full h-12 bg-gradient-primary hover:shadow-glow transition-all duration-300 text-white font-medium"
                  >
                    Search for this Book
                  </Button>
                  <Button
                    onClick={() => setEditMode(true)}
                    variant="outline"
                    className="w-full h-12 border-border/50 hover:shadow-soft transition-all duration-300"
                  >
                    <EditPencil className="mr-2 h-5 w-5" />
                    Edit Info
                  </Button>
                </>
              )}

              {scannedInfo && editMode && (
                <>
                  <Button
                    onClick={() => {
                      setEditMode(false);
                      handleSearch();
                    }}
                    className="w-full h-12 bg-gradient-primary hover:shadow-glow transition-all duration-300 text-white font-medium"
                  >
                    Search with Edited Info
                  </Button>
                  <Button
                    onClick={() => setEditMode(false)}
                    variant="outline"
                    className="w-full h-12 border-border/50 hover:shadow-soft transition-all duration-300"
                  >
                    Cancel Edit
                  </Button>
                </>
              )}

              {scannedInfo && (
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
                Enter Manually
              </Button>
            </div>

            {/* Instructions */}
            <div className="text-center text-sm text-muted-foreground space-y-1 p-4 bg-muted/20 rounded-lg">
              <p className="font-medium">Tips for best results:</p>
              <p>1. Use good lighting</p>
              <p>2. Hold camera parallel to cover</p>
              <p>3. Ensure entire cover is in frame</p>
              <p>4. Avoid shadows and glare</p>
              <p className="text-xs pt-2 border-t border-border/20 mt-2">
                Note: Works best with clear, bold fonts. You can edit extracted text if needed.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
};

export default ScanCover;
