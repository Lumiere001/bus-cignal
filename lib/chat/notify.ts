import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { emit } from "@/lib/notifications";
import { getMutedSubjects } from "@/lib/chat/mutes";
import type { ChatRole } from "@/lib/chat/access";

/**
 * 채팅 새 메시지 푸시 fan-out (server-only). SPEC §8 chat_message.
 *
 * 메시지 자체는 클라이언트가 Firestore에 직접 쓴다(이 모듈은 발송 X). 여기서는
 * 메시지가 성공적으로 전송된 뒤 `/api/chat/notify` 가 호출해, 이 trip 채팅의
 * **보낸 사람을 제외한** 모든 참여자에게 chat_message 알림(인앱+푸시)을 발송한다.
 *
 * ★ 설계: DB 조회(resolveChatRecipients)와 emit 루프(notifyChatRecipients)를 분리해
 *   조회 부분을 mock DB로 단위 테스트할 수 있게 한다.
 *   푸시 미구성 시 emit 안의 deliverPushBatch가 no-op이라 이 변경은 무해(인앱만 기록).
 */

/** 채팅 메시지를 보낸 주체. /api/chat/token 과 동일한 식별 체계. */
export type ChatSender = {
  role: ChatRole;
  /** operator=operators.id, passenger=match_passengers.id */
  subjectId: string;
};

/**
 * chat_message 한 건의 수신자 — emit 슬롯 하나에 대응.
 * `muted` = 이 수신자가 방 푸시를 껐는지(chat_mutes). true면 푸시 제외, 인앱은 유지.
 */
export type ChatRecipient =
  | { kind: "supplyOperator"; operatorId: string; muted: boolean }
  | { kind: "requestOperator"; operatorId: string; muted: boolean }
  | { kind: "passenger"; passengerId: string; muted: boolean };

/** 활성(채팅 참여) 신청 상태 — 거절·취소는 채팅 대상 아님. */
const ACTIVE_REQUEST_STATUSES = ["queued", "matched"] as const;

/**
 * 이 trip 채팅의 수신자 집합을 DB에서 해석하고, **보낸 사람을 제외**한다.
 *  - 공급 간사: trips.created_by
 *  - 신청 간사: 이 trip의 활성(queued/matched) seat_requests.operator_id (중복 제거)
 *  - 학생: 이 trip의 paid 매칭에 묶인 match_passengers.id
 *
 * 순수 조회만 — emit은 하지 않는다(테스트 용이성). DB 오류 시 빈 배열(best-effort).
 */
export async function resolveChatRecipients(
  tripId: string,
  sender: ChatSender,
): Promise<ChatRecipient[]> {
  const db = createAdminClient();
  const recipients: ChatRecipient[] = [];

  const senderIsOperator = sender.role === "operator";
  const senderIsPassenger = sender.role === "passenger";

  // 방 음소거(푸시 OFF) 소유자 집합 — 각 수신자의 muted 플래그로 사용(인앱은 유지).
  const muted = await getMutedSubjects(db, tripId);

  // 1. 공급 간사 — trips.created_by
  const { data: trip } = await db
    .from("trips")
    .select("created_by")
    .eq("id", tripId)
    .maybeSingle();

  const supplyOperatorId = trip?.created_by ?? null;
  if (
    supplyOperatorId &&
    !(senderIsOperator && supplyOperatorId === sender.subjectId)
  ) {
    recipients.push({
      kind: "supplyOperator",
      operatorId: supplyOperatorId,
      muted: muted.operatorIds.has(supplyOperatorId),
    });
  }

  // 2. 신청 간사 — 활성 seat_requests.operator_id (공급 간사·보낸 사람·중복 제외)
  const { data: requestRows } = await db
    .from("seat_requests")
    .select("operator_id")
    .eq("trip_id", tripId)
    .in("status", [...ACTIVE_REQUEST_STATUSES]);

  const seenOperatorIds = new Set<string>();
  if (supplyOperatorId) seenOperatorIds.add(supplyOperatorId);
  for (const row of requestRows ?? []) {
    const operatorId = row.operator_id;
    if (!operatorId) continue;
    if (seenOperatorIds.has(operatorId)) continue; // 공급과 동일 or 중복 신청
    if (senderIsOperator && operatorId === sender.subjectId) continue; // 보낸 사람
    seenOperatorIds.add(operatorId);
    recipients.push({
      kind: "requestOperator",
      operatorId,
      muted: muted.operatorIds.has(operatorId),
    });
  }

  // 3. 학생 — 이 trip의 paid 매칭에 묶인 match_passengers.id
  const { data: paidMatches } = await db
    .from("matches")
    .select("id")
    .eq("trip_id", tripId)
    .eq("status", "paid");

  const matchIds = (paidMatches ?? []).map((m) => m.id);
  if (matchIds.length > 0) {
    const { data: passengerRows } = await db
      .from("match_passengers")
      .select("id")
      .in("match_id", matchIds);

    for (const row of passengerRows ?? []) {
      const passengerId = row.id;
      if (!passengerId) continue;
      if (senderIsPassenger && passengerId === sender.subjectId) continue; // 보낸 사람
      recipients.push({
        kind: "passenger",
        passengerId,
        muted: muted.passengerIds.has(passengerId),
      });
    }
  }

  return recipients;
}

/**
 * 해석된 수신자 각각에게 chat_message 를 한 건씩 발송(fan-out).
 * 한 슬롯만 채우고 나머지는 null → emit/resolveTargets가 그 대상만 만든다.
 * 각 emit은 try/catch로 감싸 한 건 실패가 나머지를 막지 않게 한다(best-effort).
 *
 * 음소거(muted=true) 수신자는 `{ push: false }` → 푸시 row를 만들지 않는다(인앱은 그대로).
 */
export async function notifyChatRecipients(
  tripId: string,
  recipients: ChatRecipient[],
  preview?: string,
): Promise<void> {
  // chat_message 페이로드 — preview는 미리보기 문구(없으면 formatPush가 기본 문구 사용).
  const payload: { tripId: string; preview?: string } = { tripId, preview };
  for (const r of recipients) {
    const opts = { push: !r.muted };
    try {
      switch (r.kind) {
        case "supplyOperator":
          await emit(
            "chat_message",
            {
              supplyOperatorId: r.operatorId,
              requestOperatorId: null,
              passengerId: null,
            },
            payload,
            opts,
          );
          break;
        case "requestOperator":
          await emit(
            "chat_message",
            {
              supplyOperatorId: null,
              requestOperatorId: r.operatorId,
              passengerId: null,
            },
            payload,
            opts,
          );
          break;
        case "passenger":
          await emit(
            "chat_message",
            {
              supplyOperatorId: null,
              requestOperatorId: null,
              passengerId: r.passengerId,
            },
            payload,
            opts,
          );
          break;
      }
    } catch {
      // best-effort — 한 수신자 발송 실패가 나머지 fan-out을 막지 않는다.
    }
  }
}

/**
 * 진입점 — tripId + 보낸 사람으로 수신자를 해석하고(보낸 사람 제외) 각각에 fan-out.
 * 메시지 전송과 독립(secondary) — 실패해도 채팅은 정상.
 */
export async function notifyChatMessage(
  tripId: string,
  sender: ChatSender,
  preview?: string,
): Promise<void> {
  const recipients = await resolveChatRecipients(tripId, sender);
  await notifyChatRecipients(tripId, recipients, preview);
}
