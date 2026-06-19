import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, CheckCircle, Xmark } from "iconoir-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { cn } from "@/lib/utils";
import {
  addScannedBookToLibrary,
  resolveScannedBook,
  ScannedBookNoMatchError,
  ScannerConnectivityError,
  type BarcodeAddState,
  type ScannedBookAddResult,
  type ScannedBookMatch,
} from "@/services/scannerBookFlow";

const formatProvider = (provider?: string | null) => {
  if (!provider) return "Book provider";
  return provider
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
};

interface BarcodeScannerFlowProps {
  className?: string;
  onManualEntry?: (isbn?: string | null) => void;
  onEditDetails?: (match: ScannedBookMatch) => void;
  onViewBook?: (bookId: string) => void;
  onGoToLibrary?: () => void;
}

export const BarcodeScannerFlow = ({
  className,
  onManualEntry,
  onEditDetails,
  onViewBook,
  onGoToLibrary,
}: BarcodeScannerFlowProps) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanCancelledRef = useRef(false);
  const { isScanning, scannedCode, error, startScan, stopScan, resetScan } = useBarcodeScanner({
    videoRef,
  });
  const { triggerHaptic } = useHapticFeedback();
  const [flowState, setFlowState] = useState<BarcodeAddState>("idle");
  const [scannedIsbn, setScannedIsbn] = useState<string | null>(null);
  const [match, setMatch] = useState<ScannedBookMatch | null>(null);
  const [addResult, setAddResult] = useState<ScannedBookAddResult | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);

  const resetFlow = () => {
    setFlowState("idle");
    setScannedIsbn(null);
    setMatch(null);
    setAddResult(null);
    setFlowError(null);
    resetScan();
  };

  const resolveIsbn = async (isbn: string) => {
    setScannedIsbn(isbn);
    setFlowError(null);
    setAddResult(null);
    setFlowState("finding");

    try {
      const resolved = await resolveScannedBook(isbn);
      setMatch(resolved);
      setFlowState("preview");
      toast.success(resolved.cached ? "Book found from cache" : "Book found");
      triggerHaptic("success");
    } catch (lookupError) {
      if (lookupError instanceof ScannerConnectivityError) {
        setFlowState("offline");
        setFlowError(lookupError.message);
        toast.error("Connect to the internet to look up this ISBN");
      } else if (lookupError instanceof ScannedBookNoMatchError) {
        setFlowState("no_match");
        setFlowError(lookupError.message);
        toast.info("No exact book match found");
      } else {
        const message =
          lookupError instanceof Error ? lookupError.message : "Failed to look up this ISBN";
        setFlowState("error");
        setFlowError(message);
        toast.error(message);
      }
      triggerHaptic("error");
    } finally {
      resetScan();
    }
  };

  const handleStartScan = async () => {
    triggerHaptic("light");
    scanCancelledRef.current = false;
    setFlowState("scanning");
    setFlowError(null);
    setMatch(null);
    setAddResult(null);

    const code = await startScan();
    if (code) {
      await resolveIsbn(code);
      return;
    }

    setFlowState(scanCancelledRef.current ? "idle" : "error");
  };

  const handleCancelScan = () => {
    scanCancelledRef.current = true;
    stopScan();
    setFlowState("idle");
    triggerHaptic("light");
  };

  const handleManualEntry = () => {
    if (onManualEntry) {
      onManualEntry(scannedIsbn);
    } else {
      const query = scannedIsbn ? `?isbn=${encodeURIComponent(scannedIsbn)}` : "";
      navigate(`/add-book${query}`);
    }
    triggerHaptic("light");
  };

  const handleEditDetails = () => {
    if (!match) {
      handleManualEntry();
      return;
    }

    if (onEditDetails) {
      onEditDetails(match);
    } else {
      navigate("/add-book", {
        state: {
          scannedBook: match.book,
          scanSource: "barcode",
          cached: Boolean(match.cached),
        },
      });
    }
    triggerHaptic("light");
  };

  const handleAddToLibrary = async () => {
    if (!match) return;

    setFlowState("adding");
    setFlowError(null);

    try {
      const result = await addScannedBookToLibrary(match);
      setAddResult(result);

      if (result.status === "duplicate") {
        setFlowState("duplicate");
        toast.info("Already in your library");
      } else {
        setFlowState("success");
        toast.success(result.status === "restored" ? "Book restored" : "Book added to library");
      }

      triggerHaptic("success");
    } catch (addError) {
      if (addError instanceof ScannerConnectivityError) {
        setFlowState("offline");
        setFlowError(addError.message);
        toast.error("Reconnect before adding this book");
      } else {
        const message = addError instanceof Error ? addError.message : "Failed to add this book";
        setFlowState("error");
        setFlowError(message);
        toast.error(message);
      }
      triggerHaptic("error");
    }
  };

  const handleRetryLookup = () => {
    if (scannedIsbn) {
      void resolveIsbn(scannedIsbn);
      return;
    }
    void handleStartScan();
  };

  const resultBookId = addResult?.book?.id ?? addResult?.bookId;
  const resultTitle = addResult?.book?.title ?? match?.book.title ?? "this book";
  const busy = isScanning || flowState === "finding" || flowState === "adding";

  const renderBookPreview = () => {
    if (!match) return null;
    const book = match.book;

    return (
      <div className="rounded-lg border border-border/70 bg-card/70 p-4">
        <div className="flex gap-4">
          <div className="h-36 w-24 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted">
            {book.cover_url ? (
              <img
                src={book.cover_url}
                alt={`Cover of ${book.title}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-3 text-center text-xs text-muted-foreground">
                No cover
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">
              Exact ISBN match
            </p>
            <div>
              <h2 className="font-display text-xl font-bold leading-tight text-foreground">
                {book.title}
              </h2>
              <p className="font-serif text-muted-foreground">by {book.author || "Unknown author"}</p>
            </div>
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <span>ISBN {match.isbn}</span>
              <span>{book.pages ? `${book.pages} pages` : "Pages unknown"}</span>
              <span>{book.genre || "Genre unknown"}</span>
              <span>{formatProvider(match.provider ?? book.source_provider)}</span>
            </div>
            {book.description && (
              <p className="line-clamp-3 font-serif text-sm text-muted-foreground">
                {book.description}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderStatusPanel = () => {
    if (flowState === "finding" || flowState === "adding") {
      return (
        <div className="flex aspect-square flex-col items-center justify-center rounded-lg border border-dashed border-primary/40 bg-primary/5 p-6 text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          <p className="font-sans font-medium text-foreground">
            {flowState === "finding" ? "Finding book..." : "Adding to library..."}
          </p>
          <p className="mt-2 font-sans text-xs text-muted-foreground">
            {flowState === "finding"
              ? "Checking book providers for an exact ISBN match."
              : "Saving this book as To Read."}
          </p>
        </div>
      );
    }

    if (flowState === "preview") {
      return renderBookPreview();
    }

    if (flowState === "success") {
      return (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-6 text-center">
          <CheckCircle className="mx-auto mb-4 h-14 w-14 text-primary" />
          <h2 className="font-display text-2xl font-bold text-foreground">Added to Library</h2>
          <p className="mt-2 font-sans text-muted-foreground">
            {resultTitle} is ready in your To Read shelf.
          </p>
        </div>
      );
    }

    if (flowState === "duplicate") {
      return (
        <div className="rounded-lg border border-border/70 bg-card p-6 text-center">
          <CheckCircle className="mx-auto mb-4 h-14 w-14 text-primary" />
          <h2 className="font-display text-2xl font-bold text-foreground">
            Already in your library
          </h2>
          <p className="mt-2 font-sans text-muted-foreground">
            {resultTitle} was not added again.
          </p>
        </div>
      );
    }

    if (flowState === "no_match" || flowState === "offline" || flowState === "error") {
      const title =
        flowState === "offline"
          ? "Reconnect to find this book"
          : flowState === "no_match"
            ? "No exact book match"
            : "Scan lookup failed";

      return (
        <div className="rounded-lg border border-border/70 bg-card p-6 text-center">
          <Camera className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
          <h2 className="font-display text-2xl font-bold text-foreground">{title}</h2>
          <p className="mt-2 font-sans text-sm text-muted-foreground">
            {flowError ||
              "Try again, scan another barcode, or enter the book details manually."}
          </p>
          {scannedIsbn && (
            <p className="mt-3 rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
              {scannedIsbn}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="relative">
        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-muted/50">
          <video
            ref={videoRef}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
              isScanning ? "opacity-100" : "opacity-0"
            )}
            muted
            playsInline
            autoPlay
            aria-label="Live camera barcode scanner preview"
          />
          {isScanning ? (
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/35" />
              <div className="absolute left-1/2 top-1/2 h-[42%] w-[76%] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.16)]">
                <div className="absolute -left-1 -top-1 h-9 w-9 rounded-tl-xl border-l-4 border-t-4 border-primary" />
                <div className="absolute -right-1 -top-1 h-9 w-9 rounded-tr-xl border-r-4 border-t-4 border-primary" />
                <div className="absolute -bottom-1 -left-1 h-9 w-9 rounded-bl-xl border-b-4 border-l-4 border-primary" />
                <div className="absolute -bottom-1 -right-1 h-9 w-9 rounded-br-xl border-b-4 border-r-4 border-primary" />
                <div className="absolute left-4 right-4 top-1/2 h-px -translate-y-1/2 animate-pulse bg-primary shadow-[0_0_16px_hsl(var(--primary))]" />
              </div>
              <div className="absolute inset-x-4 bottom-4 rounded-full border border-white/20 bg-black/55 px-4 py-2 text-center text-white backdrop-blur-sm">
                <p className="text-sm font-medium">Scanning barcode...</p>
                <p className="text-xs text-white/75">Center the ISBN barcode inside the frame</p>
              </div>
            </div>
          ) : error ? (
            <div className="relative z-10 p-4 text-center">
              <Camera className="mx-auto mb-4 h-16 w-16 text-destructive/50" />
              <p className="font-sans text-sm font-medium text-destructive">Scan failed</p>
              <p className="mt-2 font-sans text-xs text-muted-foreground">{error}</p>
            </div>
          ) : (
            <div className="relative z-10 text-center">
              <Camera className="mx-auto mb-4 h-16 w-16 text-muted-foreground/50" />
              <p className="font-sans text-muted-foreground">Ready to scan</p>
              <p className="mt-2 font-sans text-xs text-muted-foreground">
                Scan an ISBN and Brack will find the book for you
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderActions = () => {
    if (flowState === "preview") {
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Button onClick={handleAddToLibrary} className="h-12 sm:col-span-2" disabled={busy}>
            Add to Library
          </Button>
          <Button onClick={handleEditDetails} variant="outline" className="h-12">
            Edit details
          </Button>
          <Button onClick={resetFlow} variant="outline" className="h-12">
            Scan another
          </Button>
        </div>
      );
    }

    if (flowState === "success" || flowState === "duplicate") {
      return (
        <div className="grid gap-3 sm:grid-cols-3">
          <Button
            onClick={() => {
              if (!resultBookId) return;
              if (onViewBook) onViewBook(resultBookId);
              else navigate(`/book/${resultBookId}`);
            }}
            className="h-12"
            disabled={!resultBookId}
          >
            View Book
          </Button>
          <Button
            onClick={() => {
              if (onGoToLibrary) onGoToLibrary();
              else navigate("/my-books");
            }}
            variant="outline"
            className="h-12"
          >
            Go to Library
          </Button>
          <Button onClick={resetFlow} variant="outline" className="h-12">
            Scan Another
          </Button>
        </div>
      );
    }

    if (flowState === "no_match" || flowState === "offline" || flowState === "error") {
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Button onClick={handleRetryLookup} className="h-12" disabled={busy}>
            {flowState === "offline" ? "Retry when online" : "Retry lookup"}
          </Button>
          <Button onClick={handleManualEntry} variant="outline" className="h-12">
            Enter details
          </Button>
          <Button onClick={resetFlow} variant="outline" className="h-12 sm:col-span-2">
            Scan another
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {!isScanning ? (
          <Button onClick={handleStartScan} className="h-12 w-full" disabled={busy}>
            <Camera className="mr-2 h-5 w-5" />
            Start Scanning
          </Button>
        ) : (
          <Button
            onClick={handleCancelScan}
            variant="outline"
            className="h-12 w-full border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            <Xmark className="mr-2 h-5 w-5" />
            Cancel Scanning
          </Button>
        )}

        <Button onClick={handleManualEntry} variant="outline" className="h-12 w-full">
          Enter ISBN Manually
        </Button>
      </div>
    );
  };

  return (
    <div className={cn("space-y-6", className)}>
      {renderStatusPanel()}
      {renderActions()}

      <div className="rounded-lg bg-muted/20 p-4 font-sans text-sm text-muted-foreground">
        <div className="mx-auto max-w-2xl space-y-2 text-left sm:text-center">
          <p className="font-medium text-foreground">How scanning works</p>
          <p className="leading-relaxed">
            Brack reads the ISBN, finds an exact book match, then asks you to confirm.
          </p>
        </div>
        <p className="mx-auto mt-3 max-w-2xl border-t border-border/20 pt-3 text-left text-xs leading-relaxed sm:text-center">
          Internet is required for lookup and adding. Use manual entry if metadata is missing.
        </p>
        {scannedCode && (
          <p className="mx-auto max-w-2xl pt-2 text-left font-mono text-xs text-muted-foreground sm:text-center">
            {scannedCode}
          </p>
        )}
      </div>
    </div>
  );
};
