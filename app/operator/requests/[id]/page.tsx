import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DIRECTION_SHORT,
  REQUEST_STATUS_LABEL,
  MATCH_STATUS_LABEL,
} from "@/lib/labels";
import { one } from "@/lib/supabase/relation";
import { formatKstDateTime } from "@/lib/datetime";
import { ReservationLink } from "@/components/operator/ReservationLink";
import { AccountInfo } from "@/components/payment/AccountInfo";
import { RequestActions } from "./RequestActions";

export const dynamic = "force-dynamic";

// 간사 신청 상세 (SPEC §4.3·§S2) — 본인 지구가 보낸 신청 1건: trip 정보·학생 명단·상태.
// 본인 지구 신청만 접근(다른 지구 신청은 404). 개인정보=본인 명단이라 전체 표시 OK.

type Passenger = { id: string; name: string; phone: string; school_or_role: string | null; priority: number };
type Request = {
  id: string;
  region_id: string;
  status: string;
  reject_reason: string | null;
  requested_at: string;
  seat_count: number;
  trip: {
    direction: "up" | "down";
    departure_at: string;
    price_per_seat: number;
    bank_name: string | null;
    account_number: string | null;
    account_holder: string | null;
    refund_policy: string | null;
    region: { name: string } | null;
  } | null;
  request_passengers: Passenger[];
};

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireOperator();
  const { id } = await params;
  const db = createAdminClient();

  const { data } = await db
    .from("seat_requests")
    .select(
      `
      id, region_id, status, reject_reason, requested_at, seat_count,
      trip:trips!trip_id(
        direction, departure_at, price_per_seat, bank_name, account_number, account_holder, refund_policy,
        region:regions!operator_region_id(name)
      ),
      request_passengers(id, name, phone, school_or_role, priority)
    `,
    )
    .eq("id", id)
    .maybeSingle();

  const req = data as Request | null;
  // 본인 지구가 보낸 신청만 — 그 외(없음·타지구)는 404
  if (!req || req.region_id !== session.regionId) notFound();

  const trip = one(req.trip);
  const passengers = [...req.request_passengers].sort((a, b) => a.priority - b.priority);

  // 학생별 매칭 상태·예약번호(표시용) — 본인 지구 학생이라 노출 OK.
  //   입금 확인(paid)된 학생은 /r 예약 링크를 수요 간사가 직접 학생에게 공유 가능.
  const { data: matchRows } = await db
    .from("matches")
    .select("passenger_id, status, reservation_code")
    .eq("request_id", req.id)
    .in("status", ["awaiting_payment", "payment_reported", "paid"]);
  const matchByPax = new Map(
    (matchRows ?? []).map((m) => [m.passenger_id, m]),
  );
  const paidCount = (matchRows ?? []).filter((m) => m.status === "paid").length;

  // 수정·취소 가능 = 대기중 + 진행 중 매칭 없음 (서버 액션에서도 동일 가드로 재검증).
  const canModify = req.status === "queued" && (matchRows?.length ?? 0) === 0;
  // 송금 대기/보고(=입금 전) 매칭이 있으면 공급 차량 입금 계좌를 안내.
  const needsPayment = (matchRows ?? []).some(
    (m) => m.status === "awaiting_payment" || m.status === "payment_reported",
  );

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <Link href="/operator/requests" className="text-muted-foreground text-sm hover:underline">
          ← 신청 목록
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">신청 상세</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {trip?.region?.name ?? "?"} 차량 · {trip ? DIRECTION_SHORT[trip.direction] : "—"} ·{" "}
          {REQUEST_STATUS_LABEL[req.status] ?? req.status}
        </p>
      </div>

      <section className="rounded-xl border p-4">
        <h2 className="mb-3 text-sm font-semibold">신청 정보</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">신청 인원</dt>
            <dd className="font-medium">{req.seat_count}명</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">신청 시각</dt>
            <dd className="font-medium tabular-nums">{formatKstDateTime(req.requested_at)}</dd>
          </div>
          {trip && (
            <>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">출발</dt>
                <dd className="font-medium tabular-nums">{formatKstDateTime(trip.departure_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">좌석 요금</dt>
                <dd className="font-medium tabular-nums">{trip.price_per_seat.toLocaleString("ko-KR")}원</dd>
              </div>
            </>
          )}
        </dl>
        {req.status === "rejected" && req.reject_reason && (
          <p className="text-destructive mt-3 rounded-lg border px-3 py-2 text-sm">
            거절 사유: {req.reject_reason}
          </p>
        )}
      </section>

      {needsPayment && trip && (
        <section className="rounded-xl border p-4">
          <h2 className="mb-3 text-sm font-semibold">입금 안내</h2>
          {trip.account_number ? (
            <>
              <AccountInfo
                bankName={trip.bank_name}
                accountNumber={trip.account_number}
                accountHolder={trip.account_holder}
                refundPolicy={trip.refund_policy}
              />
              <p className="text-muted-foreground mt-2 text-xs">
                매칭된 학생에게 위 계좌로 송금 안내해 주세요. 송금 후 공급 지구가 입금을 확인하면
                예약번호가 발급됩니다.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              공급 지구가 계좌를 아직 등록하지 않았어요. 담당 간사에게 입금 계좌를 문의해 주세요.
            </p>
          )}
        </section>
      )}

      <section className="rounded-xl border p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">학생 명단 (우선순위순)</h2>
          {paidCount > 0 && (
            <span className="text-muted-foreground text-xs">
              입금 확인 {paidCount}명 — 아래 예약 링크를 학생에게 공유하세요
            </span>
          )}
        </div>
        <ol className="space-y-2">
          {passengers.map((p) => {
            const m = matchByPax.get(p.id);
            return (
              <li key={p.id} className="border-b py-2 text-sm last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <span>
                    <span className="text-muted-foreground mr-2 tabular-nums">
                      {p.priority}.
                    </span>
                    <span className="font-medium">{p.name}</span>
                    {p.school_or_role && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        {p.school_or_role}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {p.phone}
                  </span>
                </div>
                {m && (
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 pl-5">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                        m.status === "paid"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {MATCH_STATUS_LABEL[m.status] ?? m.status}
                    </span>
                    {m.status === "paid" && m.reservation_code && (
                      <ReservationLink code={m.reservation_code} />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {canModify && <RequestActions requestId={req.id} />}
    </main>
  );
}
