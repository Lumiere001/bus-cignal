import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import type {
  NotificationEvent,
  PayloadFor,
  RecipientsFor,
} from "./events";
import { resolveTargets } from "./targets";

export { NOTIFICATION_EVENTS } from "./events";
export type {
  NotificationEvent,
  NotificationPayloads,
  PayloadFor,
  RecipientsFor,
  RecipientSlots,
} from "./events";
export { resolveTargets } from "./targets";
export type { ResolvedTarget } from "./targets";
export {
  isExhausted,
  MAX_PUSH_ATTEMPTS,
  nextRetryDelayMs,
  reducePushAttempt,
  RETRY_DELAYS_MS,
} from "./retry";
export type { PushAttemptResult } from "./retry";

type NotificationInsert =
  Database["public"]["Tables"]["notifications"]["Insert"];

export type EmitOptions = {
  /**
   * 푸시 채널 row 생성 여부 (기본 true). chat_message는 사용자 ON/OFF에 따라 caller가 false 전달.
   * master 대상은 이 값과 무관하게 항상 인앱만.
   */
  push?: boolean;
};

/**
 * 알림 발송 — SPEC §8. 이벤트가 요구하는 대상(EVENT_SLOTS)을 풀어:
 *  - 인앱 row 즉시 기록 (delivery_status=sent → Supabase Realtime로 노출)
 *  - push !== false 대상은 push row(pending)도 생성 후 발송 시도(현재 stub)
 *
 * 타입 안전: 이벤트별 수신자 슬롯을 컴파일 타임에 강제(RecipientsFor)·페이로드도 강제(PayloadFor).
 * 도메인 조회(매칭→양쪽 간사 id 찾기 등)는 호출자(operator·student·cron) 책임 — 엔진은 id만 받음.
 */
export async function emit<E extends NotificationEvent>(
  event: E,
  recipients: RecipientsFor<E>,
  payload: PayloadFor<E>,
  opts: EmitOptions = {},
): Promise<void> {
  const targets = resolveTargets(event, recipients, opts.push !== false);
  if (targets.length === 0) return;

  const now = new Date().toISOString();
  const payloadJson = payload as NotificationInsert["payload"];
  const rows: NotificationInsert[] = [];
  for (const t of targets) {
    rows.push({
      operator_id: t.operatorId,
      passenger_id: t.passengerId,
      type: event,
      payload: payloadJson,
      channel: "in_app",
      delivery_status: "sent",
      sent_at: now,
    });
    if (t.push) {
      rows.push({
        operator_id: t.operatorId,
        passenger_id: t.passengerId,
        type: event,
        payload: payloadJson,
        channel: "push",
        delivery_status: "pending",
      });
    }
  }

  const db = createAdminClient();
  await db.from("notifications").insert(rows);

  if (rows.some((row) => row.channel === "push")) {
    await deliverPushBatch();
  }
}

/**
 * TODO(FCM 연동 후): pending push row를 구독 토큰으로 발송.
 *  - 옵트인(홈 화면 추가 + 알림 허용)한 대상만 — **구독 토큰 테이블 아직 없음**
 *    (PWA 등록 단계에서 push_subscriptions 마이그레이션 필요 = core, 별도 작업)
 *  - 실패 시 retry.ts(reducePushAttempt)로 1m→5m→30m 재시도, 소진 시 마스터 알림(system_error)
 *
 * 지금은 no-op — 인앱 알림은 위에서 이미 기록되어 사용자 영향 없음.
 */
async function deliverPushBatch(): Promise<void> {
  return;
}
