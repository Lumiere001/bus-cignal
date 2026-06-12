"use server";

import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMaintenanceMode, isPastRequestDeadline } from "@/lib/system-config";
import { revalidatePath } from "next/cache";
import { parseUsage, parseTimestamp, MAX_IMPORT_ROWS } from "@/lib/import/parse";

// 클라이언트에서 넘어오는 1행 — 지구는 드롭다운에서 고른 region id (텍스트 매칭은 클라이언트
// 미리보기 단계에서 끝나고, 서버는 id 실존만 검증). 시각은 KST ISO 또는 null.
export type ImportRowInput = {
  regionId: string;
  name: string;
  phone: string;
  usage: string;
  appliedAt: string | null;
};

export type ImportResult =
  | { ok: true; requestCount: number; passengerCount: number; duplicateCount: number }
  | { ok: false; error: string; rowErrors?: { index: number; message: string }[] };

/** 진행 중(대기·매칭) 신청에 묶인 학생 — 중복 안내용. (이 간사 차량 한정, 본인이 이미 보는 명단) */
export type RosterEntry = { tripId: string; name: string; phone: string };

const ACTIVE_REQUEST_STATUSES = ["queued", "matched"] as const;

/**
 * 선택한 차량들의 현재 명단(이름+연락처) — 가져오기 화면의 중복 표시용.
 * 본인 지구 차량만 조회 가능 (공급 간사는 어차피 자기 차량 명단 열람 권한이 있음).
 */
export async function getTripRoster(tripIds: string[]): Promise<RosterEntry[]> {
  const session = await requireOperator();
  if (!session.regionId || tripIds.length === 0) return [];

  const db = createAdminClient();
  const { data } = await db
    .from("seat_requests")
    .select(
      `trip_id, status,
       trip:trips!trip_id(operator_region_id),
       request_passengers(name, phone)`,
    )
    .in("trip_id", tripIds)
    .in("status", [...ACTIVE_REQUEST_STATUSES]);

  const roster: RosterEntry[] = [];
  for (const req of data ?? []) {
    if (!req.trip_id) continue; // .in("trip_id", ...) 필터로 도달 불가 — 타입상 null 가드(대기큐로 trip_id nullable)
    const trip = Array.isArray(req.trip) ? req.trip[0] : req.trip;
    if (!trip || trip.operator_region_id !== session.regionId) continue; // 본인 차량만
    for (const p of req.request_passengers ?? []) {
      roster.push({ tripId: req.trip_id, name: p.name, phone: p.phone });
    }
  }
  return roster;
}

/** 중복 판정 키 — 같은 차량에 같은 이름+연락처면 동일인 취급. */
function personKey(tripId: string, name: string, phone: string): string {
  return `${tripId}:${name.trim()}:${phone.replace(/[^0-9]/g, "")}`;
}

/**
 * 사전 수합분 일괄 등록 — 배포 전 구글폼 등으로 이미 신청을 받은 공급 지구 간사가
 * 그 명단을 자기 차량의 대기 큐(queued)에 올린다 (사용자 결정 2026-06-11).
 *
 *  · 일반 신청과 달리 "본인 지구 차량"에만 등록 (수합 주체 = 공급 지구) — 타지구 차량 불가.
 *  · 왕복 행은 가는편·오는편 차량 양쪽에, 편도는 해당 방향에만 신청 생성.
 *  · 같은 지구 학생은 차량별 1건의 신청으로 묶음 (기존 간사 신청 모델과 동일).
 *  · 대기 순서: 구글폼 타임스탬프(appliedAt)가 있으면 그 시각을 requested_at으로 —
 *    묶음은 구성원 중 가장 이른 시각, 명단 priority도 시각순.
 *  · 이미 대기·매칭 중인 동일인(이름+연락처)은 건너뛰어 중복 신청을 방지 (건수 보고).
 *  · 예약번호는 발급하지 않음 — queued 등록까지만 (입금 확인 시 발급, SPEC §6).
 *  · 알림(REQUEST_NEW)은 보내지 않음 — 공급 간사 본인이 등록 주체.
 */
export async function importPreCollected(input: {
  goTripId: string | null;
  returnTripId: string | null;
  rows: ImportRowInput[];
  consent: boolean;
}): Promise<ImportResult> {
  const session = await requireOperator();
  if (!session.regionId) {
    return { ok: false, error: "소속 지구 정보가 없습니다. 관리자에게 문의해주세요." };
  }

  // 점검 모드·신청 마감 — 일반 신청(createRequest)과 동일 가드
  if (await isMaintenanceMode()) {
    return { ok: false, error: "시스템 점검 중입니다. 잠시 후 다시 시도해주세요." };
  }
  if (await isPastRequestDeadline()) {
    return { ok: false, error: "신청이 마감되었습니다. (마감일 이후에는 등록할 수 없습니다.)" };
  }

  if (!input.consent) {
    return { ok: false, error: "원 수합 시 개인정보 수집·이용 동의를 받았음을 확인해주세요." };
  }
  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    return { ok: false, error: "등록할 명단이 없습니다." };
  }
  if (input.rows.length > MAX_IMPORT_ROWS) {
    return { ok: false, error: `한 번에 최대 ${MAX_IMPORT_ROWS}명까지 등록할 수 있습니다.` };
  }

  const db = createAdminClient();

  // 지구 id 실존 검증 (드롭다운 우회 호출 방어)
  const { data: regions } = await db.from("regions").select("id");
  const regionIds = new Set((regions ?? []).map((r) => r.id));

  // 행 재검증 — 클라이언트 미리보기와 같은 규칙
  type ValidRow = {
    regionId: string;
    name: string;
    phone: string;
    usage: "round" | "go" | "return";
    appliedAt: string | null;
  };
  const rows: ValidRow[] = [];
  const rowErrors: { index: number; message: string }[] = [];
  // 클라이언트가 보내는 appliedAt은 KST ISO("…+09:00") — 형식 검증 후 그대로, 아니면 원문 재파싱 시도.
  const KST_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/;
  input.rows.forEach((raw, index) => {
    const name = raw.name.trim();
    const phone = raw.phone.replace(/[^0-9]/g, "");
    const usage = parseUsage(raw.usage);
    const appliedAt = raw.appliedAt
      ? KST_ISO.test(raw.appliedAt)
        ? raw.appliedAt
        : (parseTimestamp(raw.appliedAt) ?? null)
      : null;
    if (!regionIds.has(raw.regionId)) {
      rowErrors.push({ index, message: "지구를 선택해주세요." });
    } else if (name.length < 1 || name.length > 50) {
      rowErrors.push({ index, message: "이름을 1~50자로 입력해주세요." });
    } else if (phone.length < 10 || phone.length > 11) {
      rowErrors.push({ index, message: "연락처를 올바르게 입력해주세요." });
    } else if (!usage) {
      rowErrors.push({ index, message: "버스 이용 형태가 올바르지 않습니다." });
    } else {
      rows.push({ regionId: raw.regionId, name, phone, usage, appliedAt });
    }
  });
  if (rowErrors.length > 0) {
    return { ok: false, error: "명단에 오류가 있습니다. 표시된 행을 수정해주세요.", rowErrors };
  }

  // 방향별 필요 차량 확인 — 왕복=양쪽, 편도=해당 방향만
  const needsGo = rows.some((r) => r.usage === "round" || r.usage === "go");
  const needsReturn = rows.some((r) => r.usage === "round" || r.usage === "return");
  if (needsGo && !input.goTripId) {
    return { ok: false, error: "가는편 신청이 있습니다. 가는편 차량을 선택해주세요." };
  }
  if (needsReturn && !input.returnTripId) {
    return { ok: false, error: "오는편 신청이 있습니다. 오는편 차량을 선택해주세요." };
  }

  // 차량 검증 — 본인 지구 + published + 방향 일치 (사전 수합분은 자기 차량에 올리는 기능)
  const tripIds = [
    needsGo ? input.goTripId : null,
    needsReturn ? input.returnTripId : null,
  ].filter((v): v is string => Boolean(v));
  const { data: trips } = await db
    .from("trips")
    .select("id, direction, status, operator_region_id")
    .in("id", tripIds);

  const tripFor = (id: string | null, direction: "up" | "down"): string | null => {
    if (!id) return null;
    const t = (trips ?? []).find((x) => x.id === id);
    if (!t || t.operator_region_id !== session.regionId || t.status !== "published") return null;
    return t.direction === direction ? t.id : null;
  };
  const goTrip = needsGo ? tripFor(input.goTripId, "up") : null;
  const returnTrip = needsReturn ? tripFor(input.returnTripId, "down") : null;
  if (needsGo && !goTrip) {
    return { ok: false, error: "가는편 차량이 유효하지 않습니다. (본인 지구의 공개 중인 가는편 차량만 가능)" };
  }
  if (needsReturn && !returnTrip) {
    return { ok: false, error: "오는편 차량이 유효하지 않습니다. (본인 지구의 공개 중인 오는편 차량만 가능)" };
  }

  // 기존 명단과의 중복 — 제출 직전 서버에서 다시 확인 (미리보기 이후 변화 대비)
  const existing = new Set(
    (await getTripRoster([goTrip, returnTrip].filter((v): v is string => Boolean(v)))).map((e) =>
      personKey(e.tripId, e.name, e.phone),
    ),
  );

  // (차량 × 지구) 묶음 — 같은 지구 학생들을 1건의 신청으로. 목록 내 중복도 여기서 걸러진다.
  type Group = { tripId: string; regionId: string; passengers: ValidRow[] };
  const groups = new Map<string, Group>();
  const seen = new Set<string>();
  let duplicateCount = 0;
  const addToGroup = (tripId: string, row: ValidRow) => {
    const key = personKey(tripId, row.name, row.phone);
    if (existing.has(key) || seen.has(key)) {
      duplicateCount += 1;
      return;
    }
    seen.add(key);
    const groupKey = `${tripId}:${row.regionId}`;
    const group = groups.get(groupKey) ?? { tripId, regionId: row.regionId, passengers: [] };
    group.passengers.push(row);
    groups.set(groupKey, group);
  };
  for (const row of rows) {
    if ((row.usage === "round" || row.usage === "go") && goTrip) addToGroup(goTrip, row);
    if ((row.usage === "round" || row.usage === "return") && returnTrip) addToGroup(returnTrip, row);
  }

  if (groups.size === 0) {
    return {
      ok: false,
      error:
        duplicateCount > 0
          ? `전원이 이미 대기 큐에 있어요 (중복 ${duplicateCount}건). 새로 등록할 인원이 없습니다.`
          : "등록할 인원이 없습니다.",
    };
  }

  // 묶음별 insert — 명단 저장 실패 시 해당 신청 롤백 (createRequest와 동일 패턴).
  // requested_at = 묶음에서 가장 이른 신청 시각 (없으면 DB default now()).
  // 명단 priority = 신청 시각순 (시각 없는 행은 뒤로, 원래 순서 유지).
  let requestCount = 0;
  let passengerCount = 0;
  for (const group of groups.values()) {
    const sorted = [...group.passengers].sort((a, b) => {
      if (a.appliedAt && b.appliedAt) return a.appliedAt.localeCompare(b.appliedAt);
      if (a.appliedAt) return -1;
      if (b.appliedAt) return 1;
      return 0;
    });
    const earliest = sorted.find((p) => p.appliedAt)?.appliedAt ?? null;

    const { data: request, error: reqErr } = await db
      .from("seat_requests")
      .insert({
        trip_id: group.tripId,
        region_id: group.regionId,
        operator_id: session.operatorId,
        requester_kind: "operator",
        seat_count: sorted.length,
        status: "queued",
        ...(earliest ? { requested_at: earliest } : {}),
        consent_confirmed_at: new Date().toISOString(),
        consent_confirmed_by: session.operatorId,
      })
      .select("id")
      .single();

    if (reqErr || !request) {
      return {
        ok: false,
        error:
          requestCount > 0
            ? `일부만 등록됐습니다 (신청 ${requestCount}건, ${passengerCount}명). 나머지는 저장 중 오류가 발생했어요 — 같은 파일을 다시 올리면 등록된 인원은 중복으로 자동 제외되니 그대로 재시도해주세요.`
            : "신청 저장 중 오류가 발생했습니다.",
      };
    }

    const { error: paxErr } = await db.from("request_passengers").insert(
      sorted.map((p, i) => ({
        request_id: request.id,
        name: p.name,
        phone: p.phone,
        priority: i + 1,
        applied_at: p.appliedAt, // 개인 신청 시각 — 대기 큐 시간순 정렬용 (없으면 null → requested_at 폴백)
      })),
    );
    if (paxErr) {
      await db.from("seat_requests").delete().eq("id", request.id);
      return {
        ok: false,
        error:
          requestCount > 0
            ? `일부만 등록됐습니다 (신청 ${requestCount}건, ${passengerCount}명). 명단 저장 중 오류가 발생했어요 — 같은 파일을 다시 올리면 등록된 인원은 중복으로 자동 제외되니 그대로 재시도해주세요.`
            : "학생 명단 저장 중 오류가 발생했습니다.",
      };
    }

    requestCount += 1;
    passengerCount += sorted.length;
  }

  revalidatePath("/status");
  revalidatePath("/operator");
  if (goTrip) revalidatePath(`/operator/trips/${goTrip}`);
  if (returnTrip) revalidatePath(`/operator/trips/${returnTrip}`);

  return { ok: true, requestCount, passengerCount, duplicateCount };
}
