export const MAX_READING_SESSION_MINUTES = 12 * 60;

export type ReadingSessionValidationInput = {
  startTime: string;
  endTime: string;
  durationMinutes: number;
};

export const validateReadingSessionInput = ({
  startTime,
  endTime,
  durationMinutes,
}: ReadingSessionValidationInput): string | null => {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    !Number.isFinite(durationMinutes)
  ) {
    return "Invalid reading session time range";
  }

  const roundedDuration = Math.round(durationMinutes);
  if (roundedDuration < 1) {
    return "Reading session duration must be at least one minute";
  }

  if (roundedDuration > MAX_READING_SESSION_MINUTES) {
    return `Reading sessions cannot exceed ${MAX_READING_SESSION_MINUTES / 60} hours`;
  }

  if (end.getTime() < start.getTime()) {
    return "Reading session end time cannot be before start time";
  }

  if (end.getTime() - Date.now() > 5 * 60_000) {
    return "Reading session end time cannot be in the future";
  }

  const wallClockMinutes = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 60_000));
  if (roundedDuration > wallClockMinutes + 2) {
    return "Reading session duration does not match its time range";
  }

  return null;
};
