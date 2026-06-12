import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  LOCAL_SUPABASE_URL,
  LOCAL_SERVICE_ROLE_KEY,
  assertLocalSupabase,
} from "./env";

assertLocalSupabase();

/** 로컬 supabase service_role 클라이언트 (E2E 픽스처 전용 — RLS 우회). */
export const db: SupabaseClient = createClient(
  LOCAL_SUPABASE_URL,
  LOCAL_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function regionIdByCode(code: string): Promise<string> {
  const { data, error } = await db
    .from("regions")
    .select("id")
    .eq("code", code)
    .single();
  if (error || !data) throw new Error(`지구 코드 ${code} 없음 (seed 확인)`);
  return data.id as string;
}

async function operatorIdByCccId(cccId: string): Promise<string> {
  const { data, error } = await db
    .from("operators")
    .select("id")
    .eq("ccc_id", cccId)
    .single();
  if (error || !data) throw new Error(`간사 ${cccId} 없음 (seed:dev 확인)`);
  return data.id as string;
}

function shortCode(): string {
  // 예약번호 패턴 ^[A-Z0-9]{1,10}-[A-Z0-9]{1,10}$ 충족 + 충돌 회피용 랜덤.
  const rnd = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `E2E-${rnd}`;
}

/** 광주(공급) 간사가 소유한 published trip + 부산(수요) 큐 신청 1건을 격리 생성. */
export interface ApproveScenario {
  tripId: string;
  offerId: string;
  requestId: string;
  passengerIds: string[];
  cleanup: () => Promise<void>;
}

export async function createApproveScenario(
  opts: { passengers?: number; capacity?: number; offered?: number } = {},
): Promise<ApproveScenario> {
  const passengers = opts.passengers ?? 2;
  const gwangju = await regionIdByCode("2601"); // 광주 = 공급 (seed 간사 소유 지구)
  const busan = await regionIdByCode("2801"); // 부산 = 수요
  const busanOp = await operatorIdByCccId("dev-op-busan");
  const gwangjuOp = await operatorIdByCccId("dev-op-gwangju");

  const tripId = randomUUID();
  const offerId = randomUUID();
  const requestId = randomUUID();
  const passengerIds = Array.from({ length: passengers }, () => randomUUID());

  // seed의 광주 출발/도착지 재사용 (b0000…01 평창 → b0000…02 광주, 하행)
  await db.from("trips").insert({
    id: tripId,
    operator_region_id: gwangju,
    direction: "down",
    origin_location_id: "b0000000-0000-0000-0000-000000000001",
    destination_location_id: "b0000000-0000-0000-0000-000000000002",
    departure_at: new Date(Date.now() + 30 * 864e5).toISOString(),
    capacity: opts.capacity ?? 44,
    price_per_seat: 35000,
    note: "[E2E] 격리 시나리오 trip",
    status: "published",
    created_by: gwangjuOp,
  });
  await db.from("seat_offers").insert({
    id: offerId,
    trip_id: tripId,
    seat_count: opts.offered ?? 10,
    status: "open",
  });
  await db.from("seat_requests").insert({
    id: requestId,
    trip_id: tripId,
    region_id: busan,
    operator_id: busanOp,
    seat_count: passengers,
    status: "queued",
    consent_confirmed_at: new Date().toISOString(),
    consent_confirmed_by: busanOp,
    requested_at: new Date().toISOString(),
  });
  await db.from("request_passengers").insert(
    passengerIds.map((id, i) => ({
      id,
      request_id: requestId,
      name: `E2E학생${i + 1}`,
      phone: `010-9000-${String(1000 + i).slice(-4)}`,
      school_or_role: "E2E대",
      priority: i + 1,
    })),
  );

  const cleanup = async () => {
    await db.from("matches").delete().eq("trip_id", tripId);
    await db.from("rejection_log").delete().eq("seat_request_id", requestId);
    await db.from("request_passengers").delete().eq("request_id", requestId);
    await db.from("seat_requests").delete().eq("id", requestId);
    await db.from("seat_offers").delete().eq("trip_id", tripId);
    await db.from("trips").delete().eq("id", tripId);
  };

  return { tripId, offerId, requestId, passengerIds, cleanup };
}

/** /r 학생 진입 테스트용 — paid 매칭 + 예약번호 + match_passengers를 격리 생성. */
export interface PaidMatchScenario {
  tripId: string;
  requestId: string;
  matchId: string;
  code: string;
  name: string;
  phoneLast4: string;
  cleanup: () => Promise<void>;
}

export async function createPaidMatchScenario(): Promise<PaidMatchScenario> {
  const base = await createApproveScenario({ passengers: 1 });
  const matchId = randomUUID();
  const code = shortCode();
  const name = "이지은E2E";
  const phone = "010-3333-9999";

  await db.from("matches").insert({
    id: matchId,
    trip_id: base.tripId,
    request_id: base.requestId,
    passenger_id: base.passengerIds[0],
    status: "paid",
    payment_reported_at: new Date(Date.now() - 36e5).toISOString(),
    paid_at: new Date(Date.now() - 18e5).toISOString(),
    reservation_code: code,
  });
  await db.from("match_passengers").insert({
    match_id: matchId,
    name,
    phone,
    school_or_role: "부산대",
  });
  await db.from("seat_requests").update({ status: "matched" }).eq("id", base.requestId);

  const cleanup = async () => {
    await db.from("reservation_verify_attempts").delete().eq("code", code);
    await db.from("match_passengers").delete().eq("match_id", matchId);
    await db.from("matches").delete().eq("id", matchId);
    await base.cleanup();
  };

  return {
    tripId: base.tripId,
    requestId: base.requestId,
    matchId,
    code,
    name,
    phoneLast4: phone.slice(-4),
    cleanup,
  };
}

/** rate-limit 등 부수효과 정리용. */
export async function clearVerifyAttempts(code: string): Promise<void> {
  await db.from("reservation_verify_attempts").delete().eq("code", code);
}

/** 가입 승인 대기(pending) 간사 1명 격리 생성 — 마스터 승인 흐름 테스트용. */
export async function createPendingOperator(): Promise<{
  id: string;
  name: string;
  cleanup: () => Promise<void>;
}> {
  const busan = await regionIdByCode("2801"); // 신청 지구(승인 시 소속으로 확정)
  const id = randomUUID();
  const name = `E2E대기간사${randomUUID().slice(0, 4)}`;
  await db.from("operators").insert({
    id,
    name,
    requested_region_id: busan,
    approval_status: "pending",
  });
  const cleanup = async () => {
    await db.from("operators").delete().eq("id", id);
  };
  return { id, name, cleanup };
}

// ─── 학생 직접 신청(CCC 학생) 픽스처 ─────────────────────────────────────────────

/** seed-dev.sql의 CCC 학생(최학생, 부산 2801). */
export const STUDENT_DEV_ID = "f5000000-0000-0000-0000-000000000001";
const STUDENT_DEV_NAME = "최학생";
const STUDENT_DEV_PHONE = "010-7777-0001";

/**
 * 광주(공급) 소유 published trip + open offer를 **고유 라벨**로 격리 생성.
 * 라벨이 고유해 /s/apply 목록·채팅 헤더에서 이 차량만 선택/검증 가능.
 */
export interface StudentTripScenario {
  tripId: string;
  originLabel: string;
  destLabel: string;
  cleanup: () => Promise<void>;
}

export async function createStudentTrip(): Promise<StudentTripScenario> {
  const gwangju = await regionIdByCode("2601");
  const gwangjuOp = await operatorIdByCccId("dev-op-gwangju");
  const tag = randomUUID().replace(/-/g, "").slice(0, 6);
  const originLabel = `E2E학생출발${tag}`;
  const destLabel = `E2E학생도착${tag}`;

  const tripId = randomUUID();
  const originLoc = randomUUID();
  const destLoc = randomUUID();
  const offerId = randomUUID();

  await db.from("region_locations").insert([
    {
      id: originLoc,
      region_id: gwangju,
      direction: "down",
      location_type: "origin",
      address: "강원 평창군 봉평면",
      label: originLabel,
      lat: 37.6,
      lng: 128.7,
      created_by: gwangjuOp,
    },
    {
      id: destLoc,
      region_id: gwangju,
      direction: "down",
      location_type: "destination",
      address: "광주 동구 충장로",
      label: destLabel,
      lat: 35.15,
      lng: 126.91,
      created_by: gwangjuOp,
    },
  ]);
  await db.from("trips").insert({
    id: tripId,
    operator_region_id: gwangju,
    direction: "down",
    origin_location_id: originLoc,
    destination_location_id: destLoc,
    departure_at: new Date(Date.now() + 30 * 864e5).toISOString(),
    capacity: 44,
    price_per_seat: 35000,
    note: "[E2E] 학생 직접신청 trip",
    status: "published",
    created_by: gwangjuOp,
  });
  await db
    .from("seat_offers")
    .insert({ id: offerId, trip_id: tripId, seat_count: 5, status: "open" });

  const cleanup = async () => {
    await db.from("matches").delete().eq("trip_id", tripId);
    const { data: reqs } = await db
      .from("seat_requests")
      .select("id")
      .eq("trip_id", tripId);
    const ids = (reqs ?? []).map((r) => r.id);
    if (ids.length) {
      await db.from("request_passengers").delete().in("request_id", ids);
      await db.from("seat_requests").delete().in("id", ids);
    }
    await db.from("seat_offers").delete().eq("trip_id", tripId);
    await db.from("trips").delete().eq("id", tripId);
    await db.from("region_locations").delete().in("id", [originLoc, destLoc]);
  };

  return { tripId, originLabel, destLabel, cleanup };
}

/** 학생(STUDENT_DEV) 직접 신청 1건을 trip에 격리 삽입(승인 큐 배지·승인 테스트용). */
export async function seedStudentRequest(
  tripId: string,
  status: "queued" | "matched" = "queued",
): Promise<{ requestId: string; passengerId: string; name: string }> {
  const busan = await regionIdByCode("2801");
  const requestId = randomUUID();
  const passengerId = randomUUID();
  await db.from("seat_requests").insert({
    id: requestId,
    trip_id: tripId,
    region_id: busan,
    requester_kind: "student",
    student_id: STUDENT_DEV_ID,
    seat_count: 1,
    status,
    consent_confirmed_at: new Date().toISOString(),
    requested_at: new Date().toISOString(),
  });
  await db.from("request_passengers").insert({
    id: passengerId,
    request_id: requestId,
    name: STUDENT_DEV_NAME,
    phone: STUDENT_DEV_PHONE,
    school_or_role: "부산대",
    priority: 1,
  });
  return { requestId, passengerId, name: STUDENT_DEV_NAME };
}

/** 학생 paid 매칭 시나리오 — /s 예약확정·예약번호·채팅 입장 검증용. */
export interface StudentPaidScenario {
  tripId: string;
  originLabel: string;
  destLabel: string;
  code: string;
  name: string;
  cleanup: () => Promise<void>;
}

export async function createStudentPaidScenario(): Promise<StudentPaidScenario> {
  const trip = await createStudentTrip();
  const { requestId, passengerId, name } = await seedStudentRequest(
    trip.tripId,
    "matched",
  );
  const matchId = randomUUID();
  const code = shortCode();

  await db.from("matches").insert({
    id: matchId,
    trip_id: trip.tripId,
    request_id: requestId,
    passenger_id: passengerId,
    status: "paid",
    payment_due_at: new Date(Date.now() + 864e5).toISOString(),
    payment_reported_at: new Date(Date.now() - 36e5).toISOString(),
    paid_at: new Date(Date.now() - 18e5).toISOString(),
    reservation_code: code,
  });
  await db.from("match_passengers").insert({
    match_id: matchId,
    name,
    phone: STUDENT_DEV_PHONE,
    school_or_role: "부산대",
  });

  return {
    tripId: trip.tripId,
    originLabel: trip.originLabel,
    destLabel: trip.destLabel,
    code,
    name,
    cleanup: trip.cleanup,
  };
}

// ─── 버스 미배정 대기큐(#region-wait-queue) 픽스처 ──────────────────────────────

/** 대기큐 시나리오 지구 — seed-dev의 김대전(dev-op-daejeon) 소속, 버스를 안 올린 지구. */
export const WAIT_REGION_CODE = "2401"; // 대전지구

/**
 * 대전 대기큐 잔재 제거 — wait_region_id=대전인 seat_requests 전부(배정된 것 포함) 삭제.
 * wait_region_id는 trip 배정 후에도 이력으로 남으므로, 배정돼 trip_id가 채워진 행도 잡힌다.
 * UI로 생성돼 id를 모르는 신청의 정리 + 재실행 시 학생 중복 가드 오작동 방지용.
 */
export async function purgeWaitQueueRequests(): Promise<void> {
  const region = await regionIdByCode(WAIT_REGION_CODE);
  const { data: reqs } = await db
    .from("seat_requests")
    .select("id")
    .eq("wait_region_id", region);
  const ids = (reqs ?? []).map((r) => r.id as string);
  if (ids.length === 0) return;
  await db.from("matches").delete().in("request_id", ids);
  await db.from("rejection_log").delete().in("seat_request_id", ids);
  await db.from("request_passengers").delete().in("request_id", ids);
  await db.from("seat_requests").delete().in("id", ids);
}

/**
 * 대전(공급) 간사 소유 published trip(가는편) + 기존 큐 신청 1건(학생 2명)을 격리 생성.
 * 대기 신청을 이 trip으로 배정(assignWaitToTrip)했을 때 시간순 큐에 "기존 신청과 섞여"
 * 정렬되는지 검증하기 위해 기존 학생 2명의 개인 시각(applied_at)을 대기 신청 시각(테스트
 * 실행 시점) 앞뒤로 벌려둔다: early(-3h) < 대기 신청(now께) < late(+30m).
 */
export interface WaitQueueSupplyScenario {
  tripId: string;
  originLabel: string;
  destLabel: string;
  /** 대기 신청보다 먼저 신청한 기존 학생 (applied_at = now-3h) */
  earlyName: string;
  /** 대기 신청보다 늦게 신청한 기존 학생 (applied_at = now+30m) */
  lateName: string;
  cleanup: () => Promise<void>;
}

export async function createWaitQueueSupplyScenario(): Promise<WaitQueueSupplyScenario> {
  const daejeon = await regionIdByCode(WAIT_REGION_CODE);
  const busan = await regionIdByCode("2801");
  const daejeonOp = await operatorIdByCccId("dev-op-daejeon");
  const busanOp = await operatorIdByCccId("dev-op-busan");
  const tag = randomUUID().replace(/-/g, "").slice(0, 6);
  const originLabel = `E2E대전출발${tag}`;
  const destLabel = `E2E평창도착${tag}`;
  const earlyName = `E2E기존A${tag}`;
  const lateName = `E2E기존B${tag}`;

  const tripId = randomUUID();
  const originLoc = randomUUID();
  const destLoc = randomUUID();
  const offerId = randomUUID();
  const requestId = randomUUID();
  const earlyPaxId = randomUUID();
  const latePaxId = randomUUID();

  // 가는편(up): 대전 → 평창. 대기 신청(위저드 기본 방향 up)과 방향이 일치해야 배정 후보가 된다.
  await db.from("region_locations").insert([
    {
      id: originLoc,
      region_id: daejeon,
      direction: "up",
      location_type: "origin",
      address: "대전 서구 둔산동",
      label: originLabel,
      lat: 36.35,
      lng: 127.38,
      created_by: daejeonOp,
    },
    {
      id: destLoc,
      region_id: daejeon,
      direction: "up",
      location_type: "destination",
      address: "강원 평창군 봉평면",
      label: destLabel,
      lat: 37.6,
      lng: 128.7,
      created_by: daejeonOp,
    },
  ]);
  await db.from("trips").insert({
    id: tripId,
    operator_region_id: daejeon,
    direction: "up",
    origin_location_id: originLoc,
    destination_location_id: destLoc,
    departure_at: new Date(Date.now() + 30 * 864e5).toISOString(),
    capacity: 44,
    price_per_seat: 30000,
    note: "[E2E] 대기큐 배정 대상 trip",
    status: "published",
    created_by: daejeonOp,
  });
  await db
    .from("seat_offers")
    .insert({ id: offerId, trip_id: tripId, seat_count: 10, status: "open" });

  // 기존 큐 신청(부산 간사) — early/late 두 학생의 applied_at으로 시간순 섞임을 만든다.
  await db.from("seat_requests").insert({
    id: requestId,
    trip_id: tripId,
    region_id: busan,
    operator_id: busanOp,
    seat_count: 2,
    status: "queued",
    consent_confirmed_at: new Date().toISOString(),
    consent_confirmed_by: busanOp,
    requested_at: new Date(Date.now() - 3 * 36e5).toISOString(),
  });
  await db.from("request_passengers").insert([
    {
      id: earlyPaxId,
      request_id: requestId,
      name: earlyName,
      phone: "010-9100-0001",
      school_or_role: "E2E대",
      priority: 1,
      applied_at: new Date(Date.now() - 3 * 36e5).toISOString(),
    },
    {
      id: latePaxId,
      request_id: requestId,
      name: lateName,
      phone: "010-9100-0002",
      school_or_role: "E2E대",
      priority: 2,
      applied_at: new Date(Date.now() + 30 * 6e4).toISOString(),
    },
  ]);

  const cleanup = async () => {
    // trip 기반 정리 — 배정된 대기 신청(trip_id=이 trip)도 함께 잡힌다.
    await db.from("matches").delete().eq("trip_id", tripId);
    const { data: reqs } = await db
      .from("seat_requests")
      .select("id")
      .eq("trip_id", tripId);
    const ids = (reqs ?? []).map((r) => r.id as string);
    if (ids.length) {
      await db.from("rejection_log").delete().in("seat_request_id", ids);
      await db.from("request_passengers").delete().in("request_id", ids);
      await db.from("seat_requests").delete().in("id", ids);
    }
    await db.from("seat_offers").delete().eq("trip_id", tripId);
    await db.from("trips").delete().eq("id", tripId);
    await db.from("region_locations").delete().in("id", [originLoc, destLoc]);
    // 미배정으로 남은 대기 신청(학생 건 등)까지 마저 정리.
    await purgeWaitQueueRequests();
  };

  return { tripId, originLabel, destLabel, earlyName, lateName, cleanup };
}
