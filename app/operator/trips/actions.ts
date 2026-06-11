"use server";

import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// 검증 실패 시 폼이 입력값을 잃지 않도록 제출값을 함께 돌려준다(React 19 form auto-reset 대응).
export type TripFormFieldValues = {
  direction: string;
  originText: string;
  departureLocal: string;
  capacity: string;
  price: string;
  treasurerName: string;
  treasurerPhone: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  refundPolicy: string;
  note: string;
};

type ActionResult = { error: string; values?: TripFormFieldValues } | undefined;

// admin(service_role) 클라이언트 타입 — Database 제네릭 유지를 위해 함수 반환 타입에서 도출.
type AdminClient = ReturnType<typeof createAdminClient>;

/** 제출된 폼 원본 값 — 검증 실패 시 폼에 그대로 되돌려 채우기 위함. */
function rawTripFormValues(formData: FormData): TripFormFieldValues {
  const s = (k: string) => (formData.get(k) as string) ?? "";
  return {
    direction: s("direction"),
    originText: s("origin_text"),
    departureLocal: s("departure_at"),
    capacity: s("capacity"),
    price: s("price_per_seat"),
    treasurerName: s("treasurer_name"),
    treasurerPhone: s("treasurer_phone"),
    bankName: s("bank_name"),
    accountHolder: s("account_holder"),
    accountNumber: s("account_number"),
    refundPolicy: s("refund_policy"),
    note: s("note"),
  };
}

// 전화번호 정규화 — 숫자만 (신청 흐름 actions.ts와 동일 규칙)
function cleanPhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

// 방식 B에서 새로 고른 장소 (TripNewForm의 origin_new/dest_new JSON).
type NewPlace = { address: string; lat: number; lng: number; placeName?: string };

// FormData JSON 필드 → NewPlace. 형식·범위 검증 실패 시 null (위조 방어).
function parseNewPlace(raw: FormDataEntryValue | null): NewPlace | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const o = parsed as Record<string, unknown>;
  const address = typeof o.address === "string" ? o.address.trim() : "";
  const lat = typeof o.lat === "number" ? o.lat : Number(o.lat);
  const lng = typeof o.lng === "number" ? o.lng : Number(o.lng);
  const placeName = typeof o.placeName === "string" ? o.placeName.trim() : undefined;
  if (address.length < 2 || address.length > 200) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // 대략적 한반도 경계 — 이상값(0,0 등) 차단.
  if (lat < 33 || lat > 39 || lng < 124 || lng > 132) return null;
  return { address, lat, lng, placeName: placeName || undefined };
}

// 새로 고른 장소를 본인 지구·방향·타입에 맞춰 region_locations에 upsert하고 id 반환.
// dedup: region_id + direction + location_type + address 가 같으면 기존 행 재사용
// (간사가 같은 장소를 매번 새로 만들어 목록이 중복되는 것 방지).
// 실패 시 null. region_id는 항상 세션 값 — 위조 불가.
async function resolveNewLocation(
  db: AdminClient,
  params: {
    regionId: string;
    operatorId: string;
    direction: string;
    locationType: "origin" | "destination";
    place: NewPlace;
  },
): Promise<string | null> {
  const { regionId, operatorId, direction, locationType, place } = params;

  // 동일 주소가 이미 있으면 재사용.
  const { data: existing } = await db
    .from("region_locations")
    .select("id")
    .eq("region_id", regionId)
    .eq("direction", direction)
    .eq("location_type", locationType)
    .eq("address", place.address)
    .maybeSingle();
  if (existing?.id) return existing.id;

  // 없으면 좌표와 함께 신규 삽입. label은 placeName(있으면)로.
  const { data: inserted, error } = await db
    .from("region_locations")
    .insert({
      region_id: regionId,
      direction,
      location_type: locationType,
      address: place.address,
      label: place.placeName ?? null,
      lat: place.lat,
      lng: place.lng,
      created_by: operatorId,
    })
    .select("id")
    .single();
  if (error || !inserted) return null;
  return inserted.id;
}

// 가는편(up) 도착지 고정 장소 — 평창 휘닉스파크 (사용자 요청 2026-06-10).
// 좌표는 길찾기/향후 지도 표기용 근사값(수련회 장소가 고정이라 매번 지정 불필요).
const PYEONGCHANG_VENUE: NewPlace = {
  address: "강원특별자치도 평창군 봉평면 휘닉스로 174",
  placeName: "평창 휘닉스파크",
  lat: 37.5876,
  lng: 128.3221,
};

// 텍스트 전용 장소(좌표 없음)를 본인 지구·방향·타입에 맞춰 upsert하고 id 반환.
// 오는편(down) 출발지 = 평창 집결 위치(예: '블루캐니언 옆 주차장')처럼 지도 핀 없이
// 텍스트로만 안내하는 지점에 사용. dedup: region+direction+type+address.
async function resolveTextLocation(
  db: AdminClient,
  params: {
    regionId: string;
    operatorId: string;
    direction: string;
    locationType: "origin" | "destination";
    address: string;
  },
): Promise<string | null> {
  const { regionId, operatorId, direction, locationType, address } = params;
  const trimmed = address.trim();
  if (trimmed.length < 2 || trimmed.length > 100) return null;

  const { data: existing } = await db
    .from("region_locations")
    .select("id")
    .eq("region_id", regionId)
    .eq("direction", direction)
    .eq("location_type", locationType)
    .eq("address", trimmed)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: inserted, error } = await db
    .from("region_locations")
    .insert({
      region_id: regionId,
      direction,
      location_type: locationType,
      address: trimmed,
      label: null,
      lat: null,
      lng: null,
      created_by: operatorId,
    })
    .select("id")
    .single();
  if (error || !inserted) return null;
  return inserted.id;
}

// ─── Trip 등록 ────────────────────────────────────────────────────────────────

// 차량 폼 확정 값 — createTrip(신규)·updateTrip(수정) 공용.
type ResolvedTripValues = {
  direction: "up" | "down";
  originLocationId: string;
  destLocationId: string;
  departure_at: string;
  capacity: number;
  price: number;
  note: string | null;
  treasurerName: string;
  treasurerPhone: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  refundPolicy: string | null;
};

/**
 * 차량 폼(등록·수정 공용) 파싱 + 검증 + 출발지/도착지 location id 확정.
 * createTrip·updateTrip이 같은 규칙을 쓰도록 단일화 — 규칙 drift 방지.
 * 성공 시 확정 값, 실패 시 { error }(호출부가 그대로 반환).
 */
async function resolveTripFromForm(
  formData: FormData,
  session: { regionId: string; operatorId: string },
  supabase: AdminClient,
): Promise<ResolvedTripValues | { error: string }> {
  const direction = formData.get("direction") as string;
  // 방향별 위치 입력 (사용자 요청 2026-06-10):
  //  · 가는편(up):  출발지=지도 지정(등록 id 또는 새 장소 JSON), 도착지=평창 휘닉스파크 고정.
  //  · 오는편(down): 출발지=평창 텍스트(origin_text), 도착지=지도 지정(등록 id 또는 새 장소 JSON).
  const originId = formData.get("origin_location_id") as string; // 가는편 출발 (지도)
  const originNew = parseNewPlace(formData.get("origin_new")); // 가는편 출발 (새 장소)
  const destId = formData.get("destination_location_id") as string; // 오는편 도착 (지도)
  const destNew = parseNewPlace(formData.get("dest_new")); // 오는편 도착 (새 장소)
  const originText = ((formData.get("origin_text") as string) ?? "").trim(); // 오는편 출발 (텍스트)
  const rawDeparture = formData.get("departure_at") as string;
  const capacity = Number(formData.get("capacity"));
  const price = Number(formData.get("price_per_seat"));
  const note = (formData.get("note") as string) || null;
  // 총무(학생 담당) 연락처 — DB는 nullable이나 폼 필수화는 앱레이어 책임 (이슈 #25 마이그 주석)
  const treasurerName = ((formData.get("treasurer_name") as string) ?? "").trim();
  const treasurerPhone = cleanPhone((formData.get("treasurer_phone") as string) ?? "");
  // 입금 계좌 — 매칭 후 신청 지구·학생 안내용 (사용자 요청 2026-06-10). DB nullable, 폼 필수화는 여기서.
  const bankName = ((formData.get("bank_name") as string) ?? "").trim();
  const accountHolder = ((formData.get("account_holder") as string) ?? "").trim();
  const accountNumber = ((formData.get("account_number") as string) ?? "").trim();
  const accountDigits = accountNumber.replace(/[^0-9]/g, "");
  // 환불 정책 — 선택 입력 (사용자 요청 2026-06-11). 미입력 차량도 등록 가능.
  const refundPolicy = ((formData.get("refund_policy") as string) ?? "").trim() || null;

  if (!["up", "down"].includes(direction)) return { error: "방향을 선택해주세요." };
  if (direction === "up" && !originId && !originNew) {
    return { error: "출발지를 선택해주세요." };
  }
  if (direction === "down" && originText.length < 2) {
    return { error: "출발지(집결 위치)를 입력해주세요." };
  }
  if (direction === "down" && !destId && !destNew) {
    return { error: "도착지를 선택해주세요." };
  }
  if (!rawDeparture) return { error: "출발 시각을 입력해주세요." };
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200)
    return { error: "정원은 1~200 사이로 입력해주세요." };
  if (!Number.isInteger(price) || price < 0) return { error: "요금을 올바르게 입력해주세요." };
  if (note && note.length > 500) return { error: "메모는 500자 이하로 입력해주세요." };
  if (treasurerName.length < 1 || treasurerName.length > 50)
    return { error: "총무 이름을 1~50자로 입력해주세요." };
  if (treasurerPhone.length < 10 || treasurerPhone.length > 11)
    return { error: "총무 연락처를 올바르게 입력해주세요." };
  if (bankName.length < 1 || bankName.length > 30)
    return { error: "은행명을 입력해주세요." };
  if (accountHolder.length < 1 || accountHolder.length > 30)
    return { error: "예금주를 입력해주세요." };
  if (accountNumber.length > 30 || accountDigits.length < 6 || accountDigits.length > 20)
    return { error: "계좌번호를 올바르게 입력해주세요." };
  if (refundPolicy && refundPolicy.length > 500)
    return { error: "환불 정책은 500자 이하로 입력해주세요." };

  // datetime-local → KST timestamptz
  const departure_at = rawDeparture + ":00+09:00";

  // 과거 출발 시각 거부
  if (new Date(departure_at) <= new Date()) {
    return { error: "출발 시각은 현재 이후여야 합니다." };
  }

  // 출발지·도착지를 최종 region_location id로 확정 (방향별 분기, 사용자 요청 2026-06-10).
  //  - 지도 지정 슬롯: 등록 id면 본인 지구·방향·타입 일치 검증(FormData 위조 방지), 새 장소면 upsert.
  //  - 고정/텍스트 슬롯: 평창 휘닉스파크(가는편 도착) / 텍스트(오는편 출발)를 서버가 확정.
  // 모든 경로에서 region_id는 세션 값으로만 — 위조 불가.
  let originLocationId: string | null = null;
  let destLocationId: string | null = null;

  if (direction === "up") {
    // 가는편 출발지 = 지도 지정 (지역 픽업)
    if (originId) {
      const { data: originLoc } = await supabase
        .from("region_locations")
        .select("id")
        .eq("id", originId)
        .eq("region_id", session.regionId)
        .eq("direction", direction)
        .eq("location_type", "origin")
        .single();
      if (!originLoc) return { error: "유효하지 않은 출발지입니다." };
      originLocationId = originLoc.id;
    } else if (originNew) {
      originLocationId = await resolveNewLocation(supabase, {
        regionId: session.regionId,
        operatorId: session.operatorId,
        direction,
        locationType: "origin",
        place: originNew,
      });
      if (!originLocationId) return { error: "출발지 저장 중 오류가 발생했습니다." };
    }
    // 가는편 도착지 = 평창 휘닉스파크 고정
    destLocationId = await resolveNewLocation(supabase, {
      regionId: session.regionId,
      operatorId: session.operatorId,
      direction,
      locationType: "destination",
      place: PYEONGCHANG_VENUE,
    });
    if (!destLocationId) return { error: "도착지 저장 중 오류가 발생했습니다." };
  } else {
    // 오는편 출발지 = 평창 텍스트 안내 (좌표 없음)
    originLocationId = await resolveTextLocation(supabase, {
      regionId: session.regionId,
      operatorId: session.operatorId,
      direction,
      locationType: "origin",
      address: originText,
    });
    if (!originLocationId) return { error: "출발지 저장 중 오류가 발생했습니다." };
    // 오는편 도착지 = 지도 지정 (지역 하차)
    if (destId) {
      const { data: destLoc } = await supabase
        .from("region_locations")
        .select("id")
        .eq("id", destId)
        .eq("region_id", session.regionId)
        .eq("direction", direction)
        .eq("location_type", "destination")
        .single();
      if (!destLoc) return { error: "유효하지 않은 도착지입니다." };
      destLocationId = destLoc.id;
    } else if (destNew) {
      destLocationId = await resolveNewLocation(supabase, {
        regionId: session.regionId,
        operatorId: session.operatorId,
        direction,
        locationType: "destination",
        place: destNew,
      });
      if (!destLocationId) return { error: "도착지 저장 중 오류가 발생했습니다." };
    }
  }

  if (!originLocationId) return { error: "유효하지 않은 출발지입니다." };
  if (!destLocationId) return { error: "유효하지 않은 도착지입니다." };

  return {
    direction: direction as "up" | "down",
    originLocationId,
    destLocationId,
    departure_at,
    capacity,
    price,
    note,
    treasurerName,
    treasurerPhone,
    bankName,
    accountNumber,
    accountHolder,
    refundPolicy,
  };
}

// 인원을 받기 전(활성 매칭 0건)에만 차량 상세 수정 허용 — 한 명이라도 매칭되면 잠금.
const ACTIVE_MATCH_STATUSES = ["awaiting_payment", "payment_reported", "paid"] as const;

export async function createTrip(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireOperator();
  if (!session.regionId) {
    return { error: "소속 지구 정보가 없습니다. 관리자에게 문의해주세요." };
  }

  const supabase = createAdminClient();
  const resolved = await resolveTripFromForm(
    formData,
    { regionId: session.regionId, operatorId: session.operatorId },
    supabase,
  );
  if ("error" in resolved) return { error: resolved.error, values: rawTripFormValues(formData) };

  const { error } = await supabase.from("trips").insert({
    operator_region_id: session.regionId,
    created_by: session.operatorId,
    direction: resolved.direction,
    origin_location_id: resolved.originLocationId,
    destination_location_id: resolved.destLocationId,
    departure_at: resolved.departure_at,
    capacity: resolved.capacity,
    price_per_seat: resolved.price,
    note: resolved.note,
    treasurer_name: resolved.treasurerName,
    treasurer_phone: resolved.treasurerPhone,
    bank_name: resolved.bankName,
    account_number: resolved.accountNumber,
    account_holder: resolved.accountHolder,
    refund_policy: resolved.refundPolicy,
    status: "draft",
  });

  if (error) return { error: "저장 중 오류가 발생했습니다." };

  redirect("/operator/trips");
}

/**
 * 차량 상세 수정 — 일정·정원·요금·연락처·계좌·환불·메모·위치 수정 (사용자 요청 2026-06-11).
 * 인원을 한 명이라도 받으면(활성 매칭) 잠금 — 학생에게 안내된 정보와 어긋나지 않도록.
 */
export async function updateTrip(
  tripId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireOperator();
  if (!session.regionId) {
    return { error: "소속 지구 정보가 없습니다. 관리자에게 문의해주세요." };
  }

  const supabase = createAdminClient();

  // 소유권 + 상태 가드 — 본인 지구 차량, draft/published만.
  const { data: trip } = await supabase
    .from("trips")
    .select("id, status, capacity, operator_region_id")
    .eq("id", tripId)
    .eq("operator_region_id", session.regionId)
    .maybeSingle();
  if (!trip) return { error: "차량을 찾을 수 없습니다." };
  if (trip.status !== "draft" && trip.status !== "published") {
    return { error: "마감·취소된 차량은 수정할 수 없습니다." };
  }

  // 인원을 한 명이라도 받았으면(활성 매칭) 수정 잠금.
  const { count } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId)
    .in("status", [...ACTIVE_MATCH_STATUSES]);
  if ((count ?? 0) > 0) {
    return {
      error:
        "이미 매칭된 학생이 있어 차량 정보를 수정할 수 없어요. 먼저 학생들의 매칭을 취소한 뒤 수정할 수 있습니다.",
    };
  }

  const resolved = await resolveTripFromForm(
    formData,
    { regionId: session.regionId, operatorId: session.operatorId },
    supabase,
  );
  if ("error" in resolved) return { error: resolved.error, values: rawTripFormValues(formData) };

  const { error } = await supabase
    .from("trips")
    .update({
      direction: resolved.direction,
      origin_location_id: resolved.originLocationId,
      destination_location_id: resolved.destLocationId,
      departure_at: resolved.departure_at,
      capacity: resolved.capacity,
      price_per_seat: resolved.price,
      note: resolved.note,
      treasurer_name: resolved.treasurerName,
      treasurer_phone: resolved.treasurerPhone,
      bank_name: resolved.bankName,
      account_number: resolved.accountNumber,
      account_holder: resolved.accountHolder,
      refund_policy: resolved.refundPolicy,
    })
    .eq("id", tripId)
    .eq("operator_region_id", session.regionId)
    .eq("status", trip.status); // 동시 상태 변경 방어
  if (error) return { error: "저장 중 오류가 발생했습니다." };

  // 공개 중 차량의 정원을 바꾸면 열린 좌석(seat_offer)도 맞춤 — 활성 매칭 0건이라 안전.
  if (trip.status === "published" && resolved.capacity !== trip.capacity) {
    await supabase
      .from("seat_offers")
      .update({ seat_count: resolved.capacity })
      .eq("trip_id", tripId)
      .eq("status", "open");
  }

  revalidatePath(`/operator/trips/${tripId}`);
  revalidatePath("/operator/trips");
  revalidatePath("/status");
  redirect(`/operator/trips/${tripId}`);
}

// ─── Trip 공개 (draft → published + seat_offer 생성) ─────────────────────────

export async function publishTrip(tripId: string): Promise<ActionResult> {
  const session = await requireOperator();

  if (!session.regionId) {
    return { error: "소속 지구 정보가 없습니다. 관리자에게 문의해주세요." };
  }

  const supabase = createAdminClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("id, status, capacity, operator_region_id")
    .eq("id", tripId)
    .eq("operator_region_id", session.regionId)
    .single();

  if (!trip) return { error: "Trip을 찾을 수 없습니다." };
  if (trip.status !== "draft") return { error: "이미 공개됐거나 마감된 Trip입니다." };

  // 원자적 공개: status='draft'인 행에만 적용 → 동시·중복 호출 중 하나만 통과.
  // (offer를 먼저 넣으면 두 호출이 각각 offer를 만들어 좌석이 2배가 됨)
  const { data: published } = await supabase
    .from("trips")
    .update({ status: "published" })
    .eq("id", tripId)
    .eq("operator_region_id", session.regionId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (!published) return { error: "이미 공개됐거나 마감된 Trip입니다." };

  // 공개에 성공한 한 호출만 seat_offer 생성
  const { error: offerErr } = await supabase
    .from("seat_offers")
    .insert({ trip_id: tripId, seat_count: trip.capacity, status: "open" });

  if (offerErr) {
    // offer 생성 실패 → 공개 롤백 (draft 복원)
    await supabase.from("trips").update({ status: "draft" }).eq("id", tripId);
    return { error: "오류가 발생했습니다." };
  }

  revalidatePath("/status");
  redirect("/operator/trips");
}
