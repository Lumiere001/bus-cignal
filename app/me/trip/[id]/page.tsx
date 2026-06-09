import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePassenger } from "@/lib/auth/passenger";
import { getPassengerChatAccess } from "@/lib/chat/access";
import { getTripForPassenger } from "@/lib/passenger/trip-detail";
import { DIRECTION_SHORT } from "@/lib/labels";
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

  // 채팅 입장 링크는 paid(예약 완료) 학생에게만 노출 (access.ts와 동일 정책).
  // 한 차량(상/하행) = 한 방 — 공급 간사 + 전 지구 매칭 학생이 함께 사용.
  const chatAccess = await getPassengerChatAccess(session.passengerId, tripId);
  const directionShort =
    trip.direction === "up" || trip.direction === "down"
      ? DIRECTION_SHORT[trip.direction]
      : "";

  // 지도로 보여줄 '지역(우리 동네)' 지점 — 가는편(up)은 출발지(지역), 오는편(down)은 도착지(지역).
  // 평창 쪽 지점은 텍스트로만 안내(오는편 출발=좌표 없음, 가는편 도착=고정).
  const mappedPoint = trip.direction === "down" ? "destination" : "origin";

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

      {/* 버스(상/하행) 채팅 — paid 학생만. 같은 차량의 간사·전 지구 학생과 한 방에서 대화 */}
      {chatAccess && (
        <Link
          href={`/chat/${trip.tripId}`}
          className="bg-primary text-primary-foreground inline-flex items-center justify-center gap-1 rounded-xl px-4 py-3 text-sm font-medium hover:opacity-90"
        >
          💬 버스 채팅{directionShort ? ` (${directionShort})` : ""} 입장
        </Link>
      )}

      {/* 탑승 안내 — 가는편(up): 출발지(지역) 지도 / 오는편(down): 도착지(지역) 지도.
          평창 쪽 지점은 텍스트로만 안내(오는편 출발=좌표 없음, 가는편 도착=고정). */}
      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">탑승 안내</h2>

        <PointBlock
          role="출발"
          label={trip.originLabel}
          address={trip.originAddress}
          map={
            mappedPoint === "origin"
              ? { lat: trip.originLat, lng: trip.originLng }
              : null
          }
        />
        <PointBlock
          role="도착"
          label={trip.destinationLabel}
          address={trip.destinationAddress}
          map={
            mappedPoint === "destination"
              ? { lat: trip.destinationLat, lng: trip.destinationLng }
              : null
          }
        />
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

// 출발/도착 한 지점 — 라벨·주소 + (해당 지점이 '지도 대상'이면) 지도.
// 좌표가 없으면(텍스트 전용 지점) 주소 검색 안내 fallback.
function PointBlock({
  role,
  label,
  address,
  map,
}: {
  role: string;
  label: string;
  address: string;
  map: { lat: number | null; lng: number | null } | null;
}) {
  const hasCoords = map != null && map.lat !== null && map.lng !== null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="bg-muted text-muted-foreground rounded-md px-2 py-0.5 text-xs font-medium">
          {role}
        </span>
        <span className="min-w-0 break-words text-sm font-medium">{label}</span>
      </div>
      {address && (
        <p className="text-muted-foreground text-sm break-all">{address}</p>
      )}
      {map != null &&
        (hasCoords ? (
          <KakaoMap lat={map.lat as number} lng={map.lng as number} label={label} />
        ) : (
          <div className="bg-muted text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
            지도 좌표 정보가 아직 등록되지 않았어요.
            <br />위 주소를 지도 앱에서 검색해 보세요.
          </div>
        ))}
    </div>
  );
}
