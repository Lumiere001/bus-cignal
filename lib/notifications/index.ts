import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPushConfigured } from "@/lib/firebase/admin";
import type { Database } from "@/lib/supabase/database.types";
import type {
  NotificationEvent,
  PayloadFor,
  RecipientsFor,
} from "./events";
import { formatPush, pushLink, sendPush } from "./push";
import { isRetryDue, reducePushAttempt } from "./retry";
import {
  resolveTargets,
  expandOperatorTargets,
  approvedOperatorIdsForRegions,
} from "./targets";
import { reportOpsIssue } from "@/lib/ops/report-issue";

export { NOTIFICATION_EVENTS } from "./events";
export type {
  NotificationEvent,
  NotificationPayloads,
  PayloadFor,
  RecipientsFor,
  RecipientSlots,
} from "./events";
export { resolveTargets, approvedOperatorIdsForRegions } from "./targets";
export type { ResolvedTarget } from "./targets";
export {
  isExhausted,
  isRetryDue,
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
 *  - push !== false 대상은 push row(pending)도 생성 후 발송 시도(deliverPushBatch)
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
  const baseTargets = resolveTargets(event, recipients, opts.push !== false);
  if (baseTargets.length === 0) return;

  const db = createAdminClient();

  // 같은 지구 간사 전원에게 — operator 대상을 그 지구의 모든 승인 간사로 확장 (사용자 요청 2026-06-10).
  //   best-effort: 조회 실패 시 원본 대상 유지(최소한 등록·신청 당사자에겐 전달).
  let targets = baseTargets;
  try {
    const opIds = [
      ...new Set(
        baseTargets.filter((t) => t.operatorId).map((t) => t.operatorId as string),
      ),
    ];
    if (opIds.length > 0) {
      const { data: ops } = await db
        .from("operators")
        .select("region_id")
        .in("id", opIds);
      const regionIds = [
        ...new Set((ops ?? []).map((o) => o.region_id).filter(Boolean)),
      ] as string[];
      if (regionIds.length > 0) {
        targets = expandOperatorTargets(
          baseTargets,
          await approvedOperatorIdsForRegions(db, regionIds),
        );
      }
    }
  } catch {
    targets = baseTargets;
  }

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

  await db.from("notifications").insert(rows);

  if (rows.some((row) => row.channel === "push")) {
    await deliverPushBatch();
  }

  // 운영 이상(system_error) → GitHub 이슈 자동 생성 (베스트에포트·게이트 미설정 시 no-op).
  // 인앱 알림 본 처리와 독립 — 실패해도 emit은 정상 종료.
  if (event === "system_error") {
    const p = payload as PayloadFor<"system_error">;
    await reportOpsIssue({
      title: `🚨 운영 이상: ${p.context}`,
      fingerprint: `system_error:${p.context}`,
      body: [
        "자동 감지된 운영 이상입니다 (notifications.emit system_error).",
        "",
        `- context: \`${p.context}\``,
        `- detail: \`${p.detail ?? "-"}\``,
        `- 감지(UTC): ${now}`,
      ].join("\n"),
    });
  }
}

type PushRow = {
  id: string;
  operator_id: string | null;
  passenger_id: string | null;
  type: string;
  payload: Database["public"]["Tables"]["notifications"]["Row"]["payload"];
  retry_count: number;
  last_attempt_at: string | null;
};

type AdminDb = ReturnType<typeof createAdminClient>;

export type DeliverSummary = {
  attempted: number;
  sent: number;
  pending: number;
  failed: number;
};

/**
 * pending push row 발송/재시도 — SPEC §8 · §9.5.
 *
 * emit() 직후(초기 발송) + daily cron(/api/cron/push-retry, payment-reminder piggyback)에서 호출.
 * 매 호출마다 "발송 시점이 된(isRetryDue)" pending push를 모두 시도하므로, 알림 활동이 있는
 * 동안에는 cron 없이도 due 재시도가 자가 치유된다.
 *
 *  - 수신자(operator/passenger)의 push_subscriptions 토큰으로 FCM multicast 발송
 *  - 결과 → reducePushAttempt 로 sent | pending(retry_count+1) | failed(소진→마스터 알림)
 *  - 무효 토큰은 구독에서 제거
 *  - 구독 토큰이 아예 없으면(옵트아웃) 재시도 의미 없음 → sent 처리(인앱은 이미 전달됨)
 *
 * env 미구성(NEXT_PUBLIC_FIREBASE_PROJECT_ID 등 없음)이면 no-op — 인앱 알림은 영향 없음.
 */
export async function deliverPushBatch(limit = 500): Promise<DeliverSummary> {
  const summary: DeliverSummary = { attempted: 0, sent: 0, pending: 0, failed: 0 };
  if (!isPushConfigured()) return summary;

  const db = createAdminClient();
  const { data: pendingRows } = await db
    .from("notifications")
    .select("id, operator_id, passenger_id, type, payload, retry_count, last_attempt_at")
    .eq("channel", "push")
    .eq("delivery_status", "pending")
    .limit(limit);

  const now = Date.now();
  const due = (pendingRows ?? []).filter((r) =>
    isRetryDue(r.retry_count, r.last_attempt_at, now),
  );

  for (const row of due) {
    const status = await deliverOne(db, row);
    summary.attempted++;
    summary[status]++;
  }
  return summary;
}

/** push row 한 건 발송 + 상태 전이. 반환 = 전이된 상태. */
async function deliverOne(
  db: AdminDb,
  row: PushRow,
): Promise<"sent" | "pending" | "failed"> {
  const attemptedAt = new Date().toISOString();
  const tokens = await tokensFor(db, row.operator_id, row.passenger_id);

  // 구독 토큰 없음 = 옵트아웃 → 보낼 곳 없음. 재시도 무의미하니 resolve(no-op).
  if (tokens.length === 0) {
    await db
      .from("notifications")
      .update({ delivery_status: "sent", last_attempt_at: attemptedAt })
      .eq("id", row.id);
    return "sent";
  }

  let ok = false;
  let invalidTokens: string[] = [];
  try {
    const res = await sendPush(tokens, formatPush(row.type, row.payload), {
      type: row.type,
      payload: JSON.stringify(row.payload ?? {}),
      link: pushLink(row.type, row.payload),
    });
    ok = res.successCount > 0;
    invalidTokens = res.invalidTokens;
  } catch {
    ok = false; // 네트워크·SDK 에러 → 실패로 보고 재시도 경로
  }

  if (invalidTokens.length > 0) {
    await db.from("push_subscriptions").delete().in("token", invalidTokens);
  }

  const result = reducePushAttempt(row.retry_count, ok);
  if (result.status === "sent") {
    await db
      .from("notifications")
      .update({ delivery_status: "sent", sent_at: attemptedAt, last_attempt_at: attemptedAt })
      .eq("id", row.id);
    return "sent";
  }
  if (result.status === "pending") {
    await db
      .from("notifications")
      .update({ retry_count: result.retryCount, last_attempt_at: attemptedAt })
      .eq("id", row.id);
    return "pending";
  }

  // failed — 재시도 소진. 마스터에 system_error (인앱만, 푸시 row 안 생김 → 재귀 X).
  await db
    .from("notifications")
    .update({ delivery_status: "failed", retry_count: result.retryCount, last_attempt_at: attemptedAt })
    .eq("id", row.id);
  await emit(
    "system_error",
    { master: true },
    { context: "push_delivery_exhausted", detail: row.id },
  );
  return "failed";
}

/** 수신자(operator XOR passenger)의 활성 푸시 토큰. 마스터(둘 다 null)는 항상 빈 배열. */
async function tokensFor(
  db: AdminDb,
  operatorId: string | null,
  passengerId: string | null,
): Promise<string[]> {
  if (operatorId) {
    const { data } = await db
      .from("push_subscriptions")
      .select("token")
      .eq("operator_id", operatorId);
    return (data ?? []).map((r) => r.token);
  }
  if (passengerId) {
    const { data } = await db
      .from("push_subscriptions")
      .select("token")
      .eq("passenger_id", passengerId);
    return (data ?? []).map((r) => r.token);
  }
  return [];
}
