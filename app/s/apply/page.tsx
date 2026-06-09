import Link from "next/link";
import { requireStudent } from "@/lib/auth/student";
import { createAdminClient } from "@/lib/supabase/admin";
import { one } from "@/lib/supabase/relation";
import { Logo } from "@/components/brand/logo";
import { StudentApply, type ApplyTrip } from "./StudentApply";

export const dynamic = "force-dynamic";

// 매칭으로 자리를 점유하는 상태 — 잔여 계산 시 차감 (차량 상세·간사 신청과 동일 기준).
const ACTIVE_MATCH_STATUSES = ["awaiting_payment", "payment_reported", "paid"] as const;

/**
 * 학생 차량 둘러보기 + 직접 신청 (Phase 2-2). 간사 신청 마법사(RequestWizard)를 참고하되
 * 학생은 본인 1명·정보는 CCC에서 미리 채워져, 차량 선택 → 동의 → 제출로 단순화한다.
 */
export default async function StudentApplyPage() {
  const session = await requireStudent();
  const db = createAdminClient();

  const { data: student } = await db
    .from("students")
    .select("name, phone, region_id, regions:regions!region_id(name)")
    .eq("id", session.studentId)
    .maybeSingle();

  const studentName = student?.name ?? null;
  const studentPhone = student?.phone ?? null;
  const regionName = one(student?.regions)?.name ?? null;
  const hasRegion = Boolean(session.regionId);
  const hasContact = Boolean(
    studentName && studentPhone && studentPhone.replace(/[^0-9]/g, "").length >= 10,
  );

  // 신청 가능한 공급 차량 — published + 잔여>0. (지구 무관 전체 노출: 학생은 소비자 입장)
  const { data: trips } = await db
    .from("trips")
    .select(
      `
      id, direction, departure_at, price_per_seat,
      origin:region_locations!origin_location_id(label, address),
      destination:region_locations!destination_location_id(label, address),
      region:regions!operator_region_id(name),
      seat_offers(seat_count, status),
      matches(id, status)
    `,
    )
    .eq("status", "published")
    .order("departure_at", { ascending: true });

  const applyTrips: ApplyTrip[] = (trips ?? [])
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
      return {
        id: t.id,
        direction,
        departureAt: t.departure_at,
        pricePerSeat: t.price_per_seat,
        regionName: one(t.region)?.name ?? "타지구",
        originLabel: origin?.label ?? origin?.address ?? "출발지",
        destinationLabel: dest?.label ?? dest?.address ?? "도착지",
        availableSeats: Math.max(0, openSeats - activeMatches),
      };
    })
    .filter((t) => t.availableSeats > 0);

  return (
    <main className="mx-auto max-w-md space-y-5 px-4 py-8">
      <div className="flex justify-center">
        <Logo size="sm" />
      </div>

      <div>
        <Link
          href="/s"
          className="mb-3 inline-block text-sm text-gray-500 hover:text-gray-700"
        >
          ← 내 신청
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
          trips={applyTrips}
          studentName={studentName as string}
          studentPhone={studentPhone as string}
        />
      )}
    </main>
  );
}
