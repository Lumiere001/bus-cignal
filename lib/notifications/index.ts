import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationEvent } from "./events";

export { NOTIFICATION_EVENTS } from "./events";
export type { NotificationEvent } from "./events";

type Target =
  | { operatorId: string; passengerId?: undefined }
  | { passengerId: string; operatorId?: undefined };

export type NotifyInput = Target & {
  type: NotificationEvent;
  payload?: Record<string, unknown>;
  /** PWA 푸시도 보낼지 (기본 true). 옵트인 — 구독 있을 때만 실제 발송. */
  push?: boolean;
};

/**
 * 알림 생성 — 인앱(notifications 테이블)에 즉시 기록. SPEC §8·§9.5.
 * push !== false 면 푸시 채널 row도 생성하고 FCM 발송 시도(현재 stub).
 */
export async function notify(input: NotifyInput): Promise<void> {
  const db = createAdminClient();
  const base = {
    operator_id: input.operatorId ?? null,
    passenger_id: input.passengerId ?? null,
    type: input.type,
    payload: (input.payload ?? {}) as never,
  };

  // 인앱 (Supabase Realtime로 구독 → 즉시 표시)
  await db.from("notifications").insert({
    ...base,
    channel: "in_app",
    delivery_status: "sent",
    sent_at: new Date().toISOString(),
  });

  // 푸시 (옵트인) — 발송은 FCM 연동 후. 지금은 pending row만 + stub.
  if (input.push !== false) {
    await db
      .from("notifications")
      .insert({ ...base, channel: "push", delivery_status: "pending" });
    await sendPush();
  }
}

/**
 * TODO(FCM 연동 후): Firebase Admin으로 구독 토큰에 푸시 발송.
 * 옵트인(홈 화면 추가 + 알림 허용)한 대상만. 실패 시 3회 재시도(1m→5m→30m, SPEC §9.5).
 * 현재는 no-op — 인앱 알림은 위에서 이미 기록됨.
 */
async function sendPush(): Promise<void> {
  return;
}
