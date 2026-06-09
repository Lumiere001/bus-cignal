import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOperatorSession } from "@/lib/auth/operator";
import { getPassengerSession } from "@/lib/auth/passenger";
import { getStudentSession } from "@/lib/auth/student";
import type { OperatorClaims } from "@/lib/auth/operator-session";

/**
 * Trip 채팅방 접근 권한 검증 (server-only). SPEC §S6 · §8.
 *
 * ★ 보안 경계: 권한은 **현재 세션 + Supabase 조회로만** 판단한다.
 *   클라이언트가 보낸 role/subjectId/regionId를 절대 신뢰하지 않는다.
 *   Custom Token 발급 경로(app/api/chat/token)와 채팅 페이지가 이 모듈만 사용한다.
 */

export type ChatRole = "passenger" | "operator";

export type ChatAccess = {
  role: ChatRole;
  tripId: string;
  /** Custom Token UID/claim subject — passenger=match_passengers.id, operator=operators.id */
  subjectId: string;
  /** 채팅 메시지에 표시할 이름. 개인정보 중 이름만 사용(전화·토큰 등 비노출). */
  displayName: string;
};

export type ChatTripHeader = {
  tripId: string;
  direction: string;
  departureAt: string;
  originLabel: string;
  destinationLabel: string;
};

/**
 * 학생 채팅 접근권: 본인(name+phone)의 매칭 중 이 trip에 **paid** 상태가 있어야 함.
 * awaiting_payment / payment_reported / cancelled / expired 는 접근 불가.
 */
export async function getPassengerChatAccess(
  passengerId: string,
  tripId: string,
): Promise<ChatAccess | null> {
  const db = createAdminClient();

  // 1. passengerId → 이름+전화 (V1 정책: 동일 이름+전화 = 같은 학생)
  const { data: thisMp } = await db
    .from("match_passengers")
    .select("name, phone")
    .eq("id", passengerId)
    .maybeSingle();

  if (!thisMp) return null;

  // 2. 동일 학생의 모든 match_id
  const { data: allMps } = await db
    .from("match_passengers")
    .select("match_id")
    .eq("phone", thisMp.phone)
    .eq("name", thisMp.name);

  const matchIds = (allMps ?? []).map((m) => m.match_id);
  if (!matchIds.length) return null;

  // 3. 이 trip의 paid 매칭 소유 여부 (채팅은 paid에서만 입장)
  const { data: paidMatch } = await db
    .from("matches")
    .select("id")
    .in("id", matchIds)
    .eq("trip_id", tripId)
    .eq("status", "paid")
    .maybeSingle();

  if (!paidMatch) return null;

  return {
    role: "passenger",
    tripId,
    subjectId: passengerId,
    displayName: thisMp.name,
  };
}

/**
 * CCC 학생(students) 채팅 접근권: 본인 신청(student_id)이 이 trip에서 **paid** 매칭이어야 함.
 *  paid 시 confirmPayment가 만든 match_passengers 행을 채팅 신원으로 그대로 사용한다
 *  → role='passenger' + subjectId=match_passengers.id (Firestore 규칙·UID 체계 변경 불필요,
 *    예약번호(/r) 학생과 동일한 passenger 신원으로 같은 방에 입장).
 */
export async function getStudentChatAccess(
  studentId: string,
  tripId: string,
): Promise<ChatAccess | null> {
  const db = createAdminClient();

  // 1. 이 학생의 이 trip 신청들
  const { data: reqRows } = await db
    .from("seat_requests")
    .select("id")
    .eq("student_id", studentId)
    .eq("trip_id", tripId);
  const requestIds = (reqRows ?? []).map((r) => r.id);
  if (!requestIds.length) return null;

  // 2. 그 신청의 paid 매칭만 (채팅은 paid에서만 입장)
  const { data: paidMatches } = await db
    .from("matches")
    .select("id")
    .eq("trip_id", tripId)
    .in("request_id", requestIds)
    .eq("status", "paid")
    .limit(1);
  const paidMatchId = paidMatches?.[0]?.id;
  if (!paidMatchId) return null;

  // 3. paid 매칭의 학생 검증 레코드 = 채팅 신원(passenger). 전화 등은 노출하지 않음.
  const { data: mpRows } = await db
    .from("match_passengers")
    .select("id, name")
    .eq("match_id", paidMatchId)
    .limit(1);
  const mp = mpRows?.[0];
  if (!mp) return null;

  return {
    role: "passenger",
    tripId,
    subjectId: mp.id,
    displayName: mp.name,
  };
}

/**
 * 간사 채팅 접근권: 공급 지구 또는 (매칭된 학생이 있는) 신청 지구.
 *  - 공급: trips.operator_region_id === 세션 region
 *  - 신청: 이 trip의 seat_requests 중 세션 region 것이 있고, 그 신청에 매칭(matches)이 존재
 */
export async function getOperatorChatAccess(
  op: OperatorClaims,
  tripId: string,
): Promise<ChatAccess | null> {
  if (!op.regionId) return null;
  const db = createAdminClient();

  // trip 존재 + 공급 지구 확인
  const { data: trip } = await db
    .from("trips")
    .select("id, operator_region_id")
    .eq("id", tripId)
    .maybeSingle();

  if (!trip) return null;

  let granted = trip.operator_region_id === op.regionId;

  // 공급 지구가 아니면 신청 지구 여부 확인
  if (!granted) {
    const { data: reqRows } = await db
      .from("seat_requests")
      .select("id")
      .eq("trip_id", tripId)
      .eq("region_id", op.regionId);

    const requestIds = (reqRows ?? []).map((r) => r.id);
    if (requestIds.length) {
      // 그 신청에 실제 매칭된 학생이 있어야 채팅 입장 가능
      const { data: matchRow } = await db
        .from("matches")
        .select("id")
        .eq("trip_id", tripId)
        .in("request_id", requestIds)
        .maybeSingle();
      granted = Boolean(matchRow);
    }
  }

  if (!granted) return null;

  // displayName = 간사 이름 (없으면 '간사'). 전화 등은 조회/노출하지 않음.
  const { data: operator } = await db
    .from("operators")
    .select("name")
    .eq("id", op.operatorId)
    .maybeSingle();

  return {
    role: "operator",
    tripId,
    subjectId: op.operatorId,
    displayName: operator?.name ?? "간사",
  };
}

/**
 * 현재 세션(학생 우선, 없으면 간사)으로 이 trip 채팅 접근권을 판단. 없으면 null.
 * 클라이언트 입력은 tripId 외에 아무것도 받지 않는다.
 */
export async function resolveChatAccess(
  tripId: string,
): Promise<ChatAccess | null> {
  const passenger = await getPassengerSession();
  if (passenger) {
    const access = await getPassengerChatAccess(passenger.passengerId, tripId);
    if (access) return access;
  }

  // CCC 학생 세션(/s) — paid 매칭이면 passenger 신원으로 입장(getStudentChatAccess).
  const student = await getStudentSession();
  if (student) {
    const access = await getStudentChatAccess(student.studentId, tripId);
    if (access) return access;
  }

  const operator = await getOperatorSession();
  if (operator) {
    const access = await getOperatorChatAccess(operator, tripId);
    if (access) return access;
  }

  return null;
}

/**
 * 채팅 헤더용 trip 요약(노선·출발 시각·장소 라벨). 접근권 검증 **후**에만 호출.
 * 개인정보는 포함하지 않는다.
 */
export async function getChatTripHeader(
  tripId: string,
): Promise<ChatTripHeader | null> {
  const db = createAdminClient();

  const { data: trip } = await db
    .from("trips")
    .select(
      "id, direction, departure_at, origin_location_id, destination_location_id",
    )
    .eq("id", tripId)
    .maybeSingle();

  if (!trip) return null;

  const { data: locRows } = await db
    .from("region_locations")
    .select("id, label, address")
    .in("id", [trip.origin_location_id, trip.destination_location_id]);

  const locMap = new Map((locRows ?? []).map((l) => [l.id, l]));
  const origin = locMap.get(trip.origin_location_id);
  const dest = locMap.get(trip.destination_location_id);

  return {
    tripId: trip.id,
    direction: trip.direction,
    departureAt: trip.departure_at,
    originLabel: origin?.label ?? origin?.address ?? "출발지",
    destinationLabel: dest?.label ?? dest?.address ?? "도착지",
  };
}
