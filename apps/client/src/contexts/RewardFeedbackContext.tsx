import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { gsap } from "gsap";
import { CurrencyIcon, type BrackCurrency } from "@/components/CurrencyIcon";
import { useAuth } from "@/hooks/useAuth";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export type RewardFeedbackCurrency = BrackCurrency;

export interface ConfirmedRewardFeedbackBatch {
  userId: string;
  id: string;
  rewardCount: number;
  ink: number;
  goldLeaves: number;
}

interface QueuedRewardFeedbackBatch extends ConfirmedRewardFeedbackBatch {
  queuedAt: number;
}

interface RewardArrival {
  token: number;
  batchId: string;
  amount: number;
}

interface RenderedBalanceRange {
  batchId: string;
  from: number;
  to: number;
}

type HudTarget = HTMLElement | null;
type ArrivalMap = Record<RewardFeedbackCurrency, RewardArrival | null>;

interface RewardFeedbackContextValue {
  activeBatch: ConfirmedRewardFeedbackBatch | null;
  arrivals: ArrivalMap;
  publishConfirmedRewards: (batch: ConfirmedRewardFeedbackBatch) => void;
  registerHudTarget: (currency: RewardFeedbackCurrency, target: HudTarget) => void;
  getHudTarget: (currency: RewardFeedbackCurrency) => HudTarget;
}

const EMPTY_ARRIVALS: ArrivalMap = { ink: null, goldLeaves: null };
const NOOP_CONTEXT: RewardFeedbackContextValue = {
  activeBatch: null,
  arrivals: EMPTY_ARRIVALS,
  publishConfirmedRewards: () => undefined,
  registerHudTarget: () => undefined,
  getHudTarget: () => null,
};

const RewardFeedbackContext = createContext<RewardFeedbackContextValue>(NOOP_CONTEXT);

const REWARD_QUEUE_TTL_MS = 15_000;
const MAX_REWARD_QUEUE_LENGTH = 2;

const rewardAnnouncement = (batch: ConfirmedRewardFeedbackBatch) => {
  const rewards = [
    batch.ink > 0 ? `+${batch.ink.toLocaleString()} Ink` : null,
    batch.goldLeaves > 0
      ? `+${batch.goldLeaves.toLocaleString()} ${batch.goldLeaves === 1 ? "Gold Leaf" : "Gold Leaves"}`
      : null,
  ].filter(Boolean).join(" and ");
  return `${batch.rewardCount === 1 ? "Reward" : `${batch.rewardCount} rewards`} confirmed: ${rewards}.`;
};

const isForegroundDocument = () => (
  typeof document !== "undefined"
  && document.visibilityState === "visible"
  && document.hasFocus()
);

const positiveAmount = (value: number) => (
  Number.isFinite(value) ? Math.max(0, value) : 0
);

export const RewardFeedbackProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const reducedMotion = useReducedMotion();
  const { triggerHaptic } = useHapticFeedback();
  const [queue, setQueue] = useState<QueuedRewardFeedbackBatch[]>([]);
  const [arrivals, setArrivals] = useState<ArrivalMap>(EMPTY_ARRIVALS);
  const [announcement, setAnnouncement] = useState("");
  const targetsRef = useRef(new Map<RewardFeedbackCurrency, HTMLElement>());
  const publishedRef = useRef(new Set<string>());
  const ownerRef = useRef<string | null>(null);
  const hapticBatchRef = useRef<string | null>(null);
  const arrivalTokenRef = useRef(0);
  const activeBatch = queue[0] ?? null;

  const clearFeedback = useCallback(() => {
    setQueue([]);
    setArrivals(EMPTY_ARRIVALS);
    setAnnouncement("");
    publishedRef.current.clear();
    hapticBatchRef.current = null;
  }, []);

  const cancelPresentations = useCallback(() => {
    setQueue([]);
    setArrivals(EMPTY_ARRIVALS);
    hapticBatchRef.current = null;
  }, []);

  useEffect(() => {
    const cancelIfBackgrounded = () => {
      if (!isForegroundDocument()) cancelPresentations();
    };
    document.addEventListener("visibilitychange", cancelIfBackgrounded);
    window.addEventListener("blur", cancelIfBackgrounded);
    return () => {
      document.removeEventListener("visibilitychange", cancelIfBackgrounded);
      window.removeEventListener("blur", cancelIfBackgrounded);
    };
  }, [cancelPresentations]);

  useEffect(() => {
    if (authLoading) return;
    const authenticatedUserId = user?.id ?? null;
    if (ownerRef.current !== authenticatedUserId) {
      clearFeedback();
      ownerRef.current = authenticatedUserId;
    }
  }, [authLoading, clearFeedback, user?.id]);

  const publishConfirmedRewards = useCallback((batch: ConfirmedRewardFeedbackBatch) => {
    const ink = positiveAmount(batch.ink);
    const goldLeaves = positiveAmount(batch.goldLeaves);
    if (!batch.userId || (ink === 0 && goldLeaves === 0)) return;
    if (!isForegroundDocument()) return;
    if (!authLoading && user?.id !== batch.userId) return;

    if (ownerRef.current && ownerRef.current !== batch.userId) {
      clearFeedback();
    }
    ownerRef.current = batch.userId;

    const dedupeKey = `${batch.userId}:${batch.id}`;
    if (publishedRef.current.has(dedupeKey)) return;
    publishedRef.current.add(dedupeKey);
    if (publishedRef.current.size > 100) {
      publishedRef.current = new Set([dedupeKey]);
    }

    const next = { ...batch, ink, goldLeaves, queuedAt: Date.now() };
    setAnnouncement(rewardAnnouncement(next));
    setQueue((current) => {
      const unexpired = current.filter(
        (queued) => next.queuedAt - queued.queuedAt < REWARD_QUEUE_TTL_MS,
      );
      if (unexpired.length === 0) return [next];

      // Preserve the in-flight batch and coalesce everything waiting behind it
      // so rapid syncs can never create a long celebration parade.
      const waiting = unexpired.slice(1);
      const mergedWaiting = waiting.reduce<QueuedRewardFeedbackBatch>(
        (merged, queued) => ({
          ...next,
          rewardCount: merged.rewardCount + queued.rewardCount,
          ink: merged.ink + queued.ink,
          goldLeaves: merged.goldLeaves + queued.goldLeaves,
          queuedAt: next.queuedAt,
        }),
        next,
      );
      return [unexpired[0], mergedWaiting].slice(0, MAX_REWARD_QUEUE_LENGTH);
    });
  }, [authLoading, clearFeedback, user?.id]);

  const registerHudTarget = useCallback((currency: RewardFeedbackCurrency, target: HudTarget) => {
    if (target) targetsRef.current.set(currency, target);
    else targetsRef.current.delete(currency);
  }, []);

  const getHudTarget = useCallback(
    (currency: RewardFeedbackCurrency) => targetsRef.current.get(currency) ?? null,
    [],
  );

  const announceArrival = useCallback((
    batchId: string,
    currency: RewardFeedbackCurrency,
    amount: number,
  ) => {
    if (
      hapticBatchRef.current !== batchId
      && !reducedMotion
      && isForegroundDocument()
    ) {
      hapticBatchRef.current = batchId;
      void triggerHaptic("success");
    }
    arrivalTokenRef.current += 1;
    setArrivals((current) => ({
      ...current,
      [currency]: { token: arrivalTokenRef.current, batchId, amount },
    }));
  }, [reducedMotion, triggerHaptic]);

  const completeBatch = useCallback((batchId: string) => {
    setQueue((current) => current[0]?.id === batchId
      ? current.slice(1).filter((queued) => Date.now() - queued.queuedAt < REWARD_QUEUE_TTL_MS)
      : current);
  }, []);
  const completeActiveBatch = useCallback(() => {
    if (activeBatch) completeBatch(activeBatch.id);
  }, [activeBatch, completeBatch]);

  const value = useMemo<RewardFeedbackContextValue>(() => ({
    activeBatch,
    arrivals,
    publishConfirmedRewards,
    registerHudTarget,
    getHudTarget,
  }), [activeBatch, arrivals, getHudTarget, publishConfirmedRewards, registerHudTarget]);

  useEffect(() => {
    if (!activeBatch) return undefined;
    const remaining = REWARD_QUEUE_TTL_MS - (Date.now() - activeBatch.queuedAt);
    if (remaining <= 0) {
      completeBatch(activeBatch.id);
      return undefined;
    }
    const expiry = window.setTimeout(() => completeBatch(activeBatch.id), remaining);
    return () => window.clearTimeout(expiry);
  }, [activeBatch, completeBatch]);

  return (
    <RewardFeedbackContext.Provider value={value}>
      {children}
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
      {activeBatch && (
        <RewardFlightSequence
          key={activeBatch.id}
          batch={activeBatch}
          getTarget={getHudTarget}
          onArrival={announceArrival}
          onComplete={completeActiveBatch}
        />
      )}
    </RewardFeedbackContext.Provider>
  );
};

export const useRewardFeedback = () => useContext(RewardFeedbackContext);

export const useRewardHudTarget = (
  currency: RewardFeedbackCurrency,
  authoritativeValue: number | null | undefined,
) => {
  const {
    activeBatch,
    arrivals,
    registerHudTarget,
  } = useRewardFeedback();
  const reducedMotion = useReducedMotion();
  const hasAuthoritativeValue = typeof authoritativeValue === "number"
    && Number.isFinite(authoritativeValue);
  const currentValue = hasAuthoritativeValue ? (authoritativeValue as number) : 0;
  const [displayValue, setDisplayValue] = useState(currentValue);
  const [isPulsing, setIsPulsing] = useState(false);
  const targetRef = useRef<HTMLElement | null>(null);
  const countTweenRef = useRef<gsap.core.Tween | null>(null);
  const pulseTweenRef = useRef<gsap.core.Tween | null>(null);
  const pulseTimerRef = useRef<number | null>(null);
  const departureIdRef = useRef<string | null>(null);
  const previousAuthoritativeRef = useRef<number | null>(
    hasAuthoritativeValue ? currentValue : null,
  );
  const pendingRangeRef = useRef<Omit<RenderedBalanceRange, "batchId"> | null>(null);
  const activeRangeRef = useRef<RenderedBalanceRange | null>(null);
  const arrivalTokenRef = useRef<number | null>(null);
  const arrival = arrivals[currency];
  const departingAmount = activeBatch ? Math.max(0, activeBatch[currency]) : 0;

  if (hasAuthoritativeValue && previousAuthoritativeRef.current !== currentValue) {
    const previous = previousAuthoritativeRef.current;
    previousAuthoritativeRef.current = currentValue;
    pendingRangeRef.current = previous !== null && currentValue > previous
      ? { from: previous, to: currentValue }
      : null;
  }

  const setTargetRef = useCallback((target: HTMLElement | null) => {
    targetRef.current = target;
    registerHudTarget(currency, target);
  }, [currency, registerHudTarget]);

  useEffect(() => () => {
    registerHudTarget(currency, null);
    countTweenRef.current?.kill();
    pulseTweenRef.current?.kill();
    if (pulseTimerRef.current !== null) window.clearTimeout(pulseTimerRef.current);
  }, [currency, registerHudTarget]);

  useLayoutEffect(() => {
    if (activeBatch && departingAmount > 0 && departureIdRef.current !== activeBatch.id) {
      departureIdRef.current = activeBatch.id;
      countTweenRef.current?.kill();
      const pendingRange = pendingRangeRef.current;
      pendingRangeRef.current = null;
      if (
        !reducedMotion
        && pendingRange
        && pendingRange.to === currentValue
        && pendingRange.to > pendingRange.from
      ) {
        activeRangeRef.current = { batchId: activeBatch.id, ...pendingRange };
        setDisplayValue(pendingRange.from);
      } else {
        activeRangeRef.current = null;
        setDisplayValue(currentValue);
      }
      return;
    }

    if (activeBatch || countTweenRef.current?.isActive() || activeRangeRef.current) return;
    const timer = window.setTimeout(() => {
      if (pendingRangeRef.current?.to === currentValue) {
        pendingRangeRef.current = null;
      }
      setDisplayValue(currentValue);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeBatch, currentValue, departingAmount, reducedMotion]);

  useEffect(() => {
    if (!arrival || arrivalTokenRef.current === arrival.token) return;
    arrivalTokenRef.current = arrival.token;
    countTweenRef.current?.kill();
    pulseTweenRef.current?.kill();
    if (pulseTimerRef.current !== null) window.clearTimeout(pulseTimerRef.current);

    setIsPulsing(true);
    pulseTimerRef.current = window.setTimeout(
      () => setIsPulsing(false),
      reducedMotion ? 500 : 900,
    );

    if (reducedMotion) {
      setDisplayValue(currentValue);
      return;
    }

    const range = activeRangeRef.current;
    if (!range || range.batchId !== arrival.batchId || range.to !== currentValue) {
      setDisplayValue(currentValue);
      return;
    }

    const counter = { value: range.from };
    setDisplayValue(Math.round(counter.value));
    countTweenRef.current = gsap.to(counter, {
      value: range.to,
      duration: 0.65,
      ease: "power2.out",
      onUpdate: () => setDisplayValue(Math.round(counter.value)),
      onComplete: () => {
        activeRangeRef.current = null;
        setDisplayValue(range.to);
      },
    });

    if (targetRef.current) {
      pulseTweenRef.current = gsap.fromTo(
        targetRef.current,
        { scale: 1 },
        {
          scale: 1.025,
          duration: 0.18,
          repeat: 1,
          yoyo: true,
          ease: "power1.inOut",
          clearProps: "transform",
        },
      );
    }
  }, [arrival, currentValue, reducedMotion]);

  return { displayValue, isPulsing, targetRef: setTargetRef };
};

interface RewardFlightSequenceProps {
  batch: ConfirmedRewardFeedbackBatch;
  getTarget: (currency: RewardFeedbackCurrency) => HudTarget;
  onArrival: (
    batchId: string,
    currency: RewardFeedbackCurrency,
    amount: number,
  ) => void;
  onComplete: () => void;
}

const RewardFlightSequence = ({
  batch,
  getTarget,
  onArrival,
  onComplete,
}: RewardFlightSequenceProps) => {
  const flights = useMemo(() => ([
    ...(batch.ink > 0 ? [{ currency: "ink" as const, amount: batch.ink }] : []),
    ...(batch.goldLeaves > 0
      ? [{ currency: "goldLeaves" as const, amount: batch.goldLeaves }]
      : []),
  ]), [batch.goldLeaves, batch.ink]);
  const completedRef = useRef(0);

  const handleComplete = useCallback(() => {
    completedRef.current += 1;
    if (completedRef.current >= flights.length) onComplete();
  }, [flights.length, onComplete]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[120] overflow-hidden"
      data-brack-celebration-active="reward"
    >
      {flights.map((flight, index) => (
        <RewardFlight
          key={`${batch.id}:${flight.currency}`}
          batchId={batch.id}
          currency={flight.currency}
          amount={flight.amount}
          delay={index * 0.18}
          getTarget={getTarget}
          onArrival={onArrival}
          onComplete={handleComplete}
        />
      ))}
    </div>,
    document.body,
  );
};

interface RewardFlightProps {
  batchId: string;
  currency: RewardFeedbackCurrency;
  amount: number;
  delay: number;
  getTarget: (currency: RewardFeedbackCurrency) => HudTarget;
  onArrival: (
    batchId: string,
    currency: RewardFeedbackCurrency,
    amount: number,
  ) => void;
  onComplete: () => void;
}

const RewardFlight = ({
  batchId,
  currency,
  amount,
  delay,
  getTarget,
  onArrival,
  onComplete,
}: RewardFlightProps) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const element = elementRef.current;
    const target = getTarget(currency);
    if (reducedMotion || !element || !target) {
      onArrival(batchId, currency, amount);
      onComplete();
      return;
    }

    const targetRect = target.getBoundingClientRect();
    const chipRect = element.getBoundingClientRect();
    const startX = Math.max(16, Math.min(window.innerWidth - chipRect.width - 16, (window.innerWidth - chipRect.width) / 2));
    const startY = Math.max(
      targetRect.bottom + 96,
      Math.min(window.innerHeight - chipRect.height - 96, window.innerHeight * 0.42),
    );
    const targetX = targetRect.left + (targetRect.width - chipRect.width) / 2;
    const targetY = targetRect.top + (targetRect.height - chipRect.height) / 2;

    gsap.set(element, { x: startX, y: startY, opacity: 0, scale: 0.92 });
    const timeline = gsap.timeline({ delay });
    timeline
      .to(element, { opacity: 1, scale: 1, y: startY - 8, duration: 0.18, ease: "power2.out" })
      .to(element, {
        x: targetX,
        y: targetY,
        scale: 0.5,
        opacity: 0.9,
        duration: 0.72,
        ease: "power3.in",
        onComplete: () => onArrival(batchId, currency, amount),
      })
      .to(element, {
        opacity: 0,
        duration: 0.12,
        ease: "power1.out",
        onComplete,
      });
    return () => {
      timeline.kill();
    };
  }, [amount, batchId, currency, delay, getTarget, onArrival, onComplete, reducedMotion]);

  return (
    <div
      ref={elementRef}
      className="fixed left-0 top-0 flex items-center gap-2 rounded-full border border-border/80 bg-card/95 px-3 py-2 font-sans text-sm font-bold text-foreground opacity-0 shadow-xl backdrop-blur-md will-change-transform"
    >
      <CurrencyIcon currency={currency} size="md" />
      <span>+{amount.toLocaleString()}</span>
      <span className="text-xs font-semibold text-muted-foreground">
        {currency === "ink" ? "Ink" : amount === 1 ? "Gold Leaf" : "Gold Leaves"}
      </span>
    </div>
  );
};
