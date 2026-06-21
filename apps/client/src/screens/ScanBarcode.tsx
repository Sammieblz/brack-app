import { useNavigate } from "react-router-dom";
import { AppBackButton } from "@/components/AppBackButton";
import { BarcodeScannerFlow } from "@/components/BarcodeScannerFlow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MobileHeader } from "@/components/MobileHeader";
import { MobileLayout } from "@/components/MobileLayout";
import { useIsMobile } from "@/hooks/use-mobile";

const ScanBarcode = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  return (
    <MobileLayout>
      {isMobile && (
        <MobileHeader
          title="Scan Barcode"
          back={{ label: "Back", ariaLabel: "Go back", fallbackPath: "/add-book" }}
        />
      )}
      <div className="app-page-scan">
        {!isMobile && (
          <AppBackButton
            label="Back"
            ariaLabel="Go back"
            fallbackPath="/add-book"
            showLabel
            variant="outline"
            className="mb-4 border-border/70 bg-card/45 shadow-none hover:bg-accent"
          />
        )}

        <Card className="animate-scale-in">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-xl font-bold text-foreground">
              Scan Book ISBN
            </CardTitle>
            <p className="font-sans text-sm text-muted-foreground">
              Scan a barcode, confirm the match, and add it directly to your library
            </p>
          </CardHeader>
          <CardContent>
            <BarcodeScannerFlow
              onViewBook={(bookId) => navigate(`/book/${bookId}`)}
              onGoToLibrary={() => navigate("/my-books")}
            />
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
};

export default ScanBarcode;
