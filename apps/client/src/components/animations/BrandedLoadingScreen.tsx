import {
  BrackLoader,
} from "@/components/animations/LogoSpinner";
import { BRACK_LOADER_TIMING } from "@/components/animations/brackLoaderTokens";

interface BrandedLoadingScreenProps {
  active?: boolean;
  appearanceDelayMs?: number;
  progress?: number;
  message?: string;
}

export const BrandedLoadingScreen = ({
  active = true,
  appearanceDelayMs = BRACK_LOADER_TIMING.appearanceDelayMs,
  progress,
  message = "Loading your reading journey...",
}: BrandedLoadingScreenProps) => (
  <BrackLoader
    active={active}
    variant="fullscreen"
    size="lg"
    label={message}
    progress={progress}
    delayMs={appearanceDelayMs}
  />
);
