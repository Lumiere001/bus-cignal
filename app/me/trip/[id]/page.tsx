import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePassenger } from "@/lib/auth/passenger";
import { getTripForPassenger } from "@/lib/passenger/trip-detail";
import { KakaoMap } from "@/components/kakao/KakaoMap";
import { formatKstDateShort, formatWon } from "@/lib/datetime";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function TripDetailPage({ params }: Props) {
  const { id: tripId } = await params;
  const session = await requirePassenger();

  const trip = await getTripForPassenger(session.passengerId, tripId);

  // 소유권 없음 또는 존재하지 않는 trip → 정보 누출 없이 /me로 이동
  if (!trip) redirect("/me");

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col gap-4 p-4">
      <nav>
        <Link
          href="/me"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← 내 예약
        </Link>
      </nav>

      <h1 className="text-xl font-bold">탑승 장소 안내</h1>

      {/* 매칭 맥락 */}
      <section className="flex flex-col gap-2 rounded-xl border bg-card p-4 text-sm">
        <p className="font-semibold break-words">
          {trip.originLabel} → {trip.destinationLabel}
        </p>
        <dl className="flex flex-col gap-1 text-muted-foreground">
          <div className="flex gap-2">
            <dt className="w-16 shrink-0">출발</dt>
            <dd className="min-w-0 tabular-nums">{formatKstDateShort(trip.departureAt)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-16 shrink-0">요금</dt>
            <dd className="min-w-0 whitespace-nowrap tabular-nums">{formatWon(trip.pricePerSeat)}</dd>
          </div>
        </dl>
      </section>

      {/* 탑승 장소 상세 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">탑승 장소</h2>
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-muted-foreground">장소명</dt>
            <dd className="min-w-0 break-words">{trip.originLabel}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-muted-foreground">주소</dt>
            <dd className="min-w-0 break-all">
              {trip.originAddress || "주소 정보 없음"}
            </dd>
          </div>
        </dl>

        {trip.originLat !== null && trip.originLng !== null ? (
          <KakaoMap
            lat={trip.originLat}
            lng={trip.originLng}
            label={trip.originLabel}
          />
        ) : (
          <div className="rounded-lg border border-dashed bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
            지도 좌표 정보가 아직 등록되지 않았어요.
            <br />위 주소를 지도 앱에서 검색해 보세요.
          </div>
        )}
      </section>

      {/* 문의 연락처 — 담당(공급) 간사·총무 (§S5). 안내 목적 노출. */}
      {(trip.operatorPhone || trip.treasurerPhone) && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">문의 연락처</h2>
          <dl className="flex flex-col gap-2 text-sm">
            {trip.operatorPhone && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-16 shrink-0">담당 간사</dt>
                <dd className="min-w-0 break-words">
                  {trip.operatorName ? `${trip.operatorName} · ` : ""}
                  <a
                    href={`tel:${trip.operatorPhone}`}
                    className="text-primary underline-offset-4 hover:underline whitespace-nowrap tabular-nums"
                  >
                    {trip.operatorPhone}
                  </a>
                </dd>
              </div>
            )}
            {trip.treasurerPhone && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-16 shrink-0">총무</dt>
                <dd className="min-w-0 break-words">
                  {trip.treasurerName ? `${trip.treasurerName} · ` : ""}
                  <a
                    href={`tel:${trip.treasurerPhone}`}
                    className="text-primary underline-offset-4 hover:underline whitespace-nowrap tabular-nums"
                  >
                    {trip.treasurerPhone}
                  </a>
                </dd>
              </div>
            )}
          </dl>
          <p className="text-muted-foreground text-xs">
            탑승·픽업 관련 문의는 위 연락처로 해주세요.
          </p>
        </section>
      )}
    </main>
  );
}
