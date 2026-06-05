import { requirePassenger } from "@/lib/auth/passenger";
import { getMatchesForPassenger } from "@/lib/passenger/queries";
import { MatchCard } from "@/components/me/MatchCard";
import {
  PushOptInBanner,
  PushSettingsLink,
} from "@/components/push/push-optin-banner";

export default async function MePage() {
  const session = await requirePassenger();
  const matches = await getMatchesForPassenger(session.passengerId);

  const paidMatches = matches.filter((m) => m.status === "paid");
  // 가장 이른 출발 시각(ISO 정렬) — 미래·24h 이내 판정은 배너(클라)가 수행해 재표시 결정.
  const nextDeparture =
    paidMatches
      .map((m) => m.departureAt)
      .filter((d): d is string => typeof d === "string")
      .sort()[0] ?? null;

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">내 예약</h1>

      {matches.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          예약된 차량이 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {matches.map((m) => (
            <li key={m.matchId}>
              <MatchCard match={m} />
            </li>
          ))}
        </ul>
      )}

      {/* 첫 매칭 paid 시점 푸시 옵트인 권유 (SPEC §S5·§13). 미지원·옵트인·닫음 시 배너가 null 렌더 */}
      {paidMatches.length > 0 && (
        <PushOptInBanner audience="passenger" departureAt={nextDeparture} />
      )}

      {/* 배너를 숨긴 뒤에도 켤 수 있는 작은 재진입 링크 */}
      {paidMatches.length > 0 && (
        <PushSettingsLink audience="passenger" className="text-center" />
      )}
    </main>
  );
}
