import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createServiceClient,
  jsonResponse,
  optionsResponse,
} from "../_shared/appEndpoint.ts";

serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin);
  }

  try {
    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient
      .from("app_feature_flags")
      .select("key,enabled,config,updated_at");

    if (error) throw error;

    const flags = Object.fromEntries(
      (data ?? []).map((flag) => [
        flag.key,
        {
          enabled: flag.enabled,
          config: flag.config ?? {},
          updated_at: flag.updated_at,
        },
      ]),
    );

    return jsonResponse(
      {
        flags,
        social_enabled: flags.social?.enabled ?? true,
      },
      200,
      origin,
    );
  } catch (error) {
    console.error("feature-flags failed", error);
    return jsonResponse(
      { error: "Failed to load feature flags", social_enabled: true },
      500,
      origin,
    );
  }
});
