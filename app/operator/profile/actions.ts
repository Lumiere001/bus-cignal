"use server";

import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { geocodeAddress } from "@/lib/kakao/geocode";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string } | undefined;

// FormData의 lat/lng → 유효 좌표(범위 검증). 둘 다 유효한 한국 좌표일 때만 반환, 아니면 null.
// (위조·부분 입력 방어 — 이상값이면 무시하고 지오코딩 fallback으로 떨어진다)
function parseCoords(
  rawLat: FormDataEntryValue | null,
  rawLng: FormDataEntryValue | null,
): { lat: number; lng: number } | null {
  if (typeof rawLat !== "string" || typeof rawLng !== "string") return null;
  if (rawLat.trim() === "" || rawLng.trim() === "") return null;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // 대략적 한반도 경계 — 명백한 이상값(0,0 등) 차단.
  if (lat < 33 || lat > 39 || lng < 124 || lng > 132) return null;
  return { lat, lng };
}

// ─── 출발/도착지 추가 ──────────────────────────────────────────────────────────
// 차량 등록폼의 출발지·도착지 드롭다운 소스(region_locations)를 간사가 직접 관리.
// 본인 지구(session.regionId)에만 추가 — region_id 위조 불가.

export async function addLocation(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireOperator();
  if (!session.regionId) {
    return { error: "소속 지구 정보가 없습니다. 관리자에게 문의해주세요." };
  }

  const direction = formData.get("direction") as string;
  const locationType = formData.get("location_type") as string;
  const address = ((formData.get("address") as string) ?? "").trim();
  const label = ((formData.get("label") as string) ?? "").trim() || null;

  if (!["up", "down"].includes(direction)) return { error: "방향을 선택해주세요." };
  if (!["origin", "destination"].includes(locationType))
    return { error: "출발지/도착지를 선택해주세요." };
  if (address.length < 2 || address.length > 200)
    return { error: "주소를 2~200자로 입력해주세요." };
  if (label && label.length > 50) return { error: "이름표는 50자 이하로 입력해주세요." };

  // 좌표 확정 — 방식 B(지도 선택)에서 lat/lng를 함께 보내면 그대로 사용.
  // 미제공(직접 입력 fallback)이면 기존대로 주소→좌표 지오코딩. 실패 시 null로 저장
  // (학생 지도는 주소 fallback). 차단하지 않음.
  const picked = parseCoords(formData.get("lat"), formData.get("lng"));
  const coords = picked ?? (await geocodeAddress(address));

  const db = createAdminClient();
  const { error } = await db.from("region_locations").insert({
    region_id: session.regionId,
    direction,
    location_type: locationType,
    address,
    label,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    created_by: session.operatorId,
  });
  if (error) return { error: "저장 중 오류가 발생했습니다." };

  revalidatePath("/operator/profile");
}

// ─── 출발/도착지 삭제 ──────────────────────────────────────────────────────────

export async function deleteLocation(id: string): Promise<ActionResult> {
  const session = await requireOperator();
  if (!session.regionId) {
    return { error: "소속 지구 정보가 없습니다." };
  }

  // id는 아래 .or() 필터에 문자열 보간되므로 UUID 형식만 허용 (필터 구문 주입 방어).
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    return { error: "잘못된 요청입니다." };
  }

  const db = createAdminClient();

  // 소유권 가드 — 본인 지구 장소만 삭제 가능
  const { data: loc } = await db
    .from("region_locations")
    .select("id")
    .eq("id", id)
    .eq("region_id", session.regionId)
    .maybeSingle();
  if (!loc) return { error: "해당 장소를 찾을 수 없습니다." };

  // FK 가드 — 이 장소를 출발지/도착지로 쓰는 Trip이 있으면 삭제 차단(참조 무결성).
  const { count } = await db
    .from("trips")
    .select("id", { count: "exact", head: true })
    .or(`origin_location_id.eq.${id},destination_location_id.eq.${id}`);
  if ((count ?? 0) > 0) {
    return { error: "이 장소를 사용하는 차량 등록이 있어 삭제할 수 없습니다." };
  }

  const { error } = await db
    .from("region_locations")
    .delete()
    .eq("id", id)
    .eq("region_id", session.regionId);
  if (error) return { error: "삭제 중 오류가 발생했습니다." };

  revalidatePath("/operator/profile");
}
