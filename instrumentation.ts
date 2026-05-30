import * as Sentry from "@sentry/nextjs";

// Sentry 서버/엣지 초기화. DSN 없으면 no-op (스캐폴드).
// TODO: 소스맵 업로드는 next.config의 withSentryConfig 추가 시 (출시 전).
export function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  if (
    process.env.NEXT_RUNTIME === "nodejs" ||
    process.env.NEXT_RUNTIME === "edge"
  ) {
    Sentry.init({ dsn, tracesSampleRate: 0.1 });
  }
}

export const onRequestError = Sentry.captureRequestError;
