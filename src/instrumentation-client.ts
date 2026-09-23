// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://3d817f3a683e2ba6de6d18359717edef@o4511933774233600.ingest.us.sentry.io/4511933781966848",

  // Session Replay is added lazily below, not here — see comment.
  integrations: [],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});

// Session Replay's rrweb-based DOM observer starts watching (and in some
// setups, touching) the document as soon as it's added. Wired up
// synchronously here at module-eval time, that races React's first
// hydration commit and was observed intermittently throwing "Hydration
// failed because the server rendered HTML didn't match the client" on
// every platform. Deferring the integration until the window has finished
// loading — well after hydration commits — keeps error/trace capture live
// from first paint while letting Replay start observing only once the
// DOM it's watching is no longer in flux. This is Sentry's own documented
// pattern for lazy-loading Replay.
if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    Sentry.addIntegration(Sentry.replayIntegration());
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
