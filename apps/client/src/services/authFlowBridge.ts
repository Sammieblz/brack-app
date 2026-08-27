const AUTH_FLOW_CHANNEL = "brack:auth-flow-completed:v1";
const AUTH_FLOW_COMPLETED = "brack:auth-flow-completed";

interface AuthFlowCompletionMessage {
  type: typeof AUTH_FLOW_COMPLETED;
}

const isCompletionMessage = (
  value: unknown,
): value is AuthFlowCompletionMessage =>
  Boolean(
    value &&
      typeof value === "object" &&
      "type" in value &&
      value.type === AUTH_FLOW_COMPLETED,
  );

const openCompletionChannel = () => {
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(AUTH_FLOW_CHANNEL);
  } catch {
    return null;
  }
};

/**
 * Signal the still-open requesting tab after an OAuth callback establishes a
 * session. No onboarding answers or account data cross the document boundary.
 */
export const publishAuthFlowCompletion = () => {
  const message: AuthFlowCompletionMessage = { type: AUTH_FLOW_COMPLETED };
  let hasRequestingWindow = false;

  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(message, window.location.origin);
      hasRequestingWindow = true;
    }
  } catch {
    // BroadcastChannel below remains a same-origin fallback.
  }

  const channel = openCompletionChannel();
  if (channel) {
    channel.postMessage(message);
    channel.close();
  }

  return hasRequestingWindow;
};

export const subscribeToAuthFlowCompletion = (listener: () => void) => {
  const handleWindowMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || !isCompletionMessage(event.data)) {
      return;
    }
    listener();
  };

  window.addEventListener("message", handleWindowMessage);

  const channel = openCompletionChannel();
  const handleChannelMessage = (event: MessageEvent) => {
    if (isCompletionMessage(event.data)) listener();
  };
  channel?.addEventListener("message", handleChannelMessage);

  return () => {
    window.removeEventListener("message", handleWindowMessage);
    channel?.removeEventListener("message", handleChannelMessage);
    channel?.close();
  };
};
