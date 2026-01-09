import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: string;
}

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Verify the JWT token from the Authorization header
    const jwt = authHeader.replace("Bearer ", "");

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const body = await req.json();
    const { user_ids, notification, platform } = body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "user_ids array is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!notification || !notification.title || !notification.body) {
      return new Response(
        JSON.stringify({ error: "notification with title and body is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch push tokens for target users
    let query = supabaseClient
      .from("push_tokens")
      .select("token, platform")
      .in("user_id", user_ids);

    if (platform) {
      query = query.eq("platform", platform);
    }

    const { data: tokens, error: tokensError } = await query;

    if (tokensError) {
      throw tokensError;
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ message: "No push tokens found for target users" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Group tokens by platform
    const iosTokens = tokens.filter((t) => t.platform === "ios").map((t) => t.token);
    const androidTokens = tokens.filter((t) => t.platform === "android").map((t) => t.token);

    const results = {
      ios: { tokens: iosTokens.length, sent: 0, failed: 0 },
      android: { tokens: androidTokens.length, sent: 0, failed: 0 },
    };

    // Send iOS notifications via FCM (FCM supports both iOS and Android)
    if (iosTokens.length > 0) {
      const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
      
      if (fcmServerKey) {
        const fcmResults = await sendFCMNotifications(
          iosTokens,
          notification,
          "ios",
          fcmServerKey
        );
        results.ios.sent = fcmResults.sent;
        results.ios.failed = fcmResults.failed;
      } else {
        console.warn("No FCM credentials configured for iOS notifications");
      }
    }

    // Send Android notifications via FCM
    if (androidTokens.length > 0) {
      const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
      
      if (fcmServerKey) {
        const fcmResults = await sendFCMNotifications(
          androidTokens,
          notification,
          "android",
          fcmServerKey
        );
        results.android.sent = fcmResults.sent;
        results.android.failed = fcmResults.failed;
      } else {
        console.warn("No FCM credentials configured for Android notifications");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Notifications queued",
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending push notification:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Helper function to send FCM notifications
async function sendFCMNotifications(
  tokens: string[],
  notification: NotificationPayload,
  platform: "ios" | "android",
  serverKey: string
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  // FCM allows up to 500 tokens per batch
  const batchSize = 500;
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);

    const payload: any = {
      registration_ids: batch,
      notification: {
        title: notification.title,
        body: notification.body,
        sound: notification.sound || "default",
        badge: notification.badge,
      },
      data: notification.data || {},
    };

    // Platform-specific configuration
    if (platform === "ios") {
      payload.apns = {
        payload: {
          aps: {
            sound: notification.sound || "default",
            badge: notification.badge,
            "content-available": 1,
          },
        },
      };
    }

    try {
      const response = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `key=${serverKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`FCM request failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Count successful and failed sends
      if (result.results) {
        result.results.forEach((r: any) => {
          if (r.error) {
            failed++;
          } else {
            sent++;
          }
        });
      }
    } catch (error) {
      console.error(`Error sending FCM batch ${i / batchSize + 1}:`, error);
      failed += batch.length;
    }
  }

  return { sent, failed };
}

