import { useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AppIcon } from "@/components/ui/app-icon";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import LoadingSpinner from "@/components/LoadingSpinner";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import {
  JourneySectionEyebrow,
  JourneySurface,
} from "@/components/journey/JourneySurface";
import { useGamificationShop } from "@/hooks/useGamification";
import { APP_ICONS } from "@/config/iconography";
import {
  claimPendingShopPurchase,
  clearPendingShopPurchase,
} from "@/lib/shopPurchase";
import {
  GAMIFICATION_SHOP_ITEM_CODES,
  isGamificationFallbackEligible,
  type GamificationShopItem,
} from "@/services/api/gamification";

const createPurchaseIdempotencyKey = () =>
  typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `shop-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const JourneyShop = ({ userId }: { userId: string }) => {
  const shop = useGamificationShop(userId);
  const inMemoryPurchaseKeys = useRef(new Map<string, string>());
  const [purchaseTarget, setPurchaseTarget] = useState<{
    item: GamificationShopItem;
    idempotencyKey: string;
  } | null>(null);

  const handlePurchase = async () => {
    if (!purchaseTarget || !shop.hasCurrentSessionLiveResponse) return;
    const { item, idempotencyKey } = purchaseTarget;

    try {
      const result = await shop.purchaseMutation.mutateAsync({
        itemCode: item.code,
        idempotencyKey,
      });
      clearPendingShopPurchase(userId, item.code, idempotencyKey);
      inMemoryPurchaseKeys.current.delete(item.code);
      setPurchaseTarget(null);
      toast.success(
        result.idempotent
          ? `${item.display_name} was already added`
          : `${item.display_name} added to your inventory`,
      );
    } catch (error) {
      if (isGamificationFallbackEligible(error)) {
        toast.error(
          "Purchase outcome couldn't be confirmed. Reconnect and retry; Brack will reuse the same purchase request.",
        );
        return;
      }

      clearPendingShopPurchase(userId, item.code, idempotencyKey);
      inMemoryPurchaseKeys.current.delete(item.code);
      toast.error("Purchase was not confirmed. Refresh your wallet before trying again.");
    }
  };

  if (shop.isLoading) {
    return (
      <div className="flex min-h-72 items-center justify-center">
        <LoadingSpinner text="Opening the Gold Leaf shop..." />
      </div>
    );
  }

  const retainedRetryableSnapshot = Boolean(
    shop.data && shop.error && isGamificationFallbackEligible(shop.error),
  );

  if (!shop.data || (shop.error && !retainedRetryableSnapshot)) {
    return (
      <PremiumEmptyState
        asset="badConnection"
        title="The Gold Leaf shop is unavailable"
        description="Reconnect and try again. Your balance and inventory remain safe."
        action={<Button className="min-h-11" onClick={() => void shop.refetch()}>Try again</Button>}
        size="compact"
      />
    );
  }

  const { account, items } = shop.data;
  const currentSessionLive = shop.hasCurrentSessionLiveResponse;
  const cached = !currentSessionLive || retainedRetryableSnapshot;

  return (
    <div className="space-y-5">
      {cached && (
        <JourneySurface
          variant="flat"
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          role="status"
        >
          <p className="text-sm text-muted-foreground">
            Saved wallet and inventory shown
            {shop.data.cached_at
              ? ` from ${new Date(shop.data.cached_at).toLocaleString()}`
              : " while offline"}. Purchases require a live connection.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="min-h-11"
            disabled={shop.isFetching}
            onClick={() => void shop.refetch()}
          >
            {shop.isFetching ? "Refreshing..." : "Refresh"}
          </Button>
        </JourneySurface>
      )}
      <JourneySurface variant="hero" className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex min-w-0 max-w-full flex-1 items-center gap-3 sm:gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-primary/[0.18] bg-primary/[0.06]">
              <CurrencyIcon currency="goldLeaves" size="xl" />
            </span>
            <div className="min-w-0 flex-1">
              <JourneySectionEyebrow>Your wallet</JourneySectionEyebrow>
              <h2
                className="truncate font-display text-2xl font-bold tabular-nums sm:text-3xl"
                title={account.gold_leaves.toLocaleString()}
              >
                {account.gold_leaves.toLocaleString()}
              </h2>
              <p className="text-sm text-muted-foreground">
                Gold {account.gold_leaves === 1 ? "Leaf" : "Leaves"} available
              </p>
            </div>
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Spend rare Gold Leaves on reading safeguards. Lifetime Ink and your level are never spent.
          </p>
        </div>
      </JourneySurface>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,21rem),1fr))]">
        {items.length === 0 ? (
          <JourneySurface variant="flat" className="p-8 text-center">
            <p className="font-medium">The shelves are being restocked</p>
            <p className="mt-1 text-sm text-muted-foreground">No shop items are available right now.</p>
          </JourneySurface>
        ) : items.map((item) => {
          const inventoryFull = item.max_inventory > 0 && item.quantity >= item.max_inventory;
          const canAfford = account.gold_leaves >= item.gold_leaves_cost;
          const purchasingThisItem = shop.purchaseMutation.isPending
            && shop.purchaseMutation.variables?.itemCode === item.code;
          const isStreakFreeze = item.code === GAMIFICATION_SHOP_ITEM_CODES.streakFreeze;

          return (
            <JourneySurface key={item.code} variant="interactive" className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-primary/[0.18] bg-primary/[0.07]">
                  {isStreakFreeze ? (
                    <AppIcon icon={APP_ICONS.stats.useFreeze} variant="status" size="lg" />
                  ) : (
                    <CurrencyIcon currency="goldLeaves" size="lg" />
                  )}
                </span>
                <Badge variant="secondary">
                  {item.max_inventory > 0
                    ? `${item.quantity} / ${item.max_inventory} owned`
                    : `${item.quantity} owned`}
                </Badge>
              </div>
              <h3 className="mt-5 font-display text-xl font-bold">{item.display_name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              {isStreakFreeze && (
                <p className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                  Kept in inventory. On an eligible missed day after a reading day, use Protect today from Home. One Freeze is consumed; server cooldowns apply.
                </p>
              )}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
                <span className="inline-flex items-center gap-2 font-semibold">
                  <CurrencyIcon currency="goldLeaves" size="lg" />
                  {item.gold_leaves_cost.toLocaleString()} Gold {item.gold_leaves_cost === 1 ? "Leaf" : "Leaves"}
                </span>
                <Button
                  size="sm"
                  className="min-h-11"
                  disabled={
                    cached
                    || shop.purchaseMutation.isPending
                    || !item.can_purchase
                    || inventoryFull
                    || !canAfford
                  }
                  onClick={() => {
                    const proposedKey = inMemoryPurchaseKeys.current.get(item.code)
                      ?? createPurchaseIdempotencyKey();
                    const claim = claimPendingShopPurchase(
                      userId,
                      item.code,
                      proposedKey,
                    );
                    if (!claim.durable) {
                      inMemoryPurchaseKeys.current.delete(item.code);
                      toast.error(
                        "Secure purchase retry is unavailable on this device. Enable site storage before buying.",
                      );
                      return;
                    }
                    inMemoryPurchaseKeys.current.set(item.code, claim.idempotencyKey);
                    setPurchaseTarget({ item, idempotencyKey: claim.idempotencyKey });
                  }}
                >
                  {cached
                    ? "Reconnect to buy"
                    : purchasingThisItem
                    ? "Buying..."
                    : inventoryFull
                      ? "Inventory full"
                      : !canAfford
                        ? "Not enough Leaves"
                        : item.can_purchase ? "Buy" : "Unavailable"}
                </Button>
              </div>
            </JourneySurface>
          );
        })}
      </div>

      <AlertDialog
        open={Boolean(purchaseTarget)}
        onOpenChange={(open) => {
          if (!open && !shop.purchaseMutation.isPending) setPurchaseTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Buy {purchaseTarget?.item.display_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This spends {purchaseTarget?.item.gold_leaves_cost.toLocaleString()} Gold {purchaseTarget?.item.gold_leaves_cost === 1 ? "Leaf" : "Leaves"}.
              {purchaseTarget
                ? ` Your balance after purchase will be ${(account.gold_leaves - purchaseTarget.item.gold_leaves_cost).toLocaleString()}.`
                : ""}
              {" "}Your Lifetime Ink and level will not change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={shop.purchaseMutation.isPending}>Cancel</AlertDialogCancel>
            <Button
              className="min-h-11"
              disabled={cached || shop.purchaseMutation.isPending}
              onClick={() => void handlePurchase()}
            >
              {cached
                ? "Reconnect to purchase"
                : shop.purchaseMutation.isPending ? "Purchasing..." : "Confirm purchase"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
