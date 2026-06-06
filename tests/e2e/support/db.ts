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

  return { tripId: base.tripId, matchId, code, name, phoneLast4: phone.slice(-4), cleanup };
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
