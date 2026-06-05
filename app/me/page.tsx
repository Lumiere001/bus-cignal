import { requirePassenger } from "@/lib/auth/passenger";
import { getMatchesForPassenger } from "@/lib/passenger/queries";
import { MatchCard } from "@/components/me/MatchCard";
import { PushOptInBanner } from "@/components/push/push-optin-banner";

export default async function MePage() {
  const session = await requirePassenger();
  const matches = await getMatchesForPassenger(session.passengerId);

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

      {/* 첫 매칭 paid 시점 푸시 옵트인 권유 (SPEC §S5·§13). 미지원·이미 옵트인·닫음 시 배너가 알아서 null 렌더 */}
      {matches.some((m) => m.status === "paid") && (
        <PushOptInBanner audience="passenger" />
      )}
    </main>
  );
}
