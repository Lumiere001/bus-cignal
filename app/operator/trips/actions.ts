"use server";

import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

type ActionResult = { error: string } | undefined;

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
  const originId = formData.get("origin_location_id") as string;
  const destId = formData.get("destination_location_id") as string;
  const rawDeparture = formData.get("departure_at") as string;
  const capacity = Number(formData.get("capacity"));
  const price = Number(formData.get("price_per_seat"));
  const note = (formData.get("note") as string) || null;

  if (!["up", "down"].includes(direction)) return { error: "방향을 선택해주세요." };
  if (!originId) return { error: "출발지를 선택해주세요." };
  if (!destId) return { error: "도착지를 선택해주세요." };
  if (!rawDeparture) return { error: "출발 시각을 입력해주세요." };
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200)
    return { error: "정원은 1~200 사이로 입력해주세요." };
  if (!Number.isInteger(price) || price < 0) return { error: "요금을 올바르게 입력해주세요." };
  if (note && note.length > 500) return { error: "메모는 500자 이하로 입력해주세요." };

  // datetime-local → KST timestamptz
  const departure_at = rawDeparture + ":00+09:00";

  // 과거 출발 시각 거부
  if (new Date(departure_at) <= new Date()) {
    return { error: "출발 시각은 현재 이후여야 합니다." };
  }

  const supabase = createAdminClient();

  // FormData 위조 방지: 출발지·도착지가 본인 지구·방향·타입과 일치하는지 확인
  // (region_locations는 public read → admin client로도 OK)
  const [{ data: originLoc }, { data: destLoc }] = await Promise.all([
    supabase
      .from("region_locations")
      .select("id")
      .eq("id", originId)
      .eq("region_id", session.regionId)
      .eq("direction", direction)
      .eq("location_type", "origin")
      .single(),
    supabase
      .from("region_locations")
      .select("id")
      .eq("id", destId)
      .eq("region_id", session.regionId)
      .eq("direction", direction)
      .eq("location_type", "destination")
      .single(),
  ]);

  if (!originLoc) return { error: "유효하지 않은 출발지입니다." };
  if (!destLoc) return { error: "유효하지 않은 도착지입니다." };

  const { error } = await supabase.from("trips").insert({
    operator_region_id: session.regionId,
    created_by: session.operatorId,
    direction,
    origin_location_id: originId,
    destination_location_id: destId,
    departure_at,
    capacity,
    price_per_seat: price,
    note,
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
