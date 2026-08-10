interface SyncErrorDetails {
  message: string;
  code: string | null;
  status: number | null;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object"
    ? value as Record<string, unknown>
    : null;

export const getSyncErrorDetails = (error: unknown): SyncErrorDetails => {
  const record = asRecord(error);
  const message = error instanceof Error
    ? error.message
    : typeof record?.message === "string"
    ? record.message
    : typeof record?.error_description === "string"
    ? record.error_description
    : typeof record?.details === "string"
    ? record.details
    : "Sync item failed";
  const code = typeof record?.code === "string"
    ? record.code.toUpperCase()
    : null;
  const rawStatus = record?.status ?? record?.statusCode;
  const status = typeof rawStatus === "number" && Number.isFinite(rawStatus)
    ? rawStatus
    : null;

  return { message, code, status };
};

export const isRetryableSyncError = (error: unknown) => {
  const { message, code, status } = getSyncErrorDetails(error);
  const normalized = message.toLowerCase();

  if (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    (status !== null && status >= 500) ||
    code === "40001" ||
    code === "40P01" ||
    code === "55P03" ||
    code === "57014" ||
    code === "PGRST000" ||
    code === "PGRST001" ||
    code === "PGRST002" ||
    code === "PGRST003" ||
    code?.startsWith("08") ||
    code?.startsWith("53") ||
    code?.startsWith("57") ||
    code?.startsWith("58") ||
    normalized.includes("timed out") ||
    normalized.includes("timeout") ||
    normalized.includes("temporarily unavailable") ||
    normalized.includes("connection reset") ||
    normalized.includes("connection refused") ||
    normalized.includes("rate limit") ||
    normalized.includes("deadlock") ||
    normalized.includes("serialization failure")
  ) {
    return true;
  }

  if (
    (status !== null && status >= 400 && status < 500) ||
    code?.startsWith("22") ||
    code?.startsWith("23") ||
    code?.startsWith("42") ||
    code?.startsWith("PGRST") ||
    normalized.includes("already exists") ||
    normalized.includes("cannot exceed") ||
    normalized.includes("does not match") ||
    normalized.includes("does not belong") ||
    normalized.includes("does not exist") ||
    normalized.includes("not found") ||
    normalized.includes("unsupported sync entity") ||
    normalized.includes("invalid reading session") ||
    normalized.includes("invalid session") ||
    normalized.includes("invalid input") ||
    normalized.includes("duration must") ||
    normalized.includes("end time cannot") ||
    normalized.includes("order changed on another device") ||
    normalized.includes("not allowed") ||
    normalized.includes("access denied") ||
    normalized.includes("missing list or book identity") ||
    normalized.includes("no complete book snapshot") ||
    normalized.includes("could not be identified safely") ||
    normalized.includes("did not return a canonical book id and record") ||
    normalized.includes("violates") ||
    normalized.includes("null value")
  ) {
    return false;
  }

  // Unknown server failures may be transient. Keep the local change and retry it.
  return true;
};
