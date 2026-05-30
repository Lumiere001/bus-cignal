import * as Sentry from "@sentry/nextjs";

// Sentry 브라우저 초기화. DSN 없으면 no-op (스캐폴드).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({ dsn, tracesSampleRate: 0.1 });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
