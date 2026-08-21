import {
  createServiceClient,
  jsonResponse,
  optionsResponse,
} from "../_shared/appEndpoint.ts";
import { sendFcmNotifications } from "../_shared/fcm.ts";

interface QueueMessage {
  msg_id: number;
  read_ct: number;
  message: {
    kind?: string;
    notification_id?: string;
  };
}

const notificationPreferenceColumn: Record<string, string> = {
  badge_earned: "badges_enabled",
  quest_completed: "quests_enabled",
  quest_reminder: "quests_enabled",
  rank_movement: "rank_movement_enabled",
  weekly_league_result: "weekly_results_enabled",
  gold_leaves_earned: "gold_leaves_enabled",
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, origin);

  const expectedSecret = Deno.env.get("GAMIFICATION_WORKER_SECRET");
  if (!expectedSecret || req.headers.get("x-brack-worker-secret") !== expectedSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401, origin);
  }

  const client = createServiceClient();
  try {
    const { data, error } = await client.rpc("read_gamification_jobs", {
      p_visibility_timeout: 120,
      p_batch_size: 50,
    });
    if (error) throw error;

    let processed = 0;
    let failed = 0;
    for (const job of (data || []) as QueueMessage[]) {
      try {
        if (job.message.kind === "weekly_rollover") {
          const { error: rolloverError } = await client.rpc("run_gamification_rollover");
          if (rolloverError) throw rolloverError;
        } else if (job.message.kind === "quest_reminders") {
          const { error: reminderError } = await client.rpc("run_gamification_quest_reminders");
          if (reminderError) throw reminderError;
        } else if (job.message.kind === "push_notification" && job.message.notification_id) {
          const { data: notification, error: notificationError } = await client
            .from("user_notifications")
            .select("*")
            .eq("id", job.message.notification_id)
            .single();
          if (notificationError) throw notificationError;

          const preferenceColumn = notificationPreferenceColumn[notification.notification_type];
          const [{ data: preferences }, { data: tokens }] = await Promise.all([
            client
              .from("notification_preferences")
              .select("*")
              .eq("user_id", notification.user_id)
              .maybeSingle(),
            client
              .from("push_tokens")
              .select("token")
              .eq("user_id", notification.user_id),
          ]);
          const enabled =
            (preferences?.push_enabled ?? true) &&
            (!preferenceColumn || preferences?.[preferenceColumn] !== false);

          if (!enabled || !tokens?.length) {
            await client
              .from("user_notifications")
              .update({ push_status: "skipped", sent_at: new Date().toISOString() })
              .eq("id", notification.id);
          } else {
            const result = await sendFcmNotifications(
              tokens.map((token) => token.token),
              {
                title: notification.title,
                body: notification.body,
                data: {
                  notification_id: notification.id,
                  notification_type: notification.notification_type,
                  ...(notification.data || {}),
                },
              },
            );
            if (result.sent === 0 && result.failed > 0) {
              throw new Error(result.errors[0] || "Push delivery failed");
            }
            await client
              .from("user_notifications")
              .update({
                push_status: "sent",
                push_attempts: notification.push_attempts + 1,
                sent_at: new Date().toISOString(),
                last_push_error: null,
              })
              .eq("id", notification.id);
          }
        }

        await client.rpc("delete_gamification_job", { p_message_id: job.msg_id });
        processed += 1;
      } catch (jobError) {
        failed += 1;
        console.error("gamification job failed", job.msg_id, jobError);
        if (job.message.notification_id) {
          const { data: failedNotification } = await client
            .from("user_notifications")
            .select("push_attempts")
            .eq("id", job.message.notification_id)
            .maybeSingle();
          await client
            .from("user_notifications")
            .update({
              push_status: "failed",
              push_attempts: (failedNotification?.push_attempts ?? 0) + 1,
              last_push_error:
                jobError instanceof Error ? jobError.message.slice(0, 500) : "Worker failed",
            })
            .eq("id", job.message.notification_id);
        }
        if (job.read_ct >= 5) {
          await client.rpc("delete_gamification_job", { p_message_id: job.msg_id });
        }
      }
    }

    return jsonResponse({ success: true, processed, failed }, 200, origin);
  } catch (error) {
    console.error("gamification-worker failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Worker failed" },
      500,
      origin,
    );
  }
});
