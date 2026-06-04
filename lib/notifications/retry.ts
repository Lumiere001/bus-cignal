/**
 * 푸시 발송 재시도 정책 — SPEC §8·§9.5.
 * "FCM 푸시 실패 시 3회 재시도(1m → 5m → 30m). 모두 실패 → 마스터 알림."
 *
 * 순수 함수 — DB·시간 의존 없음. FCM 연동 후 deliverPush(index.ts)가 사용.
 * notifications.retry_count = 지금까지 한 재시도 횟수(초기 발송 실패 전 0).
 */
export const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000] as const; // 1m, 5m, 30m
export const MAX_PUSH_ATTEMPTS = RETRY_DELAYS_MS.length; // 3

/**
 * 다음 재시도까지 대기(ms). `retriesDone`회 재시도를 마친 상태에서 또 실패했을 때,
 * 다음 재시도 전 대기 시간. 더 이상 재시도가 없으면 null.
 */
export function nextRetryDelayMs(retriesDone: number): number | null {
  return retriesDone >= 0 && retriesDone < RETRY_DELAYS_MS.length
    ? RETRY_DELAYS_MS[retriesDone]
    : null;
}

/** 재시도 소진(마스터 알림 필요) 여부. */
export function isExhausted(retryCount: number): boolean {
  return retryCount >= MAX_PUSH_ATTEMPTS;
}

/**
 * pending push row가 (재)발송 시점이 됐는지 — 백오프 게이트.
 * retry_count=N 인 row는 직전 시도(last_attempt_at)에서 RETRY_DELAYS_MS[N-1] 만큼 지나야 다음 시도.
 *  - last_attempt_at 없음 = 초기 발송 전 → 즉시 due
 *  - retry_count=0 = 아직 한 번도 시도 안 함 → 즉시 due
 *  - N이 단계를 넘으면(곧 failed 처리될 상태) due 아님
 *
 * @param now Date.now() (ms) — 호출자가 주입(테스트 결정성).
 */
export function isRetryDue(
  retryCount: number,
  lastAttemptAt: string | null,
  now: number,
): boolean {
  if (!lastAttemptAt) return true;
  const idx = retryCount - 1;
  if (idx < 0) return true;
  if (idx >= RETRY_DELAYS_MS.length) return false;
  return now - new Date(lastAttemptAt).getTime() >= RETRY_DELAYS_MS[idx];
}

export type PushAttemptResult =
  | { status: "sent" }
  | { status: "pending"; retryCount: number; nextDelayMs: number }
  | { status: "failed"; retryCount: number; alertMaster: true };

/**
 * 1회 발송 시도 결과 → 다음 상태. 순수.
 * @param prevRetryCount 이번 시도 직전까지의 retry_count (초기 발송이면 0)
 * @param ok 발송 성공 여부
 */
export function reducePushAttempt(
  prevRetryCount: number,
  ok: boolean,
): PushAttemptResult {
  if (ok) return { status: "sent" };
  const delay = nextRetryDelayMs(prevRetryCount);
  if (delay === null) {
    return { status: "failed", retryCount: prevRetryCount, alertMaster: true };
  }
  return { status: "pending", retryCount: prevRetryCount + 1, nextDelayMs: delay };
}
