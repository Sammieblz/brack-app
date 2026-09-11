import { normalizeDateOnly, toLocalDate } from "@/lib/dateOnly";

export const statusStyles: Record<string, string> = {
  completed: "bg-green-500 text-white",
  reading: "bg-orange-500 text-white",
  to_read: "bg-blue-500 text-white",
};

export const formatBookStatus = (status: string) => status.replace("_", " ");

export const formatBookDate = (date?: string | null) => {
  if (!date) return null;
  const canonical = normalizeDateOnly(date);
  return toLocalDate(canonical)?.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }) ?? canonical;
};

