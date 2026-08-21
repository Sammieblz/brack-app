import { useEffect, useRef, useState } from "react";
import { formatTimeRemaining } from "@/lib/journey";

const parseReceivedAt = (receivedAt?: string | null) => {
  const parsed = receivedAt ? Date.parse(receivedAt) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Date.now();
};

export const useJourneyCountdown = (
  targetTime: string,
  serverTime: string,
  timezone = "UTC",
  receivedAt?: string | null,
) => {
  const receivedAtRef = useRef(parseReceivedAt(receivedAt));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    receivedAtRef.current = parseReceivedAt(receivedAt);
    setNow(Date.now());
  }, [receivedAt, serverTime]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return formatTimeRemaining(
    targetTime,
    serverTime,
    receivedAtRef.current,
    now,
    timezone,
  );
};
