"use server";

import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

type ActionResult = { error: string } | undefined;

// admin(service_role) 클라이언트 타입 — Database 제네릭 유지를 위해 함수 반환 타입에서 도출.
type AdminClient = ReturnType<typeof createAdminClient>;

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

// ─── Trip 등록 ────────────────────────────────────────────────────────────────

export async function createTrip(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireOperator();

  if (!session.regionId) {
    return { error: "소속 지구 정보가 없습니다. 관리자에게 문의해주세요." };
  }

  const direction = formData.get("direction") as string;
  // 출발지/도착지는 두 경로 중 하나로 옴:
  //  (1) 등록 장소 id (기존 동작 / fallback select)  (2) 방식 B 새 장소 JSON
  const originId = formData.get("origin_location_id") as string;
  const destId = formData.get("destination_location_id") as string;
  const originNew = parseNewPlace(formData.get("origin_new"));
  const destNew = parseNewPlace(formData.get("dest_new"));
  const rawDeparture = formData.get("departure_at") as string;
  const capacity = Number(formData.get("capacity"));
  const price = Number(formData.get("price_per_seat"));
  const note = (formData.get("note") as string) || null;
  // 총무(학생 담당) 연락처 — DB는 nullable이나 폼 필수화는 앱레이어 책임 (이슈 #25 마이그 주석)
  const treasurerName = ((formData.get("treasurer_name") as string) ?? "").trim();
  const treasurerPhone = cleanPhone((formData.get("treasurer_phone") as string) ?? "");

  if (!["up", "down"].includes(direction)) return { error: "방향을 선택해주세요." };
  if (!originId && !originNew) return { error: "출발지를 선택해주세요." };
  if (!destId && !destNew) return { error: "도착지를 선택해주세요." };
  if (!rawDeparture) return { error: "출발 시각을 입력해주세요." };
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200)
    return { error: "정원은 1~200 사이로 입력해주세요." };
  if (!Number.isInteger(price) || price < 0) return { error: "요금을 올바르게 입력해주세요." };
  if (note && note.length > 500) return { error: "메모는 500자 이하로 입력해주세요." };
  if (treasurerName.length < 1 || treasurerName.length > 50)
    return { error: "총무 이름을 1~50자로 입력해주세요." };
  if (treasurerPhone.length < 10 || treasurerPhone.length > 11)
    return { error: "총무 연락처를 올바르게 입력해주세요." };

  // datetime-local → KST timestamptz
  const departure_at = rawDeparture + ":00+09:00";

  // 과거 출발 시각 거부
  if (new Date(departure_at) <= new Date()) {
    return { error: "출발 시각은 현재 이후여야 합니다." };
  }

  const supabase = createAdminClient();

  // 출발지·도착지를 최종 region_location id로 확정.
  //  - 등록 id면: 본인 지구·방향·타입 일치 검증 (FormData 위조 방지, 기존 동작)
  //  - 새 장소면: 본인 지구·방향·타입으로 upsert(중복 주소 재사용) 후 id 사용
  // 두 경로 모두 region_id는 세션 값으로만 — 위조 불가.
  let originLocationId: string | null = null;
  let destLocationId: string | null = null;

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

  if (!originLocationId) return { error: "유효하지 않은 출발지입니다." };
  if (!destLocationId) return { error: "유효하지 않은 도착지입니다." };

  const { error } = await supabase.from("trips").insert({
    operator_region_id: session.regionId,
    created_by: session.operatorId,
    direction,
    origin_location_id: originLocationId,
    destination_location_id: destLocationId,
    departure_at,
    capacity,
    price_per_seat: price,
    note,
    treasurer_name: treasurerName,
    treasurer_phone: treasurerPhone,
    status: "draft",
  });

  if (error) return { error: "저장 중 오류가 발생했습니다." };

  redirect("/operator/trips");
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

  redirect("/operator/trips");
}
