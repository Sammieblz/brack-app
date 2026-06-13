import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { AppIcon } from "@/components/ui/app-icon";
import { APP_ICONS } from "@/config/iconography";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";

export const EmptyBooks = () => {
  const navigate = useNavigate();

  return (
    <PremiumEmptyState
      asset="emptyLibrary"
      title="No books yet"
      description="Start building your reading library by adding your first book."
      action={
        <Button onClick={() => navigate("/add-book")} className="min-h-[44px]">
          <AppIcon icon={APP_ICONS.common.add} variant="action" className="mr-2" />
          Add Your First Book
        </Button>
      }
    />
  );
};
