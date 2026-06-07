import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { ChatRole } from "@/lib/chat/access";

/**
 * 채팅방(trip)별 푸시 음소거 토글 helper (server-only). 보안점검 Finding 3.
 *
 * 데이터: chat_mutes(trip_id, operator_id|passenger_id, muted). 소유자 = operator XOR passenger.
 *   · row 없음 = 음소거 아님(푸시 받음)이 기본.
 *   · 음소거는 **푸시(deliverPushBatch)만** 끈다 — 인앱 알림(notifications in_app)은 유지.
 *
 * 식별: notify fan-out의 수신자 id 체계와 동일.
 *   · operator → operators.id
 *   · passenger → match_passengers.id (= 채팅 토큰 subjectId)
 * (한 학생이 여러 버스에 타 session subjectId가 이 trip의 match_passengers.id와 다른 희귀 케이스는
 *  notify의 보낸-사람 제외 로직과 동일한 식별 한계를 공유한다 — V1 동일 동작.)
 */

type AdminClient = ReturnType<typeof createAdminClient>;

export type ChatMuteSubject = { role: ChatRole; subjectId: string };

function ownerColumn(role: ChatRole): "operator_id" | "passenger_id" {
  return role === "operator" ? "operator_id" : "passenger_id";
}

/**
 * 이 trip에서 음소거(푸시 OFF)한 소유자 집합. notify fan-out의 push 제외 판단에 사용.
 * DB 오류 시 빈 집합(best-effort) — 음소거 조회 실패가 알림 자체를 막지 않음.
 */
export async function getMutedSubjects(
  db: AdminClient,
  tripId: string,
): Promise<{ operatorIds: Set<string>; passengerIds: Set<string> }> {
  const operatorIds = new Set<string>();
  const passengerIds = new Set<string>();

  const { data } = await db
    .from("chat_mutes")
    .select("operator_id, passenger_id")
    .eq("trip_id", tripId)
    .eq("muted", true);

  for (const row of data ?? []) {
    if (row.operator_id) operatorIds.add(row.operator_id);
    if (row.passenger_id) passengerIds.add(row.passenger_id);
  }
  return { operatorIds, passengerIds };
}

/** 한 소유자의 현재 음소거 상태. row 없음 → false(푸시 받음). */
export async function getMuteState(
  db: AdminClient,
  tripId: string,
  subject: ChatMuteSubject,
): Promise<boolean> {
  const { data } = await db
    .from("chat_mutes")
    .select("muted")
    .eq("trip_id", tripId)
    .eq(ownerColumn(subject.role), subject.subjectId)
    .maybeSingle();
  return Boolean(data?.muted);
}

/**
 * 음소거 토글 set. 부분 unique 인덱스(소유자 한쪽만 non-null)라 on-conflict 추론이 까다로워
 * select-후-insert/update 로 멱등하게 처리한다(본인 토글이라 race 거의 없음).
 */
export async function setMuteState(
  db: AdminClient,
  tripId: string,
  subject: ChatMuteSubject,
  muted: boolean,
): Promise<void> {
  const col = ownerColumn(subject.role);

  const { data: existing } = await db
    .from("chat_mutes")
    .select("id")
    .eq("trip_id", tripId)
    .eq(col, subject.subjectId)
    .maybeSingle();

  if (existing?.id) {
    await db
      .from("chat_mutes")
      .update({ muted, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    return;
  }

  await db.from("chat_mutes").insert({
    trip_id: tripId,
    operator_id: subject.role === "operator" ? subject.subjectId : null,
    passenger_id: subject.role === "passenger" ? subject.subjectId : null,
    muted,
  });
}
