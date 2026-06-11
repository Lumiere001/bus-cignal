import Link from "next/link";
import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOperatorRegionName } from "@/lib/auth/operator-region";
import { formatKstDateTime } from "@/lib/datetime";
import { DIRECTION_SHORT } from "@/lib/labels";
import { BackButton } from "@/components/ui/back-button";
import { ImportForm, type TripOption } from "./ImportForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "사전 신청 가져오기 — Bus Cignal",
};

/**
 * 사전 수합분 일괄 등록 — 배포 전 구글폼 등으로 이미 받은 신청을
 * 공급 지구 간사가 자기 차량의 대기 큐에 올리는 화면 (CSV 업로드 + 수기 입력).
 */
export default async function ImportPage() {
  const session = await requireOperator();

  if (!session.regionId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          소속 지구 정보가 없어 등록할 수 없습니다. 관리자에게 문의해주세요.
        </p>
      </div>
    );
  }

  const db = createAdminClient();
  const regionName = await getOperatorRegionName(session.regionId);

  // 본인 지구의 공개 중 차량만 — 사전 수합분은 자기 차량 대기 큐에 올린다.
  const [{ data: trips }, { data: regions }] = await Promise.all([
    db
      .from("trips")
      .select("id, direction, departure_at, capacity")
      .eq("operator_region_id", session.regionId)
      .eq("status", "published")
      .order("departure_at", { ascending: true }),
    // 명단 표의 지구 드롭다운 — 시스템에 등록된 지구만 선택 가능 (수요 간사 매칭 보장)
    db.from("regions").select("id, name").order("name", { ascending: true }),
  ]);

  const toOption = (t: { id: string; direction: string; departure_at: string; capacity: number }): TripOption => ({
    id: t.id,
    label: `${DIRECTION_SHORT[t.direction as "up" | "down"]} · ${formatKstDateTime(t.departure_at)} · 정원 ${t.capacity}`,
  });
  const goTrips = (trips ?? []).filter((t) => t.direction === "up").map(toOption);
  const returnTrips = (trips ?? []).filter((t) => t.direction === "down").map(toOption);
  const hasPublishedTrip = goTrips.length > 0 || returnTrips.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4">
        <BackButton />
      </div>
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">사전 신청 가져오기</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          시스템 오픈 전에 구글폼 등으로 이미 받은 신청을 {regionName} 차량의 대기 큐에 올립니다.
          CSV 업로드 또는 직접 입력 모두 가능해요. 등록된 신청은 일반 신청과 똑같이
          승인·매칭 절차를 거치며, <b>예약번호는 입금 확인 후에</b> 발급됩니다.
        </p>
      </header>

      {/* 차량이 먼저 공개돼 있어야 그 차량의 대기 큐에 올릴 수 있다 — 없으면 등록부터 안내 */}
      {!hasPublishedTrip ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
          <p className="font-semibold text-amber-900">🚍 먼저 차량을 등록·공개해주세요</p>
          <p className="mt-2 text-sm leading-relaxed text-amber-800">
            사전 신청은 <b>{regionName}의 공개 중인 차량</b>의 대기 큐에 올라갑니다. 아직 공개된
            차량이 없어서 지금은 가져올 수 없어요. 차량을 등록하고 공개한 뒤 다시 시도해주세요.
          </p>
          <div className="mt-4 flex gap-3 text-sm">
            <Link
              href="/operator/trips/new"
              className="rounded-lg bg-amber-600 px-3 py-2 font-medium text-white hover:bg-amber-700"
            >
              ＋ 차량 등록하러 가기
            </Link>
            <Link
              href="/operator/trips"
              className="rounded-lg border border-amber-300 px-3 py-2 font-medium text-amber-800 hover:bg-amber-100"
            >
              내 차량 목록
            </Link>
          </div>
        </div>
      ) : (
        <ImportForm goTrips={goTrips} returnTrips={returnTrips} regions={regions ?? []} />
      )}
    </div>
  );
}
