import Link from "next/link";
import { requireStudent } from "@/lib/auth/student";
import { createAdminClient } from "@/lib/supabase/admin";
import { one } from "@/lib/supabase/relation";
import { Logo } from "@/components/brand/logo";
import { StudentApply, type WizardTrip } from "./StudentApply";

export const dynamic = "force-dynamic";

// 매칭으로 자리를 점유하는 상태 — 잔여 계산 시 차감 (간사 신청 마법사와 동일 기준).
const ACTIVE_MATCH_STATUSES = ["awaiting_payment", "payment_reported", "paid"] as const;

/**
 * 학생 차량 둘러보기 + 직접 신청 (Phase 2-2). 간사 신청 마법사(RequestWizard)와 같은
 * 조회→지도·차량선택→신청 흐름. 학생은 본인 1명·정보는 CCC에서 미리 채워져 명단 단계가 없다.
 */
export default async function StudentApplyPage() {
  const session = await requireStudent();
  const db = createAdminClient();

  const { data: student } = await db
    .from("students")
    .select("name, phone, regions:regions!region_id(name)")
    .eq("id", session.studentId)
    .maybeSingle();

  const studentName = student?.name ?? null;
  const studentPhone = student?.phone ?? null;
  const regionName = one(student?.regions)?.name ?? null;
  const hasRegion = Boolean(session.regionId);
  const hasContact = Boolean(
    studentName && studentPhone && studentPhone.replace(/[^0-9]/g, "").length >= 10,
  );

  // 신청 가능 차량 — published + 잔여>0. 지도 핀·권역 추천용으로 좌표·area 임베드.
  const { data: trips } = await db
    .from("trips")
    .select(
      `
      id, direction, departure_at, price_per_seat,
      origin:region_locations!origin_location_id(label, address, lat, lng),
      destination:region_locations!destination_location_id(label, address, lat, lng),
      region:regions!operator_region_id(name, area),
      seat_offers(seat_count, status),
      matches(id, status)
    `,
    )
    .eq("status", "published")
    .order("departure_at", { ascending: true });

  const wizardTrips: WizardTrip[] = (trips ?? [])
    .map((t) => {
      const origin = one(t.origin);
      const dest = one(t.destination);
      const openSeats = (t.seat_offers ?? [])
        .filter((o) => o.status === "open")
        .reduce((sum, o) => sum + o.seat_count, 0);
      const activeMatches = (t.matches ?? []).filter((m) =>
        (ACTIVE_MATCH_STATUSES as readonly string[]).includes(m.status ?? ""),
      ).length;
      const direction: "up" | "down" = t.direction === "down" ? "down" : "up";
      // 지도 핀 = '지역(우리 동네)' 지점 — 가는편은 출발지(지역), 오는편은 도착지(지역).
      // 평창 쪽 지점은 좌표 없음(오는편 출발=텍스트)/고정이라 핀 대신 텍스트로만 안내.
      const local = direction === "up" ? origin : dest;
      return {
        id: t.id,
        direction,
        departureAt: t.departure_at,
        pricePerSeat: t.price_per_seat,
        regionName: one(t.region)?.name ?? "타지구",
        regionArea: one(t.region)?.area ?? null,
        originLabel: origin?.label ?? origin?.address ?? "출발지",
        destinationLabel: dest?.label ?? dest?.address ?? "도착지",
        mapLabel:
          local?.label ?? local?.address ?? (direction === "up" ? "출발지" : "도착지"),
        mapLat: local?.lat ?? null,
        mapLng: local?.lng ?? null,
        availableSeats: Math.max(0, openSeats - activeMatches),
      };
    })
    .filter((t) => t.availableSeats > 0);

  // 출발 지구 선택지 = 공급 차량이 있는 지구들(중복 제거, 가나다순).
  const regionOptions = Array.from(
    new Map(
      wizardTrips.map((t) => [t.regionName, { name: t.regionName, area: t.regionArea }]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return (
    <main className="mx-auto max-w-md space-y-5 px-4 py-8">
      <div className="flex justify-center">
        <Logo size="sm" />
      </div>

      <div>
        <Link href="/s" className="mb-3 inline-block text-sm text-gray-500 hover:text-gray-700">
          ← 학생 홈
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">차량 신청하기</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {regionName ? `${regionName} · ` : ""}공개된 차량 중 자리가 있는 차량에 본인으로 직접
          신청해요.
        </p>
      </div>

      {!hasRegion ? (
        <p className="rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-700">
          출신 지구가 확인되지 않아 신청할 수 없어요. 담당 간사에게 지구(branch) 등록을 요청해
          주세요.
        </p>
      ) : !hasContact ? (
        <p className="rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-700">
          이름·전화번호 정보가 없어 신청할 수 없어요. CCC 계정 정보를 확인한 뒤 다시 로그인해
          주세요.
        </p>
      ) : (
        <StudentApply
          trips={wizardTrips}
          regionOptions={regionOptions}
          studentName={studentName as string}
          studentPhone={studentPhone as string}
        />
      )}
    </main>
  );
}
