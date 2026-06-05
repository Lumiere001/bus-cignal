import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { formatKstDateShort, formatWon } from "@/lib/datetime";
import type { MatchForDashboard } from "@/lib/passenger/queries";

const STATUS: Record<
  string,
  { label: string; tone: "info" | "success" | "warning" | "danger" | "neutral" }
> = {
  awaiting_payment: { label: "송금 대기", tone: "warning" },
  payment_reported: { label: "입금 확인 중", tone: "info" },
  paid: { label: "예약 완료", tone: "success" },
  expired: { label: "만료됨", tone: "neutral" },
  cancelled: { label: "취소됨", tone: "neutral" },
};

type Props = {
  match: MatchForDashboard;
};

export function MatchCard({ match }: Props) {
  const isInactive = match.status === "cancelled" || match.status === "expired";
  const s = STATUS[match.status] ?? { label: match.status, tone: "neutral" as const };

  return (
    <div
      className={`bg-card flex flex-col overflow-hidden rounded-2xl border shadow-sm ${
        isInactive ? "opacity-60" : ""
      }`}
    >
      {/* 노선 + 상태 */}
      <div className="flex items-start justify-between gap-2 border-b border-dashed px-4 pt-4 pb-3">
        <div>
          <span className="text-base leading-snug font-bold">
            {match.originLabel} → {match.destinationLabel}
          </span>
          <p className="text-muted-foreground mt-1 text-xs font-medium">
            {formatKstDateShort(match.departureAt)} 출발
          </p>
        </div>
        <StatusPill tone={s.tone}>{s.label}</StatusPill>
      </div>

      {/* 상세 정보 */}
      <dl className="text-muted-foreground flex flex-col gap-2 px-4 py-3 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">요금</dt>
          <dd className="text-foreground font-bold">{formatWon(match.pricePerSeat)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">예약번호</dt>
          <dd>
            <span className="bg-blue-50 font-mono text-sm font-extrabold tracking-wider text-blue-700 rounded-md px-2 py-0.5">
              {match.reservationCode ?? "-"}
            </span>
          </dd>
        </div>
      </dl>

      {/* 진입 버튼 */}
      <div className="flex gap-2 px-4 pb-4">
        {/* 지도 — 취소/만료된 매칭은 유효 탑승자가 아니므로 숨김 */}
        {!isInactive && (
          <Link href={`/me/trip/${match.tripId}`} className="flex-1">
            <Button variant="outline" className="bg-card h-11 w-full" aria-label="지도">
              🗺️ 지도
            </Button>
          </Link>
        )}

        {/* 채팅 — /chat 라우트 미구현(CCC 이후)이라 깨진 링크 방지 위해 숨김.
            구현 시 아래 블록 복구: <Link href={`/chat/${match.tripId}`}>…채팅…</Link> */}

        {/* 취소 진입 — 비활성 상태면 숨김 */}
        {!isInactive && (
          <Link href={`/me/cancel/${match.matchId}`} className="flex-1">
            <Button variant="ghost" className="text-destructive hover:bg-destructive/10 h-11 w-full">
              예약 취소
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
