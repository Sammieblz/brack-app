import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

export type CoreTelemetryEvent =
  | "book_search_succeeded"
  | "book_search_failed"
  | "book_search_cache_hit"
  | "barcode_scan_succeeded"
  | "barcode_scan_failed"
  | "sync_succeeded"
  | "sync_failed"
  | "import_previewed"
  | "import_completed"
  | "import_failed"
  | "duplicate_prevented";

export const trackCoreEvent = (
  eventName: CoreTelemetryEvent,
  metadata: Record<string, unknown> = {},
) => {
  void supabase.functions
    .invoke("core-telemetry", {
      body: {
        event_name: eventName,
        platform: Capacitor.getPlatform(),
        app_version: import.meta.env.VITE_APP_VERSION || "development",
        metadata,
      },
    })
    .catch(() => undefined);
};
