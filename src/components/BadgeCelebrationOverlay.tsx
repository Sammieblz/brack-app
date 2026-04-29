import { useRef } from "react";
import type { Badge } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getBadgeImagePath } from "@/lib/badgeImages";
import { useGSAP } from "@/hooks/useGSAP";
import { gsap } from "gsap";
import { Confetti } from "@/components/animations/Confetti";
import { useNavigate } from "react-router-dom";

interface BadgeCelebrationOverlayProps {
  badge: Badge;
  open: boolean;
  onClose: () => void;
}

export const BadgeCelebrationOverlay = ({
  badge,
  open,
  onClose,
}: BadgeCelebrationOverlayProps) => {
  const badgeRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const imagePath = getBadgeImagePath(badge);

  useGSAP(() => {
    if (!badgeRef.current || !open) return;

    const tl = gsap.timeline();

    // Pop-in animation
    tl.fromTo(
      badgeRef.current,
      { scale: 0.6, opacity: 0, rotate: -10 },
      { scale: 1, opacity: 1, rotate: 0, duration: 0.6, ease: "back.out(1.7)" }
    );

    // Gentle pulse
    tl.to(badgeRef.current, {
      scale: 1.05,
      duration: 0.3,
      yoyo: true,
      repeat: 1,
      ease: "power1.inOut",
    });
  }, [open]);

  const handleViewAchievements = () => {
    onClose();
    navigate("/achievements");
  };

  return (
    <>
      <Confetti trigger={open} />
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="sm:max-w-md bg-gradient-card text-center">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              New Achievement Unlocked!
            </DialogTitle>
          </DialogHeader>

          <div
            ref={badgeRef}
            className="mt-4 flex flex-col items-center gap-4"
          >
            {imagePath && (
              <img
                src={imagePath}
                alt={badge.title}
                className="h-32 w-32 object-contain drop-shadow-xl"
              />
            )}
            <div className="space-y-1">
              <div className="font-sans text-lg font-semibold">
                {badge.title}
              </div>
              {badge.description && (
                <p className="font-sans text-sm text-muted-foreground max-w-xs mx-auto">
                  {badge.description}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={onClose} className="min-w-[120px]">
              Continue
            </Button>
            <Button
              variant="outline"
              onClick={handleViewAchievements}
              className="min-w-[160px]"
            >
              View Achievements
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

