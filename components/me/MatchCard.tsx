import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatKstDateShort, formatWon } from "@/lib/datetime";
import type { MatchForDashboard } from "@/lib/passenger/queries";

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "송금 대기",
  payment_reported: "입금 확인 중",
  paid: "예약 완료",
  expired: "만료됨",
  cancelled: "취소됨",
};

type Props = {
  match: MatchForDashboard;
};

export function MatchCard({ match }: Props) {
  const isInactive =
    match.status === "cancelled" || match.status === "expired";
  const statusLabel = STATUS_LABELS[match.status] ?? match.status;

  return (
    <div
      className={`rounded-xl border bg-card p-4 flex flex-col gap-3 ${isInactive ? "opacity-60" : ""}`}
    >
      {/* 노선 + 상태 */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-base font-semibold leading-snug">
          {match.originLabel} → {match.destinationLabel}
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            match.status === "paid"
              ? "bg-green-100 text-green-700"
              : isInactive
                ? "bg-muted text-muted-foreground"
                : "bg-yellow-100 text-yellow-700"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      {/* 상세 정보 */}
      <dl className="flex flex-col gap-1 text-sm text-muted-foreground">
        <div className="flex gap-2">
          <dt className="w-16 shrink-0">출발</dt>
          <dd>{formatKstDateShort(match.departureAt)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0">요금</dt>
          <dd>{formatWon(match.pricePerSeat)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0">예약번호</dt>
          <dd className="font-mono">{match.reservationCode ?? "-"}</dd>
        </div>
      </dl>

      {/* 진입 버튼 */}
      <div className="flex gap-2">
        {/* 지도 — 취소/만료된 매칭은 유효 탑승자가 아니므로 숨김 */}
        {!isInactive && (
          <Link href={`/me/trip/${match.tripId}`}>
            <Button variant="outline" size="sm" aria-label="지도">
              지도
            </Button>
          </Link>
        )}

        {/* 채팅 — 취소/만료된 매칭은 더 이상 유효 탑승자가 아니므로 숨김 */}
        {!isInactive && (
          <Link href={`/chat/${match.tripId}`}>
            <Button variant="outline" size="sm" aria-label="채팅">
              채팅
            </Button>
          </Link>
        )}

        {/* 취소 진입 — 비활성 상태면 숨김 */}
        {!isInactive && (
          <Link href={`/me/cancel/${match.matchId}`}>
            <Button variant="ghost" size="sm" className="text-destructive">
              취소
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
