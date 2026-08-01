interface FirebaseServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export interface FcmNotification {
  title: string;
  body: string;
  image?: string;
  data?: Record<string, unknown>;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

const base64Url = (value: Uint8Array | string) => {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const parsePrivateKey = (pem: string) => {
  const normalized = pem
    .replace(/\\n/g, "\n")
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const getServiceAccount = (): FirebaseServiceAccount => {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("FCM_SERVICE_ACCOUNT_JSON is not configured");
  const account = JSON.parse(raw) as FirebaseServiceAccount;
  if (!account.project_id || !account.client_email || !account.private_key) {
    throw new Error("FCM service account is incomplete");
  }
  return account;
};

const getAccessToken = async () => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const account = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: account.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsignedToken = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    parsePrivateKey(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken),
  );
  const assertion = `${unsignedToken}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch(account.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) {
    throw new Error(`FCM OAuth failed with status ${response.status}`);
  }
  const payload = await response.json() as { access_token: string; expires_in?: number };
  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in || 3600) * 1000,
  };
  return payload.access_token;
};

const stringifyData = (data?: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(data || {}).map(([key, value]) => [
      key,
      typeof value === "string" ? value : JSON.stringify(value),
    ]),
  );

export const sendFcmNotifications = async (
  tokens: string[],
  notification: FcmNotification,
) => {
  if (tokens.length === 0) return { sent: 0, failed: 0, errors: [] as string[] };
  const account = getServiceAccount();
  const accessToken = await getAccessToken();
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let index = 0; index < tokens.length; index += 25) {
    const batch = tokens.slice(index, index + 25);
    const results = await Promise.allSettled(
      batch.map(async (token) => {
        const response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token,
                notification: {
                  title: notification.title,
                  body: notification.body,
                  image: notification.image,
                },
                data: stringifyData(notification.data),
                android: { priority: "high" },
                apns: {
                  headers: { "apns-priority": "10" },
                  payload: { aps: { sound: "default" } },
                },
              },
            }),
          },
        );
        if (!response.ok) {
          throw new Error(`FCM HTTP v1 returned ${response.status}`);
        }
      }),
    );
    for (const result of results) {
      if (result.status === "fulfilled") sent += 1;
      else {
        failed += 1;
        errors.push(result.reason instanceof Error ? result.reason.message : "FCM delivery failed");
      }
    }
  }

  return { sent, failed, errors };
};
