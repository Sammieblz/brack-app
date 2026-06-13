import * as Sentry from "@sentry/react";

/**
 * Initialize Sentry for error tracking
 * Set VITE_SENTRY_DSN environment variable to enable
 */
export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.MODE || "development";

  if (!dsn) {
    // Sentry is optional - only initialize if DSN is provided
    console.log("Sentry DSN not provided, error tracking disabled");
    return;
  }

  Sentry.init({
    dsn,
    environment,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Performance Monitoring
    tracesSampleRate: environment === "production" ? 0.1 : 1.0,
    // Session Replay
    replaysSessionSampleRate: environment === "production" ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
    // Filter out sensitive data
    beforeSend(event, hint) {
      // Remove sensitive information from errors
      if (event.request) {
        // Don't send request body which may contain sensitive data
        delete event.request.data;
      }
      return event;
    },
  });
};
